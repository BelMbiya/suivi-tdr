import {
  AuditAction,
  GeofenceEventType,
  GeofenceType,
  type Location,
} from "@/generated/prisma/client";
import { requireAreaAccess, requireRole } from "@/lib/auth/permissions";
import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { auditRepository } from "@/repositories/audit.repository";
import { geofenceRepository } from "@/repositories/geofence.repository";
import type { CurrentUser } from "@/types/domain";

type Polygon = {
  type: "Polygon";
  coordinates: [number, number][][];
};

async function syncGeofenceGeometry(
  geofenceId: string,
  input: {
    type?: GeofenceType;
    centerLat?: number | null;
    centerLng?: number | null;
    radiusMeters?: number | null;
    polygon?: Polygon | null;
  },
) {
  if (input.type === GeofenceType.CIRCLE) {
    await prisma.$executeRaw`
      UPDATE "Geofence"
      SET "geom" = ST_Buffer(
        ST_SetSRID(ST_MakePoint(${input.centerLng}, ${input.centerLat}), 4326)::geography,
        ${input.radiusMeters}
      )::geometry
      WHERE "id" = ${geofenceId}::uuid
    `;
    return;
  }

  if (input.type === GeofenceType.POLYGON && input.polygon) {
    await prisma.$executeRaw`
      UPDATE "Geofence"
      SET "geom" = ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(input.polygon)}), 4326)
      WHERE "id" = ${geofenceId}::uuid
    `;
  }
}

export const geofenceService = {
  async list(
    actor: CurrentUser,
    params: {
      page: number;
      pageSize: number;
      search?: string;
      areaId?: string;
      isActive?: boolean;
    },
  ) {
    requireRole(actor, "MANAGER");

    if (params.areaId) {
      requireAreaAccess(actor, params.areaId);
    }

    const [total, items] = await geofenceRepository.list({
      ...params,
      organizationId: actor.organizationId,
    });

    return { items, total, page: params.page, pageSize: params.pageSize };
  },

  async create(
    actor: CurrentUser,
    input: {
      areaId?: string;
      name: string;
      type: GeofenceType;
      centerLat?: number;
      centerLng?: number;
      radiusMeters?: number;
      polygon?: Polygon;
    },
  ) {
    requireRole(actor, "ADMIN");

    if (input.areaId) {
      requireAreaAccess(actor, input.areaId);
    }

    const geofence = await geofenceRepository.create({
      organizationId: actor.organizationId,
      areaId: input.areaId,
      name: input.name,
      type: input.type,
      centerLat: input.centerLat,
      centerLng: input.centerLng,
      radiusMeters: input.radiusMeters,
      polygon: input.polygon,
    });

    await syncGeofenceGeometry(geofence.id, input);
    await auditRepository.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: AuditAction.CREATE,
      entityType: "Geofence",
      entityId: geofence.id,
    });

    return geofenceRepository.findById(geofence.id);
  },

  async update(
    actor: CurrentUser,
    geofenceId: string,
    input: Partial<{
      areaId: string;
      name: string;
      type: GeofenceType;
      centerLat: number;
      centerLng: number;
      radiusMeters: number;
      polygon: Polygon;
      isActive: boolean;
    }>,
  ) {
    requireRole(actor, "ADMIN");
    const existing = await geofenceRepository.findById(geofenceId);

    if (!existing || existing.organizationId !== actor.organizationId) {
      throw new NotFoundError("Geofence not found");
    }

    if (input.areaId) {
      requireAreaAccess(actor, input.areaId);
    }

    const geofence = await geofenceRepository.update(geofenceId, input);

    if (input.type || input.centerLat || input.centerLng || input.radiusMeters || input.polygon) {
      await syncGeofenceGeometry(geofence.id, {
        type: input.type ?? geofence.type,
        centerLat: input.centerLat ?? geofence.centerLat,
        centerLng: input.centerLng ?? geofence.centerLng,
        radiusMeters: input.radiusMeters ?? geofence.radiusMeters,
        polygon: input.polygon ?? (geofence.polygon as Polygon | null),
      });
    }

    await auditRepository.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: AuditAction.UPDATE,
      entityType: "Geofence",
      entityId: geofence.id,
    });

    return geofence;
  },

  async delete(actor: CurrentUser, geofenceId: string) {
    requireRole(actor, "ADMIN");
    const existing = await geofenceRepository.findById(geofenceId);

    if (!existing || existing.organizationId !== actor.organizationId) {
      throw new NotFoundError("Geofence not found");
    }

    const geofence = await geofenceRepository.delete(geofenceId);
    await auditRepository.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: AuditAction.DELETE,
      entityType: "Geofence",
      entityId: geofence.id,
    });
    return geofence;
  },

  async evaluateLocation(location: Location) {
    const activeGeofences = await prisma.geofence.findMany({
      where: {
        organizationId: location.organizationId,
        isActive: true,
        OR: [{ areaId: location.areaId }, { areaId: null }],
      },
      select: { id: true },
    });

    if (!activeGeofences.length) {
      return [];
    }

    const inside = await prisma.$queryRaw<{ id: string }[]>`
      SELECT "id"
      FROM "Geofence"
      WHERE "organizationId" = ${location.organizationId}::uuid
        AND "isActive" = true
        AND ("areaId" = ${location.areaId}::uuid OR "areaId" IS NULL)
        AND "geom" IS NOT NULL
        AND ST_Contains("geom", ST_SetSRID(ST_MakePoint(${location.longitude}, ${location.latitude}), 4326))
    `;
    const insideIds = new Set(inside.map(({ id }) => id));

    const events = [];

    for (const geofence of activeGeofences) {
      const lastEvent = await prisma.geofenceEvent.findFirst({
        where: { geofenceId: geofence.id, userId: location.userId },
        orderBy: { occurredAt: "desc" },
      });
      const isInside = insideIds.has(geofence.id);

      if (isInside && lastEvent?.type !== GeofenceEventType.ENTER) {
        events.push(
          await prisma.geofenceEvent.create({
            data: {
              organizationId: location.organizationId,
              geofenceId: geofence.id,
              userId: location.userId,
              locationId: location.id,
              type: GeofenceEventType.ENTER,
            },
          }),
        );
      }

      if (!isInside && lastEvent?.type === GeofenceEventType.ENTER) {
        events.push(
          await prisma.geofenceEvent.create({
            data: {
              organizationId: location.organizationId,
              geofenceId: geofence.id,
              userId: location.userId,
              locationId: location.id,
              type: GeofenceEventType.EXIT,
            },
          }),
        );
      }
    }

    return events;
  },
};
