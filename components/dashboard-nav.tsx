"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Crosshair,
  Database,
  Map,
  MapPinned,
  MonitorSmartphone,
  ScrollText,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/lib/http";
import { hasRole } from "@/lib/auth/permissions";
import type { CurrentUser, RoleName } from "@/types/domain";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  minRole: RoleName;
};

const navigation: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Activity, minRole: "MANAGER" },
  { href: "/track", label: "Mon suivi", icon: Crosshair, minRole: "USER" },
  { href: "/users", label: "Users", icon: Users, minRole: "MANAGER" },
  { href: "/areas", label: "Areas", icon: MapPinned, minRole: "MANAGER" },
  { href: "/devices", label: "Devices", icon: MonitorSmartphone, minRole: "MANAGER" },
  { href: "/map", label: "Live Map", icon: Map, minRole: "MANAGER" },
  { href: "/locations", label: "Locations", icon: Database, minRole: "MANAGER" },
  { href: "/history", label: "History", icon: Activity, minRole: "MANAGER" },
  { href: "/geofences", label: "Geofences", icon: Shield, minRole: "MANAGER" },
  { href: "/geofence-events", label: "Events", icon: Activity, minRole: "MANAGER" },
  { href: "/audit-logs", label: "Audit Logs", icon: ScrollText, minRole: "ADMIN" },
];

function isFieldUser(user: CurrentUser) {
  return user.roles.length > 0 && user.roles.every((role) => role === "USER");
}

export function visibleNavigation(
  user: CurrentUser | undefined,
  isLoading: boolean,
) {
  if (isLoading || !user) {
    return [];
  }

  if (isFieldUser(user)) {
    return navigation.filter((item) => item.href === "/track");
  }

  return navigation.filter((item) => hasRole(user, item.minRole));
}

function navClassName(isActive: boolean, mobile = false) {
  if (mobile) {
    return `flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium ${
      isActive
        ? "border-zinc-300 bg-zinc-100 text-zinc-950"
        : "border-zinc-200 bg-white text-zinc-600"
    }`;
  }

  return `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
    isActive
      ? "bg-zinc-100 font-semibold text-zinc-950"
      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
  }`;
}

export function DashboardNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const { data: user, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api<CurrentUser>("/api/auth/me"),
    retry: false,
    staleTime: 60_000,
  });

  const items = visibleNavigation(user, isLoading);

  if (isLoading) {
    return (
      <p className={mobile ? "px-3 py-2 text-xs text-zinc-400" : "px-3 py-2 text-sm text-zinc-400"}>
        Chargement du menu...
      </p>
    );
  }

  if (!items.length) {
    return null;
  }

  return (
    <>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={navClassName(isActive, mobile)}
          >
            <Icon
              className={mobile ? "h-3.5 w-3.5 shrink-0" : "h-4 w-4 shrink-0"}
              aria-hidden="true"
            />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </>
  );
}
