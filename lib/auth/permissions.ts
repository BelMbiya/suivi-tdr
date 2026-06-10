import { ForbiddenError } from "@/lib/errors";
import type { CurrentUser, RoleName } from "@/types/domain";

const ROLE_RANK: Record<RoleName, number> = {
  USER: 1,
  MANAGER: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

export function hasRole(user: CurrentUser, role: RoleName) {
  return user.roles.some((currentRole) => ROLE_RANK[currentRole] >= ROLE_RANK[role]);
}

export function requireRole(user: CurrentUser, role: RoleName) {
  if (!hasRole(user, role)) {
    throw new ForbiddenError();
  }
}

export function canAccessArea(user: CurrentUser, areaId: string) {
  if (hasRole(user, "ADMIN")) {
    return true;
  }

  return user.areaIds.includes(areaId);
}

export function requireAreaAccess(user: CurrentUser, areaId: string) {
  if (!canAccessArea(user, areaId)) {
    throw new ForbiddenError("You do not have access to this area");
  }
}
