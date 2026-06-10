"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/http";
import { cn } from "@/utils/cn";

type LogoutButtonProps = {
  className?: string;
  variant?: "sidebar" | "header";
};

export function LogoutButton({ className, variant = "sidebar" }: LogoutButtonProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);

    try {
      await api("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error(error);
      router.push("/login");
      router.refresh();
    } finally {
      setLoading(false);
      setConfirmOpen(false);
    }
  }

  const trigger =
    variant === "header" ? (
      <Button
        variant="secondary"
        className={cn("h-8 shrink-0 px-3 text-xs", className)}
        onClick={() => setConfirmOpen(true)}
      >
        <LogOut className="h-3.5 w-3.5" />
        Déconnexion
      </Button>
    ) : (
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950",
          className,
        )}
        onClick={() => setConfirmOpen(true)}
      >
        <LogOut className="h-4 w-4" />
        Déconnexion
      </button>
    );

  return (
    <>
      {trigger}
      <ConfirmDialog
        open={confirmOpen}
        title="Se déconnecter ?"
        message="Vous allez quitter votre session. Voulez-vous continuer ?"
        confirmLabel="Se déconnecter"
        loading={loading}
        onConfirm={handleLogout}
        onClose={() => {
          if (!loading) {
            setConfirmOpen(false);
          }
        }}
      />
    </>
  );
}
