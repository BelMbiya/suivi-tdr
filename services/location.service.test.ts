import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { AuditAction, LocationAreaStatus, LocationSource } from "@/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/repositories/user.repository", () => ({
  userRepository: {
    findById: vi.fn(),
  },
}));

vi.mock("@/repositories/location.repository", () => ({
  locationRepository: {
    create: vi.fn(),
    listHistory: vi.fn(),
    latestByUsers: vi.fn(),
  },
}));

vi.mock("@/repositories/audit.repository", () => ({
  auditRepository: {
    record: vi.fn(),
  },
}));

vi.mock("@/services/geofence.service", () => ({
  geofenceService: {
    evaluateLocation: vi.fn(),
  },
}));

vi.mock("@/sockets/events", () => ({
  emitLocationUpdate: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { auditRepository } from "@/repositories/audit.repository";
import { locationRepository } from "@/repositories/location.repository";
import { userRepository } from "@/repositories/user.repository";
import { geofenceService } from "@/services/geofence.service";
import { locationService } from "@/services/location.service";
import { toMapLocationPayload } from "@/lib/map-location-payload";
import { emitLocationUpdate } from "@/sockets/events";
import type { CurrentUser } from "@/types/domain";

const orgId = "00000000-0000-0000-0000-000000000001";
const actorId = "00000000-0000-0000-0000-000000000010";
const userId = "00000000-0000-0000-0000-000000000020";
const areaA = "00000000-0000-0000-0000-0000000000a1";
const areaB = "00000000-0000-0000-0000-0000000000b1";

const manager: CurrentUser = {
  id: actorId,
  organizationId: orgId,
  email: "manager@test.local",
  roles: ["MANAGER"],
  areaIds: [areaA],
};

const admin: CurrentUser = {
  ...manager,
  roles: ["ADMIN"],
  areaIds: [],
};

const user: CurrentUser = {
  id: userId,
  organizationId: orgId,
  email: "user@test.local",
  roles: ["USER"],
  areaIds: [areaA],
};

function trackedUser(areaIds = [areaA], organizationId = orgId) {
  return {
    id: userId,
    organizationId,
    userAreas: areaIds.map((areaId) => ({ areaId })),
  };
}

function location(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-0000-0000-000000000999",
    organizationId: orgId,
    userId,
    areaId: areaA,
    latitude: -4.325,
    longitude: 15.312,
    speed: 12,
    areaStatus: LocationAreaStatus.IN_AREA,
    recordedAt: new Date("2026-06-05T10:00:00.000Z"),
    ...overrides,
  };
}

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    userId,
    latitude: -4.325,
    longitude: 15.312,
    speed: 12,
    source: LocationSource.WEB,
    recordedAt: new Date("2026-06-05T10:00:00.000Z"),
    ...overrides,
  };
}

