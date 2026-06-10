import { AuditAction, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const auditRepository = {
  record(data: {
    organizationId?: string | null;
    actorId?: string | null;
    action: AuditAction;
    entityType: string;
    entityId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Prisma.InputJsonValue;
  }) {
    return prisma.auditLog.create({ data });
  },
};
