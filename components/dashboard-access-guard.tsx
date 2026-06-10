"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { hasRole } from "@/lib/auth/permissions";
import { api } from "@/lib/http";
import type { CurrentUser } from "@/types/domain";

const MANAGER_PREFIXES = [
  "/dashboard",
  "/users",
  "/areas",
  "/devices",
  "/map",
  "/locations",
  "/history",
  "/geofences",
  "/geofence-events",
  "/audit-logs",
];

function isFieldUser(user: CurrentUser) {
  return user.roles.length > 0 && user.roles.every((role) => role === "USER");
}

export function DashboardAccessGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: user, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api<CurrentUser>("/api/auth/me"),
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (isLoading || !user) {
      return;
    }

    const needsManager = MANAGER_PREFIXES.some((prefix) => pathname.startsWith(prefix));

    if (needsManager && !hasRole(user, "MANAGER")) {
      router.replace("/track");
      return;
    }

    if (pathname.startsWith("/audit-logs") && !hasRole(user, "ADMIN")) {
      router.replace("/dashboard");
    }
  }, [isLoading, pathname, router, user]);

  return children;
}