describe("locationService.create", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(userRepository.findById).mockResolvedValue(trackedUser() as never);
    vi.mocked(locationRepository.create).mockResolvedValue(location() as never);
    vi.mocked(auditRepository.record).mockResolvedValue({} as never);
    vi.mocked(geofenceService.evaluateLocation).mockResolvedValue([] as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);
  });

  it("creates an IN_AREA location when the actor explicitly sends an accessible area", async () => {
    const result = await locationService.create(
      manager,
      createInput({ areaId: areaA }),
    );

    expect(result.id).toBe("00000000-0000-0000-0000-000000000999");
    expect(locationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: orgId,
        userId,
        areaId: areaA,
        areaStatus: LocationAreaStatus.IN_AREA,
        source: LocationSource.WEB,
      }),
    );
    expect(auditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.LOCATION_RECEIVED,
        entityType: "Location",
      }),
    );
    expect(geofenceService.evaluateLocation).toHaveBeenCalledWith(result);
    expect(emitLocationUpdate).toHaveBeenCalledWith(toMapLocationPayload(result));
  });

  it("uses PostGIS containment to infer area when no areaId is provided", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ id: areaA }] as never);

    await locationService.create(manager, createInput());

    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
    expect(locationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        areaId: areaA,
        areaStatus: LocationAreaStatus.IN_AREA,
      }),
    );
  });

  it("marks a position OUT_OF_AREA and falls back to the assigned area when no geometry contains it", async () => {
    await locationService.create(manager, createInput());

    expect(locationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        areaId: areaA,
        areaStatus: LocationAreaStatus.OUT_OF_AREA,
      }),
    );
  });

  it("allows a USER to create their own location in an assigned area", async () => {
    await locationService.create(user, createInput({ areaId: areaA }));

    expect(locationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        areaId: areaA,
      }),
    );
  });

  it("rejects a USER creating a location for another user", async () => {
    await expect(
      locationService.create(user, createInput({ userId: actorId })),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(userRepository.findById).not.toHaveBeenCalled();
    expect(locationRepository.create).not.toHaveBeenCalled();
  });

  it("rejects tracking when the target user does not exist", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(null as never);

    await expect(locationService.create(manager, createInput())).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("rejects tracking across organizations", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(
      trackedUser([areaA], "00000000-0000-0000-0000-000000000777") as never,
    );

    await expect(locationService.create(manager, createInput())).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("rejects tracking when the target user has no area assignment", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(trackedUser([]) as never);

    await expect(locationService.create(manager, createInput())).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("rejects a manager creating a position in an area they cannot access", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(trackedUser([areaB]) as never);

    await expect(
      locationService.create(manager, createInput({ areaId: areaB })),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(locationRepository.create).not.toHaveBeenCalled();
  });

  it("allows an admin to create a position in any organization area", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(trackedUser([areaB]) as never);

    await locationService.create(admin, createInput({ areaId: areaB }));

    expect(locationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        areaId: areaB,
        areaStatus: LocationAreaStatus.IN_AREA,
      }),
    );
  });
});

describe("locationService.history", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(locationRepository.listHistory).mockResolvedValue([
      3,
      [
        location({ latitude: 0, longitude: 0, speed: 10 }),
        location({ latitude: 0, longitude: 1, speed: 20 }),
        location({ latitude: 0, longitude: 2, speed: null }),
      ],
    ] as never);
  });

  it("returns paginated history and movement statistics", async () => {
    const result = await locationService.history(manager, {
      userId,
      from: new Date("2026-06-05T00:00:00.000Z"),
      to: new Date("2026-06-06T00:00:00.000Z"),
      page: 1,
      pageSize: 100,
    });

    expect(result.total).toBe(3);
    expect(result.stats.distanceMeters).toBeGreaterThan(200_000);
    expect(result.stats.averageSpeed).toBe(15);
    expect(result.stats.maxSpeed).toBe(20);
    expect(locationRepository.listHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: orgId,
        areaIds: [areaA],
      }),
    );
  });

  it("uses an explicit area filter when provided and accessible", async () => {
    await locationService.history(manager, {
      userId,
      areaId: areaA,
      from: new Date("2026-06-05T00:00:00.000Z"),
      to: new Date("2026-06-06T00:00:00.000Z"),
      page: 1,
      pageSize: 20,
    });

    expect(locationRepository.listHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        areaId: areaA,
        areaIds: undefined,
      }),
    );
  });

  it("rejects explicit area filters outside the manager scope", async () => {
    await expect(
      locationService.history(manager, {
        userId,
        areaId: areaB,
        from: new Date("2026-06-05T00:00:00.000Z"),
        to: new Date("2026-06-06T00:00:00.000Z"),
        page: 1,
        pageSize: 20,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("locationService.latest", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(locationRepository.latestByUsers).mockResolvedValue([location()] as never);
  });

  it("scopes manager latest positions to assigned areas when no area filter is provided", async () => {
    await locationService.latest(manager);

    expect(locationRepository.latestByUsers).toHaveBeenCalledWith({
      organizationId: orgId,
      areaId: undefined,
      areaIds: [areaA],
    });
  });

  it("does not scope admins to areaIds when no area filter is provided", async () => {
    await locationService.latest(admin);

    expect(locationRepository.latestByUsers).toHaveBeenCalledWith({
      organizationId: orgId,
      areaId: undefined,
      areaIds: undefined,
    });
  });

  it("rejects latest positions for an inaccessible area", async () => {
    await expect(locationService.latest(manager, areaB)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
