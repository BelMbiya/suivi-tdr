import {
  AuditAction,
  LocationAreaStatus,
  LocationSource,
  Prisma,
} from "@/generated/prisma/client";
import { hasRole, requireAreaAccess, requireRole } from "@/lib/auth/permissions";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { auditRepository } from "@/repositories/audit.repository";
import { locationRepository } from "@/repositories/location.repository";
import { userRepository } from "@/repositories/user.repository";
import { geofenceService } from "@/services/geofence.service";
import { toMapLocationPayload } from "@/lib/map-location-payload";
import { emitLocationUpdate } from "@/sockets/events";
import type { CurrentUser } from "@/types/domain";
import {
  resolveLocationPeriodRange,
  type DateRange,
  type LocationPeriod,
} from "@/utils/date-period";
import { distanceInMeters, totalDistanceInMeters } from "@/utils/geo";

const containmentCache = new Map<
  string,
  {
    latitude: number;
    longitude: number;
    areaId: string | null;
    checkedAt: number;
  }
>();

const CONTAINMENT_CACHE_MS = 15_000;
const CONTAINMENT_MOVE_METERS = 15;

function resolveListDateRange(params: {
  today?: boolean;
  period?: LocationPeriod;
  from?: Date;
  to?: Date;
}): DateRange {
  if (params.from && params.to) {
    return { from: params.from, to: params.to };
  }

  if (params.period) {
    return resolveLocationPeriodRange(params.period);
  }

  if (params.today) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);
    return { from: startOfToday, to: endOfToday };
  }

  return {};
}

async function findContainingArea(params: {
  organizationId: string;
  userId: string;
  latitude: number;
  longitude: number;
}) {
  const matches = await prisma.$queryRaw<{ id: string }[]>`
    SELECT a."id"
    FROM "Area" a
    INNER JOIN "UserArea" ua ON ua."areaId" = a."id"
    WHERE ua."userId" = ${params.userId}::uuid
      AND a."organizationId" = ${params.organizationId}::uuid
      AND a."isActive" = true
      AND a."geom" IS NOT NULL
      AND ST_Contains(a."geom", ST_SetSRID(ST_MakePoint(${params.longitude}, ${params.latitude}), 4326))
    LIMIT 1
  `;

  return matches[0]?.id;
}

async function resolveAreaIdForLocation(params: {
  organizationId: string;
  userId: string;
  latitude: number;
  longitude: number;
}) {
  const cached = containmentCache.get(params.userId);
  const now = Date.now();

  if (cached && now - cached.checkedAt < CONTAINMENT_CACHE_MS) {
    const moved = distanceInMeters(
      { latitude: cached.latitude, longitude: cached.longitude },
      { latitude: params.latitude, longitude: params.longitude },
    );

    if (moved < CONTAINMENT_MOVE_METERS) {
      return cached.areaId;
    }
  }

  const areaId = (await findContainingArea(params)) ?? null;
  containmentCache.set(params.userId, {
    latitude: params.latitude,
    longitude: params.longitude,
    areaId,
    checkedAt: now,
  });

  return areaId;
}

