import { AuditAction } from "@/generated/prisma/client";
import { requireRole } from "@/lib/auth/permissions";
import { NotFoundError } from "@/lib/errors";
import { auditRepository } from "@/repositories/audit.repository";
import { deviceRepository } from "@/repositories/device.repository";
import { userRepository } from "@/repositories/user.repository";
import type { CurrentUser } from "@/types/domain";

export const deviceService = {
  async list(
    actor: CurrentUser,
    params: {
      page: number;
      pageSize: number;
      search?: string;
      userId?: string;
      isActive?: boolean;
    },
  ) {
    requireRole(actor, "MANAGER");
    const [total, items] = await deviceRepository.list({
      ...params,
      organizationId: actor.organizationId,
    });
    return { items, total, page: params.page, pageSize: params.pageSize };
  },

  async create(
    actor: CurrentUser,
    input: {
      userId: string;
      name: string;
      platform: string;
      externalId?: string;
      isActive: boolean;
    },
  ) {
    requireRole(actor, "ADMIN");
    const user = await userRepository.findById(input.userId);

    if (!user || user.organizationId !== actor.organizationId) {
      throw new NotFoundError("User not found");
    }

    const device = await deviceRepository.create({
      organizationId: actor.organizationId,
      ...input,
    });
    await auditRepository.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: AuditAction.CREATE,
      entityType: "Device",
      entityId: device.id,
    });
    return device;
  },

  async update(
    actor: CurrentUser,
    deviceId: string,
    input: Partial<{
      userId: string;
      name: string;
      platform: string;
      externalId: string;
      isActive: boolean;
    }>,
  ) {
    requireRole(actor, "ADMIN");
    const existing = await deviceRepository.findById(deviceId);

    if (!existing || existing.organizationId !== actor.organizationId) {
      throw new NotFoundError("Device not found");
    }

    if (input.userId) {
      const user = await userRepository.findById(input.userId);
      if (!user || user.organizationId !== actor.organizationId) {
        throw new NotFoundError("User not found");
      }
    }

    const device = await deviceRepository.update(deviceId, input);
    await auditRepository.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: AuditAction.UPDATE,
      entityType: "Device",
      entityId: device.id,
    });
    return device;
  },

  async disable(actor: CurrentUser, deviceId: string) {
    requireRole(actor, "ADMIN");
    const existing = await deviceRepository.findById(deviceId);

    if (!existing || existing.organizationId !== actor.organizationId) {
      throw new NotFoundError("Device not found");
    }

    const device = await deviceRepository.disable(deviceId);
    await auditRepository.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: AuditAction.DEACTIVATE,
      entityType: "Device",
      entityId: device.id,
    });
    return device;
  },
};
