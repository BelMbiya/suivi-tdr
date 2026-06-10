import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const geofenceRepository = {
  list(params: {
    organizationId: string;
    page: number;
    pageSize: number;
    search?: string;
    areaId?: string;
    isActive?: boolean;
  }) {
    const where: Prisma.GeofenceWhereInput = {
      organizationId: params.organizationId,
      areaId: params.areaId,
      isActive: params.isActive,
      ...(params.search
        ? { name: { contains: params.search, mode: "insensitive" } }
        : {}),
    };

    return Promise.all([
      prisma.geofence.count({ where }),
      prisma.geofence.findMany({
        where,
        include: { area: true },
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);
  },

  findById(id: string) {
    return prisma.geofence.findUnique({ where: { id } });
  },

  create(data: Prisma.GeofenceUncheckedCreateInput) {
    return prisma.geofence.create({ data });
  },

  update(id: string, data: Prisma.GeofenceUncheckedUpdateInput) {
    return prisma.geofence.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.geofence.update({ where: { id }, data: { isActive: false } });
  },
};
