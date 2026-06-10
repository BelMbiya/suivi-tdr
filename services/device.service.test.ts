import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuditAction } from "@/generated/prisma/client";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

vi.mock("@/repositories/device.repository", () => ({
  deviceRepository: {
    list: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    disable: vi.fn(),
  },
}));

vi.mock("@/repositories/user.repository", () => ({
  userRepository: {
    findById: vi.fn(),
  },
}));

vi.mock("@/repositories/audit.repository", () => ({
  auditRepository: {
    record: vi.fn(),
  },
}));

import { auditRepository } from "@/repositories/audit.repository";
import { deviceRepository } from "@/repositories/device.repository";
import { userRepository } from "@/repositories/user.repository";
import { deviceService } from "@/services/device.service";
import type { CurrentUser } from "@/types/domain";

const orgId = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";
const deviceId = "44444444-4444-4444-8444-444444444444";

const admin: CurrentUser = {
  id: actorId,
  organizationId: orgId,
  email: "admin@test.local",
  roles: ["ADMIN"],
  areaIds: [],
};

const manager: CurrentUser = {
  ...admin,
  roles: ["MANAGER"],
};

const regularUser: CurrentUser = {
  ...admin,
  roles: ["USER"],
};

const device = {
  id: deviceId,
  organizationId: orgId,
  userId,
  name: "Device",
  platform: "WEB",
  externalId: "device-1",
  isActive: true,
};

describe("deviceService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(userRepository.findById).mockResolvedValue({
      id: userId,
      organizationId: orgId,
    } as never);
    vi.mocked(deviceRepository.findById).mockResolvedValue(device as never);
    vi.mocked(deviceRepository.create).mockResolvedValue(device as never);
    vi.mocked(deviceRepository.update).mockResolvedValue(device as never);
    vi.mocked(deviceRepository.disable).mockResolvedValue({
      ...device,
      isActive: false,
    } as never);
    vi.mocked(deviceRepository.list).mockResolvedValue([1, [device]] as never);
    vi.mocked(auditRepository.record).mockResolvedValue({} as never);
  });

  it("allows managers to list devices", async () => {
    const result = await deviceService.list(manager, { page: 1, pageSize: 20 });

    expect(result.total).toBe(1);
    expect(deviceRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: orgId }),
    );
  });

  it("rejects regular users listing devices", async () => {
    await expect(deviceService.list(regularUser, { page: 1, pageSize: 20 })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("creates a device for an organization user and writes audit log", async () => {
    await deviceService.create(admin, {
      userId,
      name: "Device",
      platform: "WEB",
      externalId: "device-1",
      isActive: true,
    });

    expect(deviceRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: orgId, userId }),
    );
    expect(auditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.CREATE, entityType: "Device" }),
    );
  });

  it("rejects create when the user does not belong to the organization", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({
      id: userId,
      organizationId: "55555555-5555-4555-8555-555555555555",
    } as never);

    await expect(
      deviceService.create(admin, {
        userId,
        name: "Device",
        platform: "WEB",
        isActive: true,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("updates a device and writes audit log", async () => {
    await deviceService.update(admin, deviceId, { name: "Updated" });

    expect(deviceRepository.update).toHaveBeenCalledWith(deviceId, { name: "Updated" });
    expect(auditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.UPDATE }),
    );
  });

  it("disables a device instead of hard deleting it", async () => {
    const result = await deviceService.disable(admin, deviceId);

    expect(result.isActive).toBe(false);
    expect(auditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.DEACTIVATE }),
    );
  });
});
