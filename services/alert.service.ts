import { LocationAreaStatus, RoleName } from "@/generated/prisma/client";
import { hasRole, requireAreaAccess, requireRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/types/domain";
import type { ManagerAlert } from "@/types/alerts";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function userLabel(firstName: string, lastName: string, email: string) {
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || email;
}

export const alertService = {
  async list(actor: CurrentUser, areaId?: string) {
    requireRole(actor, "MANAGER");

    if (areaId) {
      requireAreaAccess(actor, areaId);
    }

    const now = Date.now();
    const threeDaysAgo = new Date(now - THREE_DAYS_MS);
    const oneDayAgo = new Date(now - ONE_DAY_MS);

    const users = await prisma.user.findMany({
      where: {
        organizationId: actor.organizationId,
        isActive: true,
        roles: { some: { role: { name: RoleName.USER } } },
        userAreas:
          areaId || !hasRole(actor, "ADMIN")
            ? {
                some: {
                  areaId: areaId ?? { in: actor.areaIds },
                },
              }
            : { some: {} },
      },
      include: {
        userAreas: { include: { area: true } },
        locations: {
          orderBy: { recordedAt: "desc" },
          take: 1,
        },
      },
    });

    const userIds = users.map((user) => user.id);
    const recentLocations = await prisma.location.findMany({
      where: {
        organizationId: actor.organizationId,
        userId: { in: userIds },
        recordedAt: { gte: oneDayAgo },
      },
      orderBy: { recordedAt: "asc" },
    });

    const locationsByUser = recentLocations.reduce<Record<string, typeof recentLocations>>(
      (groups, location) => {
        groups[location.userId] = [...(groups[location.userId] ?? []), location];
        return groups;
      },
      {},
    );

    const alerts: ManagerAlert[] = [];

    for (const user of users) {
      const label = userLabel(user.firstName, user.lastName, user.email);
      const areaCodes = user.userAreas.map(({ area }) => area.code);
      const lastLocation = user.locations[0] ?? null;
      const lastSeenAt = lastLocation?.recordedAt?.toISOString() ?? null;

      if (!lastLocation || lastLocation.recordedAt < threeDaysAgo) {
        alerts.push({
          type: "POSITION_NOT_DETECTED",
          userId: user.id,
          userName: label,
          userEmail: user.email,
          message: `La position de ${label} n'a pas été détectée depuis 3 jours. Contactez-le.`,
          severity: "critical",
          lastSeenAt,
          areaCodes,
        });
        continue;
      }

      const dayLocations = locationsByUser[user.id] ?? [];
      if (
        dayLocations.length > 0 &&
        dayLocations.every((location) => location.areaStatus === LocationAreaStatus.OUT_OF_AREA)
      ) {
        alerts.push({
          type: "ABSENCE_OUT_OF_AREA",
          userId: user.id,
          userName: label,
          userEmail: user.email,
          message: `Cas d'absence : ${label} est détecté mais hors de sa zone depuis 24h.`,
          severity: "warning",
          lastSeenAt,
          areaCodes,
        });
      }
    }

    return alerts.sort((a, b) => {
      if (a.severity === b.severity) {
        return a.userName.localeCompare(b.userName);
      }
      return a.severity === "critical" ? -1 : 1;
    });
  },
};
