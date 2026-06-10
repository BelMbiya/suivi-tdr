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

type Device = {
  id: string;
  name: string;
  platform: string;
  externalId?: string | null;
  isActive: boolean;
  userId: string;
  user: { email: string; firstName: string; lastName: string };
};

type UserOption = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

type Paginated<T> = { items: T[]; total: number };

const emptyForm = {
  userId: "",
  name: "",
  platform: "WEB",
  externalId: "",
  isActive: true,
};

export function DevicesPage() {
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["devices", search],
    queryFn: () =>
      api<Paginated<Device>>(`/api/devices?search=${encodeURIComponent(search)}`),
  });

  const { data: users } = useQuery({
    queryKey: ["users", "devices-form"],
    queryFn: () => api<Paginated<UserOption>>("/api/users?pageSize=100"),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        userId: form.userId,
        name: form.name,
        platform: form.platform,
        externalId: form.externalId || undefined,
        ...(editingDevice ? { isActive: form.isActive } : {}),
      };

      if (editingDevice) {
        return api(`/api/devices/${editingDevice.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }

      return api("/api/devices", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      closeModal();
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (device: Device) =>
      api(`/api/devices/${device.id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      setDeleteTarget(null);
    },
  });

  function openCreateModal() {
    setEditingDevice(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEditModal(device: Device) {
    setEditingDevice(device);
    setForm({
      userId: device.userId,
      name: device.name,
      platform: device.platform,
      externalId: device.externalId ?? "",
      isActive: device.isActive,
    });
    setError("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingDevice(null);
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
          <h1 className="text-3xl font-bold tracking-tight">Devices</h1>
          <p className="mt-2 text-zinc-500">Terminaux rattachés aux utilisateurs trackés.</p>
        </div>
        <Button type="button" onClick={openCreateModal}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvel appareil
        </Button>
      </div>

      <Input
        placeholder="Search by device, user name, email or external id"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <Card className="overflow-x-auto p-0">
        <table className="min-w-[860px] w-full text-left text-sm">
          <thead className="border-b bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3">Device</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-4 py-6" colSpan={5}>
                  Loading devices...
                </td>
              </tr>
            ) : (
              data?.items.map((device) => (
                <tr key={device.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{device.name}</div>
                    <div className="text-zinc-500">{device.externalId ?? "-"}</div>
                  </td>
                  <td className="px-4 py-3">{device.user.email}</td>
                  <td className="px-4 py-3">{device.platform}</td>
                  <td className="px-4 py-3">
                    <Badge
                      className={
                        device.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }
                    >
                      {device.isActive ? "Active" : "Disabled"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <RowActions
                      onEdit={() => openEditModal(device)}
                      onDelete={device.isActive ? () => setDeleteTarget(device) : undefined}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <Modal
        open={modalOpen}
        title={editingDevice ? "Modifier l'appareil" : "Créer un appareil"}
        onClose={closeModal}
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <select
            className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm"
            value={form.userId}
            onChange={(event) => setForm({ ...form, userId: event.target.value })}
            required
            disabled={Boolean(editingDevice)}
          >
            <option value="">Sélectionner un utilisateur</option>
            {users?.items.map((user) => (
              <option key={user.id} value={user.id}>
                {user.firstName} {user.lastName} ({user.email})
              </option>
            ))}
          </select>
          <Input
            placeholder="Nom de l'appareil"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
          />
          <Input
            placeholder="Plateforme (WEB, ANDROID, IOS)"
            value={form.platform}
            onChange={(event) => setForm({ ...form, platform: event.target.value })}
            required
          />
          <Input
            placeholder="External ID (optionnel)"
            value={form.externalId}
            onChange={(event) => setForm({ ...form, externalId: event.target.value })}
          />
          {editingDevice ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
              />
              Appareil actif
            </label>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Annuler
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Enregistrement..." : editingDevice ? "Mettre à jour" : "Créer"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Désactiver l'appareil"
        message={`Voulez-vous désactiver ${deleteTarget?.name} ?`}
        confirmLabel="Désactiver"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
