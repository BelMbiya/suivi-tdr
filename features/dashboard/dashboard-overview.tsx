"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardTitle } from "@/components/ui/card";
import { ManagerAlerts } from "@/features/dashboard/manager-alerts";
import { api } from "@/lib/http";

type DashboardData = {
  totalUsers: number;
  onlineUsers: number;
  activeTodayUsers: number;
  positionsToday: number;
  areasCount: number;
};

const cards: { key: keyof DashboardData; label: string }[] = [
  { key: "totalUsers", label: "Total users" },
  { key: "onlineUsers", label: "Online users" },
  { key: "activeTodayUsers", label: "Active today" },
  { key: "positionsToday", label: "Positions today" },
  { key: "areasCount", label: "Areas" },
];

export function DashboardOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<DashboardData>("/api/dashboard"),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-zinc-500">
          Vue globale des utilisateurs, zones et positions reçues.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.key}>
            <CardTitle>{card.label}</CardTitle>
            <p className="mt-4 text-3xl font-bold">
              {isLoading ? "..." : data?.[card.key] ?? 0}
            </p>
          </Card>
        ))}
      </div>
      <ManagerAlerts />
    </div>
  );
}