export const locationService = {
  async list(
    actor: CurrentUser,
    params: {
      page: number;
      pageSize: number;
      search?: string;
      areaId?: string;
      userId?: string;
      today?: boolean;
      period?: LocationPeriod;
      from?: Date;
      to?: Date;
    },
  ) {
    requireRole(actor, "MANAGER");

    if (params.areaId) {
      requireAreaAccess(actor, params.areaId);
    }

    const scopedAreaIds =
      params.areaId || hasRole(actor, "ADMIN") ? undefined : actor.areaIds;
    const dateRange = resolveListDateRange(params);
    const [total, items] = await locationRepository.list({
      ...params,
      organizationId: actor.organizationId,
      areaIds: scopedAreaIds,
      from: dateRange.from,
      to: dateRange.to,
      order: "asc",
    });

    return { items, total, page: params.page, pageSize: params.pageSize };
  },

  async create(
    actor: CurrentUser,
    input: {
      userId: string;
      areaId?: string;
      deviceId?: string;
      latitude: number;
      longitude: number;
      accuracy?: number;
      speed?: number;
      altitude?: number;
      heading?: number;
      batteryLevel?: number;
      source: LocationSource;
      clientId?: string;
      recordedAt: Date;
      metadata?: Record<string, unknown>;
    },
  ) {
    if (input.userId !== actor.id) {
      requireRole(actor, "MANAGER");
    }

    const user = await userRepository.findById(input.userId);

    if (!user || user.organizationId !== actor.organizationId) {
      throw new NotFoundError("Tracked user not found");
    }

    const assignedAreaIds = user.userAreas.map(({ areaId }) => areaId);

    if (!assignedAreaIds.length) {
      throw new ForbiddenError("Tracked user has no active area assignment");
    }

    let areaId = input.areaId;

    if (areaId) {
      requireAreaAccess(actor, areaId);
    } else {
      areaId =
        (await resolveAreaIdForLocation({
          organizationId: actor.organizationId,
          userId: input.userId,
          latitude: input.latitude,
          longitude: input.longitude,
        })) ?? undefined;
    }

    const areaStatus = areaId
      ? LocationAreaStatus.IN_AREA
      : LocationAreaStatus.OUT_OF_AREA;
    const fallbackAreaId = areaId ?? assignedAreaIds[0];

    if (fallbackAreaId) {
      if (input.userId === actor.id) {
        if (!assignedAreaIds.includes(fallbackAreaId)) {
          throw new ForbiddenError("You do not have access to this area");
        }
      } else {
        requireAreaAccess(actor, fallbackAreaId);
      }
    }

    const location = await locationRepository.create({
      organizationId: actor.organizationId,
      userId: input.userId,
      areaId: fallbackAreaId,
      deviceId: input.deviceId,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
      speed: input.speed,
      altitude: input.altitude,
      heading: input.heading,
      batteryLevel: input.batteryLevel,
      source: input.source,
      areaStatus,
      clientId: input.clientId,
      recordedAt: input.recordedAt,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    });

    const payload = toMapLocationPayload({
      ...location,
      receivedAt: location.receivedAt ?? new Date(),
    });
    emitLocationUpdate(payload);

    void auditRepository.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: AuditAction.LOCATION_RECEIVED,
      entityType: "Location",
      entityId: location.id,
      metadata: { userId: input.userId, areaStatus },
    });

    void geofenceService.evaluateLocation(location).catch((error) => {
      console.error("Geofence evaluation failed", error);
    });

    return location;
  },

  async history(
    actor: CurrentUser,
    params: {
      userId: string;
      areaId?: string;
      from: Date;
      to: Date;
      page: number;
      pageSize: number;
    },
  ) {
    requireRole(actor, "MANAGER");

    if (params.areaId) {
      requireAreaAccess(actor, params.areaId);
    }

    const scopedAreaIds =
      params.areaId || hasRole(actor, "ADMIN") ? undefined : actor.areaIds;

    const [total, locations] = await locationRepository.listHistory({
      ...params,
      organizationId: actor.organizationId,
      areaIds: scopedAreaIds,
    });

    const distanceMeters = totalDistanceInMeters(locations);
    const speeds = locations
      .map((location) => location.speed)
      .filter((speed): speed is number => typeof speed === "number");

    return {
      items: locations,
      total,
      page: params.page,
      pageSize: params.pageSize,
      stats: {
        distanceMeters,
        averageSpeed: speeds.length
          ? speeds.reduce((totalSpeed, speed) => totalSpeed + speed, 0) / speeds.length
          : 0,
        maxSpeed: speeds.length ? Math.max(...speeds) : 0,
      },
    };
  },

  async latest(actor: CurrentUser, areaId?: string) {
    requireRole(actor, "MANAGER");

    if (areaId) {
      requireAreaAccess(actor, areaId);
    }

    const scopedAreaIds = areaId || hasRole(actor, "ADMIN") ? undefined : actor.areaIds;

    return locationRepository.latestByUsers({
      organizationId: actor.organizationId,
      areaId,
      areaIds: scopedAreaIds,
    });
  },

  async delete(actor: CurrentUser, locationId: string) {
    requireRole(actor, "ADMIN");
    const existing = await locationRepository.findById(locationId);

    if (!existing || existing.organizationId !== actor.organizationId) {
      throw new NotFoundError("Location not found");
    }

    return locationRepository.delete(locationId);
  },
};
