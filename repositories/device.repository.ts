import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const deviceRepository = {
  list(params: {
    organizationId: string;
    page: number;
    pageSize: number;
    search?: string;
    userId?: string;
    isActive?: boolean;
  }) {
    const where: Prisma.DeviceWhereInput = {
      organizationId: params.organizationId,
      userId: params.userId,
      isActive: params.isActive,
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" } },
              { externalId: { contains: params.search, mode: "insensitive" } },
              { user: { email: { contains: params.search, mode: "insensitive" } } },
              { user: { firstName: { contains: params.search, mode: "insensitive" } } },
              { user: { lastName: { contains: params.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    return Promise.all([
      prisma.device.count({ where }),
      prisma.device.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);
  },

  findById(id: string) {
    return prisma.device.findUnique({ where: { id }, include: { user: true } });
  },

  create(data: Prisma.DeviceUncheckedCreateInput) {
    return prisma.device.create({ data, include: { user: true } });
  },

  update(id: string, data: Prisma.DeviceUncheckedUpdateInput) {
    return prisma.device.update({ where: { id }, data, include: { user: true } });
  },

  disable(id: string) {
    return prisma.device.update({
      where: { id },
      data: { isActive: false },
      include: { user: true },
    });
  },
};
