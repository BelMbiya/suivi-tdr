import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const areaRepository = {
  list(params: {
    organizationId: string;
    page: number;
    pageSize: number;
    search?: string;
    isActive?: boolean;
  }) {
    const where: Prisma.AreaWhereInput = {
      organizationId: params.organizationId,
      isActive: params.isActive,
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" } },
              { code: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    return Promise.all([
      prisma.area.count({ where }),
      prisma.area.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);
  },

  findById(id: string) {
    return prisma.area.findUnique({ where: { id } });
  },

  findUserAreas(userId: string) {
    return prisma.userArea.findMany({
      where: { userId, area: { isActive: true } },
      include: { area: true },
    });
  },

  create(data: Prisma.AreaCreateInput) {
    return prisma.area.create({ data });
  },

  update(id: string, data: Prisma.AreaUpdateInput) {
    return prisma.area.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.area.update({ where: { id }, data: { isActive: false } });
  },
};
