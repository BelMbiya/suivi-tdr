"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { resolvePostLoginPath } from "@/lib/auth/redirect";
import { api } from "@/lib/http";
import type { RoleName } from "@/types/domain";

export function LoginForm({ nextPath }: { nextPath: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(event.currentTarget);

    try {
      const result = await api<{ user: { roles: RoleName[] } }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          organizationSlug: form.get("organizationSlug") || "default",
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const destination = resolvePostLoginPath(result.user.roles, nextPath);
      window.location.assign(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className="space-y-4"
      method="post"
      action="#"
      onSubmit={onSubmit}
      noValidate
    >
      <Input name="organizationSlug" placeholder="Organisation" defaultValue="default" />
      <Input
        name="email"
        type="text"
        inputMode="email"
        autoComplete="username"
        placeholder="Email"
        required
      />
      <PasswordInput name="password" placeholder="Mot de passe" required />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Connexion..." : "Se connecter"}
      </Button>
    </form>
  );
}
