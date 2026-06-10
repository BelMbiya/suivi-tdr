"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/http";
import type { CurrentUser } from "@/types/domain";

type AuthMe = CurrentUser & {
  firstName: string;
  lastName: string;
};

function formatUserName(user: AuthMe) {
  const fullName = `${user.firstName} ${user.lastName}`.trim();
  return fullName || user.email;
}

export function NavUser({ compact = false }: { compact?: boolean }) {
  const { data: user } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api<AuthMe>("/api/auth/me"),
    staleTime: 60_000,
  });

  if (!user) {
    return null;
  }

  const name = formatUserName(user);

  if (compact) {
    return (
      <p className="max-w-[10rem] truncate text-xs font-medium text-zinc-700" title={name}>
        {name}
      </p>
    );
  }

  return (
    <div className="mb-3 min-w-0">
      <p className="truncate text-sm font-semibold text-zinc-950" title={name}>
        {name}
      </p>
      <p className="truncate text-xs text-zinc-500" title={user.email}>
        {user.email}
      </p>
    </div>
  );
}
