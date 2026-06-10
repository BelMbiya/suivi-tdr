"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { RowActions } from "@/components/crud/row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/http";
import type { GeofenceType } from "@/types/domain";

type Geofence = {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  areaId?: string | null;
  centerLat?: number | null;
  centerLng?: number | null;
  radiusMeters?: number | null;
  area?: { id: string; name: string; code: string } | null;
};

type AreaOption = { id: string; name: string; code: string };
type Paginated<T> = { items: T[]; total: number };

const emptyForm = {
  name: "",
  areaId: "",
  type: "CIRCLE" as GeofenceType,
  centerLat: "-4.325",
  centerLng: "15.312",
  radiusMeters: "500",
  isActive: true,
};

export function GeofencesPage() {
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGeofence, setEditingGeofence] = useState<Geofence | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Geofence | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["geofences", search],
    queryFn: () =>
      api<Paginated<Geofence>>(`/api/geofences?search=${encodeURIComponent(search)}`),
  });

  const { data: areas } = useQuery({
    queryKey: ["areas", "geofences-form"],
    queryFn: () => api<Paginated<AreaOption>>("/api/areas?pageSize=100"),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        type: form.type,
        areaId: form.areaId || undefined,
        centerLat: Number(form.centerLat),
        centerLng: Number(form.centerLng),
        radiusMeters: Number(form.radiusMeters),
        ...(editingGeofence ? { isActive: form.isActive } : {}),
      };

      if (editingGeofence) {
        return api(`/api/geofences/${editingGeofence.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }

      return api("/api/geofences", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["geofences"] });
      closeModal();
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (geofence: Geofence) =>
      api(`/api/geofences/${geofence.id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["geofences"] });
      setDeleteTarget(null);
    },
  });

  function openCreateModal() {
    setEditingGeofence(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEditModal(geofence: Geofence) {
    setEditingGeofence(geofence);
    setForm({
      name: geofence.name,
      areaId: geofence.areaId ?? geofence.area?.id ?? "",
      type: (geofence.type as GeofenceType) ?? "CIRCLE",
      centerLat: String(geofence.centerLat ?? -4.325),
      centerLng: String(geofence.centerLng ?? 15.312),
      radiusMeters: String(geofence.radiusMeters ?? 500),
      isActive: geofence.isActive,
    });
    setError("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingGeofence(null);
    setForm(emptyForm);
    setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    saveMutation.mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Geofences</h1>
          <p className="mt-2 text-zinc-500">
            Règles d&apos;entrée/sortie déclenchées depuis les positions.
          </p>
        </div>
        <Button type="button" onClick={openCreateModal}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle geofence
        </Button>
      </div>

      <Input
        placeholder="Search by geofence name"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? <Card>Loading geofences...</Card> : null}
        {data?.items.map((geofence) => (
          <Card key={geofence.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{geofence.name}</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {geofence.area?.code ?? "Global"}
                </p>
              </div>
              <Badge>{geofence.type}</Badge>
            </div>
            <Badge
              className={
                geofence.isActive
                  ? "mt-4 bg-green-100 text-green-700"
                  : "mt-4 bg-red-100 text-red-700"
              }
            >
              {geofence.isActive ? "Active" : "Disabled"}
            </Badge>
            <div className="mt-4">
              <RowActions
                onEdit={() => openEditModal(geofence)}
                onDelete={geofence.isActive ? () => setDeleteTarget(geofence) : undefined}
              />
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={modalOpen}
        title={editingGeofence ? "Modifier la geofence" : "Créer une geofence"}
        onClose={closeModal}
        className="max-w-xl"
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            placeholder="Nom"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
          />
          <select
            className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm"
            value={form.areaId}
            onChange={(event) => setForm({ ...form, areaId: event.target.value })}
          >
            <option value="">Zone globale</option>
            {areas?.items.map((area) => (
              <option key={area.id} value={area.id}>
                {area.code} - {area.name}
              </option>
            ))}
          </select>
          <select
            className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm"
            value={form.type}
            onChange={(event) =>
              setForm({ ...form, type: event.target.value as GeofenceType })
            }
          >
            <option value="CIRCLE">Cercle</option>
            <option value="POLYGON">Polygone</option>
          </select>
          {form.type === "CIRCLE" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                placeholder="Latitude"
                value={form.centerLat}
                onChange={(event) => setForm({ ...form, centerLat: event.target.value })}
                required
              />
              <Input
                placeholder="Longitude"
                value={form.centerLng}
                onChange={(event) => setForm({ ...form, centerLng: event.target.value })}
                required
              />
              <Input
                placeholder="Rayon (m)"
                value={form.radiusMeters}
                onChange={(event) => setForm({ ...form, radiusMeters: event.target.value })}
                required
              />
            </div>
          ) : (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Les geofences polygones se modifient via l&apos;API pour le moment. Créez un cercle
              depuis cette interface.
            </p>
          )}
          {editingGeofence ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
              />
              Geofence active
            </label>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Annuler
            </Button>
            <Button type="submit" disabled={saveMutation.isPending || form.type === "POLYGON"}>
              {saveMutation.isPending ? "Enregistrement..." : editingGeofence ? "Mettre à jour" : "Créer"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Désactiver la geofence"
        message={`Voulez-vous désactiver ${deleteTarget?.name} ?`}
        confirmLabel="Désactiver"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
