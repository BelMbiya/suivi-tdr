import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const logRepository = {
  auditLogs(params: {
    organizationId: string;
    page: number;
    pageSize: number;
    search?: string;
    actorId?: string;
    entityType?: string;
  }) {
    const where: Prisma.AuditLogWhereInput = {
      organizationId: params.organizationId,
      actorId: params.actorId,
      entityType: params.entityType,
      ...(params.search
        ? {
            OR: [
              { entityType: { contains: params.search, mode: "insensitive" } },
              { entityId: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    return Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: { actor: true },
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);
  },

  geofenceEvents(params: {
    organizationId: string;
    page: number;
    pageSize: number;
    search?: string;
    userId?: string;
    geofenceId?: string;
    areaId?: string;
  }) {
    const where: Prisma.GeofenceEventWhereInput = {
      organizationId: params.organizationId,
      userId: params.userId,
      geofenceId: params.geofenceId,
      geofence: params.areaId ? { areaId: params.areaId } : undefined,
      ...(params.search
        ? {
            OR: [
              { user: { email: { contains: params.search, mode: "insensitive" } } },
              { user: { firstName: { contains: params.search, mode: "insensitive" } } },
              { user: { lastName: { contains: params.search, mode: "insensitive" } } },
              { geofence: { name: { contains: params.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    return Promise.all([
      prisma.geofenceEvent.count({ where }),
      prisma.geofenceEvent.findMany({
        where,
        include: { user: true, geofence: { include: { area: true } } },
        orderBy: { occurredAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);
  },
};
