import type { RoleName } from "@/types/domain";
import { hasRole } from "@/lib/auth/permissions";

const MANAGER_ONLY_PREFIXES = [
  "/dashboard",
  "/users",
  "/areas",
  "/map",
  "/history",
  "/geofences",
  "/devices",
  "/locations",
  "/geofence-events",
  "/audit-logs",
];

export function defaultPathForRoles(roles: RoleName[]) {
  const user = { roles, areaIds: [] as string[], id: "", organizationId: "", email: "" };

  if (hasRole(user, "MANAGER")) {
    return "/dashboard";
  }

  return "/track";
}

export function resolvePostLoginPath(roles: RoleName[], next: string | null) {
  const user = { roles, areaIds: [] as string[], id: "", organizationId: "", email: "" };
  const isFieldUser = roles.length === 1 && roles[0] === "USER";

  if (isFieldUser) {
    return "/track";
  }

  if (next && next.startsWith("/") && !next.startsWith("/login")) {
    const needsManager = MANAGER_ONLY_PREFIXES.some((prefix) => next.startsWith(prefix));
    if (!needsManager || hasRole(user, "MANAGER")) {
      return next;
    }
  }

  return defaultPathForRoles(roles);
}
