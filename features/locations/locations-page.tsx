"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DatePeriodFilter } from "@/components/filters/date-period-filter";
import { RowActions } from "@/components/crud/row-actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/http";
import {
  buildLocationSearchParams,
  defaultCustomRange,
  type LocationPeriod,
} from "@/utils/date-period";

type LocationItem = {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  speed?: number | null;
  batteryLevel?: number | null;
  areaStatus: string;
  recordedAt: string;
  user: { email: string; firstName: string; lastName: string };
  area?: { name: string; code: string } | null;
};

type Paginated<T> = { items: T[]; total: number };

export function LocationsPage() {
  const [search, setSearch] = useState("");
  const defaultRange = defaultCustomRange();
  const [period, setPeriod] = useState<LocationPeriod>("today");
  const [customFrom, setCustomFrom] = useState(defaultRange.from);
  const [customTo, setCustomTo] = useState(defaultRange.to);
  const [deleteTarget, setDeleteTarget] = useState<LocationItem | null>(null);
  const queryClient = useQueryClient();

  const queryString = useMemo(
    () =>
      buildLocationSearchParams({
        mode: "all",
        pageSize: 100,
        search,
        period,
        customFrom,
        customTo,
      }).toString(),
    [customFrom, customTo, period, search],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["locations", queryString],
    queryFn: () => api<Paginated<LocationItem>>(`/api/locations?${queryString}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (location: LocationItem) =>
      api(`/api/locations/${location.id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      setDeleteTarget(null);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
        <p className="mt-2 text-zinc-500">Positions GPS reçues et statut Area.</p>
      </div>
      <Input
        placeholder="Search by user name, email or area"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <DatePeriodFilter
        period={period}
        customFrom={customFrom}
        customTo={customTo}
        onPeriodChange={setPeriod}
        onCustomFromChange={setCustomFrom}
        onCustomToChange={setCustomTo}
      />
      <p className="text-sm text-zinc-500">
        {isLoading ? "Chargement..." : `${data?.total ?? 0} position(s) sur la période`}
      </p>
      <Card className="overflow-x-auto p-0">
        <table className="min-w-[1040px] w-full text-left text-sm">
          <thead className="border-b bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Area</th>
              <th className="px-4 py-3">Coordinates</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Recorded</th>
              <th className="px-4 py-3">Map</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-4 py-6" colSpan={7}>
                  Loading locations...
                </td>
              </tr>
            ) : (
              data?.items.map((location) => (
                <tr key={location.id} className="border-b last:border-0">
                  <td className="px-4 py-3">{location.user.email}</td>
                  <td className="px-4 py-3">{location.area?.code ?? "-"}</td>
                  <td className="px-4 py-3">
                    {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={
                        location.areaStatus === "IN_AREA"
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }
                    >
                      {location.areaStatus}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{new Date(location.recordedAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <Link
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50"
                      href={`/map?locationId=${location.id}&userId=${location.userId}`}
                    >
                      Voir sur carte
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <RowActions onDelete={() => setDeleteTarget(location)} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Supprimer la position"
        message={`Voulez-vous supprimer la position de ${deleteTarget?.user.email} ?`}
        confirmLabel="Supprimer"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
