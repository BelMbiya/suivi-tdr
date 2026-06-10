"use client";

import { FormEvent, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { RowActions } from "@/components/crud/row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  boundaryToFormValues,
  buildAreaBoundaryFromCenter,
  formatRadiusLabel,
  isAreaBoundary,
  radiusFormValueToKm,
  type AreaBoundary,
  type RadiusUnit,
} from "@/features/map/map-utils";
import { api } from "@/lib/http";

type Area = {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  boundary?: AreaBoundary | null;
  isActive: boolean;
};

type Paginated<T> = { items: T[]; total: number };

type AreaForm = {
  name: string;
  code: string;
  description: string;
  centerLat: string;
  centerLng: string;
  radius: string;
  radiusUnit: RadiusUnit;
  isActive: boolean;
};

const defaultCoords = boundaryToFormValues(null);

const emptyForm: AreaForm = {
  name: "",
  code: "",
  description: "",
  ...defaultCoords,
  isActive: true,
};

export function AreasPage() {
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Area | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["areas", search],
    queryFn: () => api<Paginated<Area>>(`/api/areas?search=${encodeURIComponent(search)}`),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const centerLat = Number(form.centerLat);
      const centerLng = Number(form.centerLng);
      const radiusValue = Number(form.radius);
      const radiusKm = radiusFormValueToKm(radiusValue, form.radiusUnit);
      const minRadiusKm = form.radiusUnit === "m" ? 0.001 : 0.001;

      if (
        Number.isNaN(centerLat) ||
        Number.isNaN(centerLng) ||
        Number.isNaN(radiusValue) ||
        centerLat < -90 ||
        centerLat > 90 ||
        centerLng < -180 ||
        centerLng > 180 ||
        radiusValue <= 0 ||
        radiusKm < minRadiusKm
      ) {
        throw new Error(
          form.radiusUnit === "m"
            ? "Le rayon doit être d'au moins 1 mètre."
            : "Le rayon doit être supérieur à 0.",
        );
      }

      const boundary = buildAreaBoundaryFromCenter(centerLat, centerLng, radiusKm);
      const payload = {
        name: form.name,
        code: form.code.toUpperCase(),
        description: form.description || undefined,
        boundary,
        ...(editingArea ? { isActive: form.isActive } : {}),
      };

      if (editingArea) {
        return api(`/api/areas/${editingArea.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }

      return api("/api/areas", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas"] });
      closeModal();
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (area: Area) =>
      api(`/api/areas/${area.id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas"] });
      setDeleteTarget(null);
    },
  });

  function openCreateModal() {
    setEditingArea(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEditModal(area: Area) {
    const coords = boundaryToFormValues(
      isAreaBoundary(area.boundary) ? area.boundary : null,
    );

    setEditingArea(area);
    setForm({
      name: area.name,
      code: area.code,
      description: area.description ?? "",
      ...coords,
      isActive: area.isActive,
    });
    setError("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingArea(null);
    setForm(emptyForm);
    setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    saveMutation.mutate();
  }

  function handleRadiusUnitChange(nextUnit: RadiusUnit) {
    const currentKm = radiusFormValueToKm(Number(form.radius) || 0, form.radiusUnit);

    if (nextUnit === "m") {
      setForm({
        ...form,
        radiusUnit: "m",
        radius: String(Math.max(1, Math.round((currentKm || 0.001) * 1000))),
      });
      return;
    }

    setForm({
      ...form,
      radiusUnit: "km",
      radius: (currentKm || 1).toFixed(2),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Areas</h1>
          <p className="mt-2 text-zinc-500">
            Périmètres opérationnels qui gouvernent le tracking.
          </p>
        </div>
        <Button type="button" onClick={openCreateModal}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle zone
        </Button>
      </div>

      <Input
        placeholder="Search by area name or code"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? <Card>Loading areas...</Card> : null}
        {data?.items.map((area) => {
          const coords = isAreaBoundary(area.boundary)
            ? boundaryToFormValues(area.boundary)
            : null;

          return (
            <Card key={area.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitleLike>{area.name}</CardTitleLike>
                  <p className="mt-1 text-sm text-zinc-500">{area.code}</p>
                </div>
                <Badge
                  className={
                    area.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }
                >
                  {area.isActive ? "Active" : "Disabled"}
                </Badge>
              </div>
              <p className="mt-4 text-sm text-zinc-600">
                {area.description || "No description"}
              </p>
              {coords ? (
                <p className="mt-2 text-xs text-zinc-500">
                  Centre : {coords.centerLat}, {coords.centerLng} · Rayon{" "}
                  {formatRadiusLabel(
                    radiusFormValueToKm(Number(coords.radius), coords.radiusUnit),
                  )}
                </p>
              ) : (
                <p className="mt-2 text-xs text-amber-600">Aucun périmètre défini</p>
              )}
              <div className="mt-4">
                <RowActions
                  onEdit={() => openEditModal(area)}
                  onDelete={area.isActive ? () => setDeleteTarget(area) : undefined}
                />
              </div>
            </Card>
          );
        })}
      </div>

      <Modal
        open={modalOpen}
        title={editingArea ? "Modifier la zone" : "Créer une zone"}
        onClose={closeModal}
        className="max-w-xl"
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            placeholder="Nom de la zone"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
          />
          <Input
            placeholder="Code (ex: AREA-011)"
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value })}
            required
          />
          <Input
            placeholder="Description (optionnel)"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm font-semibold text-zinc-950">Coordonnées du périmètre</p>
            <p className="mt-1 text-xs text-zinc-500">
              Définissez le centre de la zone et son rayon. Un rectangle sera généré pour la carte.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-xs font-medium text-zinc-700">
                Latitude
                <Input
                  type="number"
                  step="any"
                  min={-90}
                  max={90}
                  placeholder="-4.325"
                  value={form.centerLat}
                  onChange={(event) => setForm({ ...form, centerLat: event.target.value })}
                  required
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-zinc-700">
                Longitude
                <Input
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                  placeholder="15.312"
                  value={form.centerLng}
                  onChange={(event) => setForm({ ...form, centerLng: event.target.value })}
                  required
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-zinc-700">
                Rayon
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step={form.radiusUnit === "m" ? "1" : "0.01"}
                    min={form.radiusUnit === "m" ? 1 : 0.001}
                    placeholder={form.radiusUnit === "m" ? "500" : "2"}
                    value={form.radius}
                    onChange={(event) => setForm({ ...form, radius: event.target.value })}
                    required
                    className="min-w-0 flex-1"
                  />
                  <select
                    className="h-10 shrink-0 rounded-lg border border-zinc-200 bg-white px-2 text-sm"
                    value={form.radiusUnit}
                    onChange={(event) =>
                      handleRadiusUnitChange(event.target.value as RadiusUnit)
                    }
                  >
                    <option value="m">m</option>
                    <option value="km">km</option>
                  </select>
                </div>
              </label>
            </div>
          </div>

          {editingArea ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
              />
              Zone active
            </label>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Annuler
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Enregistrement..." : editingArea ? "Mettre à jour" : "Créer"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Désactiver la zone"
        message={`Voulez-vous désactiver la zone ${deleteTarget?.code} ?`}
        confirmLabel="Désactiver"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function CardTitleLike({ children }: { children: ReactNode }) {
  return <h2 className="text-lg font-semibold">{children}</h2>;
}
