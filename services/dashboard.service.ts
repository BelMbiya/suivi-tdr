import { getRedis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { requireAreaAccess, requireRole } from "@/lib/auth/permissions";
import { locationRepository } from "@/repositories/location.repository";
import type { CurrentUser } from "@/types/domain";

export const dashboardService = {
  async overview(actor: CurrentUser, areaId?: string) {
    requireRole(actor, "MANAGER");

    if (areaId) {
      requireAreaAccess(actor, areaId);
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const redis = getRedis();
    const [totalUsers, activeTodayUsers, positionsToday, areasCount, onlineUsers] =
      await Promise.all([
        prisma.user.count({
          where: {
            organizationId: actor.organizationId,
            userAreas: areaId ? { some: { areaId } } : undefined,
          },
        }),
        prisma.location
          .groupBy({
            by: ["userId"],
            where: {
              organizationId: actor.organizationId,
              areaId,
              receivedAt: { gte: start },
            },
          })
          .then((groups) => groups.length),
        locationRepository.countToday(actor.organizationId, areaId),
        prisma.area.count({
          where: { organizationId: actor.organizationId, isActive: true },
        }),
        redis?.scard(`presence:${actor.organizationId}`) ?? Promise.resolve(0),
      ]);

    return {
      totalUsers,
      onlineUsers,
      activeTodayUsers,
      positionsToday,
      areasCount,
    };
  },
};
