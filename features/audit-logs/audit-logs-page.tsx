"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/http";

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  createdAt: string;
  actor?: { email: string } | null;
};

type Paginated<T> = { items: T[]; total: number };

export function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", search],
    queryFn: () =>
      api<Paginated<AuditLog>>(`/api/audit-logs?search=${encodeURIComponent(search)}`),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
        <p className="mt-2 text-zinc-500">Journal de sécurité et actions métier.</p>
      </div>
      <Input
        placeholder="Search by entity type or id"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <Card className="overflow-x-auto p-0">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead className="border-b bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td className="px-4 py-6" colSpan={4}>Loading audit logs...</td></tr>
            ) : (
              data?.items.map((log) => (
                <tr key={log.id} className="border-b last:border-0">
                  <td className="px-4 py-3">{log.actor?.email ?? "System"}</td>
                  <td className="px-4 py-3"><Badge>{log.action}</Badge></td>
                  <td className="px-4 py-3">{log.entityType}: {log.entityId ?? "-"}</td>
                  <td className="px-4 py-3">{new Date(log.createdAt).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
