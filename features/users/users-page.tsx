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
import { ROLE_NAMES, type RoleName } from "@/types/domain";

type UserItem = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  isActive: boolean;
  roles: string[];
  areas: { id: string; name: string; code: string }[];
};

type AreaOption = { id: string; name: string; code: string };
type Paginated<T> = { items: T[]; total: number };

const emptyForm = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  phone: "",
  roles: ["USER"] as RoleName[],
  areaIds: [] as string[],
  isActive: true,
};

export function UsersPage() {
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [disableTarget, setDisableTarget] = useState<UserItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["users", search],
    queryFn: () => api<Paginated<UserItem>>(`/api/users?search=${encodeURIComponent(search)}`),
  });

  const { data: areas } = useQuery({
    queryKey: ["areas", "users-form"],
    queryFn: () => api<Paginated<AreaOption>>("/api/areas?pageSize=100"),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingUser) {
        return api(`/api/users/${editingUser.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            email: form.email,
            firstName: form.firstName,
            lastName: form.lastName,
            phone: form.phone || undefined,
            roles: form.roles,
            areaIds: form.areaIds,
            isActive: form.isActive,
          }),
        });
      }

      return api("/api/users", {
        method: "POST",
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone || undefined,
          roles: form.roles,
          areaIds: form.areaIds,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      closeModal();
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const disableMutation = useMutation({
    mutationFn: (user: UserItem) =>
      api(`/api/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDisableTarget(null);
    },
  });

  function openCreateModal() {
    setEditingUser(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEditModal(user: UserItem) {
    setEditingUser(user);
    setForm({
      email: user.email,
      password: "",
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? "",
      roles: user.roles as RoleName[],
      areaIds: user.areas.map((area) => area.id),
      isActive: user.isActive,
    });
    setError("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingUser(null);
    setForm(emptyForm);
    setError("");
  }

  function toggleRole(role: RoleName) {
    setForm((current) => ({
      ...current,
      roles: current.roles.includes(role)
        ? current.roles.filter((item) => item !== role)
        : [...current.roles, role],
    }));
  }

  function toggleArea(areaId: string) {
    setForm((current) => ({
      ...current,
      areaIds: current.areaIds.includes(areaId)
        ? current.areaIds.filter((item) => item !== areaId)
        : [...current.areaIds, areaId],
    }));
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
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="mt-2 text-zinc-500">Gestion des comptes et assignations de zones.</p>
        </div>
        <Button type="button" onClick={openCreateModal}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvel utilisateur
        </Button>
      </div>

      <Input
        placeholder="Search by first name, last name or email"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <Card className="overflow-x-auto p-0">
        <table className="min-w-[860px] w-full text-left text-sm">
          <thead className="border-b bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Roles</th>
              <th className="px-4 py-3">Areas</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-4 py-6" colSpan={5}>
                  Loading users...
                </td>
              </tr>
            ) : (
              data?.items.map((user) => (
                <tr key={user.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {user.firstName} {user.lastName}
                    </div>
                    <div className="text-zinc-500">{user.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <Badge key={role}>{role}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {user.areas.map((area) => area.code).join(", ") || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={
                        user.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }
                    >
                      {user.isActive ? "Active" : "Disabled"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <RowActions
                      onEdit={() => openEditModal(user)}
                      onDelete={user.isActive ? () => setDisableTarget(user) : undefined}
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
        title={editingUser ? "Modifier l'utilisateur" : "Créer un utilisateur"}
        onClose={closeModal}
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Prénom"
              value={form.firstName}
              onChange={(event) => setForm({ ...form, firstName: event.target.value })}
              required
            />
            <Input
              placeholder="Nom"
              value={form.lastName}
              onChange={(event) => setForm({ ...form, lastName: event.target.value })}
              required
            />
          </div>
          <Input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
          />
          {!editingUser ? (
            <Input
              type="password"
              placeholder="Mot de passe (min. 8 caractères)"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
              minLength={8}
            />
          ) : null}
          <Input
            placeholder="Téléphone (optionnel)"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />

          <div>
            <p className="mb-2 text-sm font-medium">Rôles</p>
            <div className="flex flex-wrap gap-2">
              {ROLE_NAMES.map((role) => (
                <label key={role} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.roles.includes(role)}
                    onChange={() => toggleRole(role)}
                  />
                  {role}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Zones assignées</p>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border p-3">
              {areas?.items.map((area) => (
                <label key={area.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.areaIds.includes(area.id)}
                    onChange={() => toggleArea(area.id)}
                  />
                  {area.code} - {area.name}
                </label>
              ))}
            </div>
          </div>

          {editingUser ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
              />
              Compte actif
            </label>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Annuler
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Enregistrement..." : editingUser ? "Mettre à jour" : "Créer"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(disableTarget)}
        title="Désactiver l'utilisateur"
        message={`Voulez-vous désactiver ${disableTarget?.firstName} ${disableTarget?.lastName} ?`}
        confirmLabel="Désactiver"
        loading={disableMutation.isPending}
        onConfirm={() => disableTarget && disableMutation.mutate(disableTarget)}
        onClose={() => setDisableTarget(null)}
      />
    </div>
  );
}
