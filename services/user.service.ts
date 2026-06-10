import { AuditAction, RoleName } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { canAccessArea, hasRole, requireRole } from "@/lib/auth/permissions";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { auditRepository } from "@/repositories/audit.repository";
import { toSafeUser, userRepository } from "@/repositories/user.repository";
import type { CurrentUser } from "@/types/domain";

export const userService = {
  async list(
    actor: CurrentUser,
    params: {
      page: number;
      pageSize: number;
      search?: string;
      areaId?: string;
      role?: RoleName;
      isActive?: boolean;
    },
  ) {
    requireRole(actor, "MANAGER");

    if (params.areaId && !canAccessArea(actor, params.areaId)) {
      throw new ForbiddenError("You cannot access users in this area");
    }

    const effectiveAreaId =
      params.areaId ?? (hasRole(actor, "ADMIN") ? undefined : actor.areaIds[0]);

    const [total, users] = await userRepository.list({
      ...params,
      organizationId: actor.organizationId,
      areaId: effectiveAreaId,
    });

    return {
      items: users.map(toSafeUser),
      total,
      page: params.page,
      pageSize: params.pageSize,
    };
  },

  async create(
    actor: CurrentUser,
    input: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string;
      roles: RoleName[];
      areaIds: string[];
    },
  ) {
    requireRole(actor, "ADMIN");

    const user = await userRepository.create({
      organization: { connect: { id: actor.organizationId } },
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      passwordHash: await hashPassword(input.password),
      roles: {
        create: input.roles.map((name) => ({
          role: { connect: { name } },
        })),
      },
      userAreas: {
        create: input.areaIds.map((areaId) => ({
          area: { connect: { id: areaId } },
        })),
      },
    });

    await auditRepository.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: AuditAction.CREATE,
      entityType: "User",
      entityId: user.id,
    });

    return toSafeUser(user);
  },

  async update(
    actor: CurrentUser,
    userId: string,
    input: {
      email?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      isActive?: boolean;
      roles?: RoleName[];
      areaIds?: string[];
    },
  ) {
    requireRole(actor, "ADMIN");

    const existing = await userRepository.findById(userId);

    if (!existing || existing.organizationId !== actor.organizationId) {
      throw new NotFoundError("User not found");
    }

    let user = await userRepository.update(userId, {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      isActive: input.isActive,
    });

    if (input.roles) {
      user = (await userRepository.replaceRoles(userId, input.roles)) ?? user;
    }

    if (input.areaIds) {
      user = (await userRepository.replaceAreas(userId, input.areaIds)) ?? user;
      await auditRepository.record({
        organizationId: actor.organizationId,
        actorId: actor.id,
        action: AuditAction.ASSIGN_AREA,
        entityType: "User",
        entityId: userId,
        metadata: { areaIds: input.areaIds },
      });
    }

    await auditRepository.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: AuditAction.UPDATE,
      entityType: "User",
      entityId: userId,
    });

    return toSafeUser(user);
  },
};
