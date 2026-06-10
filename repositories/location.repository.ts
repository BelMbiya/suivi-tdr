import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const locationRepository = {
  list(params: {
    organizationId: string;
    page: number;
    pageSize: number;
    search?: string;
    areaId?: string;
    userId?: string;
    areaIds?: string[];
    from?: Date;
    to?: Date;
    order?: "asc" | "desc";
  }) {
    const areaFilter = params.areaId
      ? {
          OR: [
            { areaId: params.areaId },
            { user: { userAreas: { some: { areaId: params.areaId } } } },
          ],
        }
      : params.areaIds
        ? { areaId: { in: params.areaIds } }
        : undefined;

    const where: Prisma.LocationWhereInput = {
      organizationId: params.organizationId,
      userId: params.userId,
      ...(areaFilter ? { AND: [areaFilter] } : {}),
      recordedAt:
        params.from || params.to
          ? { gte: params.from, lte: params.to }
          : undefined,
      ...(params.search
        ? {
            OR: [
              { user: { email: { contains: params.search, mode: "insensitive" } } },
              { user: { firstName: { contains: params.search, mode: "insensitive" } } },
              { user: { lastName: { contains: params.search, mode: "insensitive" } } },
              { area: { name: { contains: params.search, mode: "insensitive" } } },
              { area: { code: { contains: params.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    return Promise.all([
      prisma.location.count({ where }),
      prisma.location.findMany({
        where,
        include: { user: true, area: true, device: true },
        orderBy: { recordedAt: params.order ?? "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);
  },

  findById(id: string) {
    return prisma.location.findUnique({
      where: { id },
      include: { user: true, area: true, device: true },
    });
  },

  create(data: Prisma.LocationUncheckedCreateInput) {
    return prisma.location.create({
      data,
      include: { user: true, area: true, device: true },
    });
  },

  listHistory(params: {
    organizationId: string;
    userId: string;
    from: Date;
    to: Date;
    page: number;
    pageSize: number;
    areaId?: string;
    areaIds?: string[];
  }) {
    const where: Prisma.LocationWhereInput = {
      organizationId: params.organizationId,
      userId: params.userId,
      recordedAt: { gte: params.from, lte: params.to },
      areaId: params.areaId ?? (params.areaIds ? { in: params.areaIds } : undefined),
    };

    return Promise.all([
      prisma.location.count({ where }),
      prisma.location.findMany({
        where,
        orderBy: { recordedAt: "asc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);
  },

  latestByUsers(params: {
    organizationId: string;
    areaId?: string;
    areaIds?: string[];
  }) {
    return prisma.location.findMany({
      where: {
        organizationId: params.organizationId,
        areaId: params.areaId ?? (params.areaIds ? { in: params.areaIds } : undefined),
      },
      distinct: ["userId"],
      orderBy: [{ userId: "asc" }, { recordedAt: "desc" }],
      include: {
        user: true,
        area: true,
      },
    });
  },

  countToday(organizationId: string, areaId?: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    return prisma.location.count({
      where: {
        organizationId,
        areaId,
        receivedAt: { gte: start },
      },
    });
  },

  delete(id: string) {
    return prisma.location.delete({ where: { id } });
  },
};
