"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/http";

type EventItem = {
  id: string;
  type: string;
  occurredAt: string;
  user: { email: string };
  geofence: { name: string; area?: { code: string } | null };
};

type Paginated<T> = { items: T[]; total: number };

export function GeofenceEventsPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["geofence-events", search],
    queryFn: () =>
      api<Paginated<EventItem>>(`/api/geofence-events?search=${encodeURIComponent(search)}`),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Geofence Events</h1>
        <p className="mt-2 text-zinc-500">Entrées et sorties déclenchées par les positions.</p>
      </div>
      <Input
        placeholder="Search by user name, email or geofence"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <Card className="overflow-x-auto p-0">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead className="border-b bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Geofence</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td className="px-4 py-6" colSpan={4}>Loading events...</td></tr>
            ) : (
              data?.items.map((event) => (
                <tr key={event.id} className="border-b last:border-0">
                  <td className="px-4 py-3">{event.user.email}</td>
                  <td className="px-4 py-3">
                    {event.geofence.name} ({event.geofence.area?.code ?? "Global"})
                  </td>
                  <td className="px-4 py-3"><Badge>{event.type}</Badge></td>
                  <td className="px-4 py-3">{new Date(event.occurredAt).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
