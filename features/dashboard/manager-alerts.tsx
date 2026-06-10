"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/http";
import type { ManagerAlert } from "@/types/alerts";

export function ManagerAlerts() {
  const { data, isLoading } = useQuery({
    queryKey: ["manager-alerts"],
    queryFn: () => api<ManagerAlert[]>("/api/alerts"),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardTitle>Alertes managers</CardTitle>
        <p className="mt-4 text-sm text-zinc-500">Chargement des alertes...</p>
      </Card>
    );
  }

  if (!data?.length) {
    return (
      <Card>
        <CardTitle>Alertes managers</CardTitle>
        <p className="mt-4 text-sm text-zinc-500">Aucune alerte active pour le moment.</p>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <CardTitle>Alertes managers</CardTitle>
        <Badge>{data.length}</Badge>
      </div>
      <div className="space-y-3">
        {data.map((alert) => (
          <div
            key={`${alert.type}-${alert.userId}`}
            className={`rounded-xl border p-4 ${
              alert.severity === "critical"
                ? "border-red-200 bg-red-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-medium text-zinc-950">{alert.message}</p>
              <Badge
                className={
                  alert.severity === "critical"
                    ? "bg-red-600 text-white"
                    : "bg-amber-500 text-white"
                }
              >
                {alert.type === "POSITION_NOT_DETECTED" ? "Silence GPS" : "Absence"}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-zinc-600">
              {alert.userEmail} · Zones : {alert.areaCodes.join(", ") || "-"}
              {alert.lastSeenAt
                ? ` · Dernière détection : ${new Date(alert.lastSeenAt).toLocaleString()}`
                : " · Aucune position enregistrée"}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
