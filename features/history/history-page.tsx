"use client";

import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/http";

type HistoryResult = {
  items: { id: string; latitude: number; longitude: number; recordedAt: string }[];
  total: number;
  stats: {
    distanceMeters: number;
    averageSpeed: number;
    maxSpeed: number;
  };
};

export function HistoryPage() {
  const [query, setQuery] = useState<string | null>(null);
  const { data, isFetching } = useQuery({
    queryKey: ["history", query],
    queryFn: () => api<HistoryResult>(`/api/locations/history?${query}`),
    enabled: Boolean(query),
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams({
      userId: String(form.get("userId")),
      from: String(form.get("from")),
      to: String(form.get("to")),
      page: "1",
      pageSize: "100",
    });
    setQuery(params.toString());
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">History</h1>
        <p className="mt-2 text-zinc-500">
          Analyse des trajets par utilisateur et période.
        </p>
      </div>
      <Card>
        <form className="grid gap-4 md:grid-cols-4" onSubmit={onSubmit}>
          <Input name="userId" placeholder="User UUID" required />
          <Input name="from" type="datetime-local" required />
          <Input name="to" type="datetime-local" required />
          <Button disabled={isFetching}>Analyser</Button>
        </form>
      </Card>
      {data ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardTitle>Distance</CardTitle>
            <p className="mt-4 text-3xl font-bold">
              {(data.stats.distanceMeters / 1000).toFixed(2)} km
            </p>
          </Card>
          <Card>
            <CardTitle>Average speed</CardTitle>
            <p className="mt-4 text-3xl font-bold">
              {data.stats.averageSpeed.toFixed(1)}
            </p>
          </Card>
          <Card>
            <CardTitle>Max speed</CardTitle>
            <p className="mt-4 text-3xl font-bold">
              {data.stats.maxSpeed.toFixed(1)}
            </p>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
