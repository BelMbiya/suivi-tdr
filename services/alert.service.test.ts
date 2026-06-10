import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocationAreaStatus } from "@/generated/prisma/client";
import { ForbiddenError } from "@/lib/errors";
import type { CurrentUser } from "@/types/domain";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
    },
    location: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { alertService } from "@/services/alert.service";

const manager: CurrentUser = {
  id: "manager-1",
  organizationId: "org-1",
  email: "manager@track-tdr.local",
  roles: ["MANAGER"],
  areaIds: ["area-1"],
};

describe("alertService.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a critical alert when no position is detected for 3 days", async () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);

    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: "user-1",
        firstName: "Patrick",
        lastName: "Mavungu",
        email: "patrick@track-tdr.local",
        userAreas: [{ area: { code: "AREA-001" } }],
        locations: [{ recordedAt: fourDaysAgo }],
      },
    ] as never);
    vi.mocked(prisma.location.findMany).mockResolvedValue([]);

    const alerts = await alertService.list(manager);

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.type).toBe("POSITION_NOT_DETECTED");
    expect(alerts[0]?.severity).toBe("critical");
    expect(alerts[0]?.message).toContain("Patrick Mavungu");
  });

  it("returns an absence alert when positions are only out of area for 24h", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: "user-2",
        firstName: "Grace",
        lastName: "Ilunga",
        email: "grace@track-tdr.local",
        userAreas: [{ area: { code: "AREA-002" } }],
        locations: [{ recordedAt: oneHourAgo }],
      },
    ] as never);
    vi.mocked(prisma.location.findMany).mockResolvedValue([
      {
        userId: "user-2",
        areaStatus: LocationAreaStatus.OUT_OF_AREA,
        recordedAt: twoHoursAgo,
      },
      {
        userId: "user-2",
        areaStatus: LocationAreaStatus.OUT_OF_AREA,
        recordedAt: oneHourAgo,
      },
    ] as never);

    const alerts = await alertService.list(manager);

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.type).toBe("ABSENCE_OUT_OF_AREA");
    expect(alerts[0]?.severity).toBe("warning");
    expect(alerts[0]?.message).toContain("Cas d'absence");
  });

  it("prioritizes silence alerts over absence when both could apply", async () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);

    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: "user-3",
        firstName: "Jean",
        lastName: "Kabasele",
        email: "jean@track-tdr.local",
        userAreas: [{ area: { code: "AREA-003" } }],
        locations: [{ recordedAt: fourDaysAgo }],
      },
    ] as never);
    vi.mocked(prisma.location.findMany).mockResolvedValue([]);

    const alerts = await alertService.list(manager);

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.type).toBe("POSITION_NOT_DETECTED");
  });

  it("returns no alert when recent positions are inside the area", async () => {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: "user-4",
        firstName: "Sarah",
        lastName: "Mbuyi",
        email: "sarah@track-tdr.local",
        userAreas: [{ area: { code: "AREA-004" } }],
        locations: [{ recordedAt: thirtyMinutesAgo }],
      },
    ] as never);
    vi.mocked(prisma.location.findMany).mockResolvedValue([
      {
        userId: "user-4",
        areaStatus: LocationAreaStatus.IN_AREA,
        recordedAt: thirtyMinutesAgo,
      },
    ] as never);

    const alerts = await alertService.list(manager);

    expect(alerts).toHaveLength(0);
  });

  it("rejects users without manager role", async () => {
    await expect(
      alertService.list({
        ...manager,
        roles: ["USER"],
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
