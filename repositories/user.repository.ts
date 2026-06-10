import { Prisma, RoleName } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const userInclude = {
  roles: { include: { role: true } },
  userAreas: { include: { area: true } },
} satisfies Prisma.UserInclude;

export type UserWithAccess = Prisma.UserGetPayload<{ include: typeof userInclude }>;

export const userRepository = {
  findByEmail(organizationId: string, email: string) {
    return prisma.user.findUnique({
      where: { organizationId_email: { organizationId, email } },
      include: userInclude,
    });
  },

  findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: userInclude,
    });
  },

  list(params: {
    organizationId: string;
    page: number;
    pageSize: number;
    search?: string;
    areaId?: string;
    role?: RoleName;
    isActive?: boolean;
  }) {
    const where: Prisma.UserWhereInput = {
      organizationId: params.organizationId,
      isActive: params.isActive,
      ...(params.search
        ? {
            OR: [
              { email: { contains: params.search, mode: "insensitive" } },
              { firstName: { contains: params.search, mode: "insensitive" } },
              { lastName: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(params.areaId
        ? { userAreas: { some: { areaId: params.areaId } } }
        : {}),
      ...(params.role ? { roles: { some: { role: { name: params.role } } } } : {}),
    };

    return Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        include: userInclude,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);
  },

  create(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data, include: userInclude });
  },

  update(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({ where: { id }, data, include: userInclude });
  },

  async replaceRoles(userId: string, roles: RoleName[]) {
    const dbRoles = await prisma.role.findMany({ where: { name: { in: roles } } });

    await prisma.$transaction([
      prisma.userRole.deleteMany({ where: { userId } }),
      ...dbRoles.map((role) =>
        prisma.userRole.create({ data: { userId, roleId: role.id } }),
      ),
    ]);

    return this.findById(userId);
  },

  async replaceAreas(userId: string, areaIds: string[]) {
    await prisma.$transaction([
      prisma.userArea.deleteMany({ where: { userId } }),
      ...areaIds.map((areaId) =>
        prisma.userArea.create({ data: { userId, areaId } }),
      ),
    ]);

    return this.findById(userId);
  },
};

export function toSafeUser(user: UserWithAccess) {
  return {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    roles: user.roles.map(({ role }) => role.name),
    areas: user.userAreas.map(({ area }) => ({
      id: area.id,
      name: area.name,
      code: area.code,
    })),
  };
}
