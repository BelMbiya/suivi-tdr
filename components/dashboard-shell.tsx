import type { ReactNode } from "react";
import { DashboardAccessGuard } from "@/components/dashboard-access-guard";
import { LogoutButton } from "@/components/logout-button";
import { DashboardNav } from "@/components/dashboard-nav";
import { NavUser } from "@/components/nav-user";

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <DashboardAccessGuard>
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-zinc-200 bg-white p-6 lg:flex lg:flex-col">
        <div>
          <p className="text-lg font-bold">Track TDR</p>
          <p className="mt-1 text-sm text-zinc-500">Real-time supervision</p>
        </div>
        <nav className="mt-10 flex-1 space-y-1 overflow-y-auto">
          <DashboardNav />
        </nav>
        <div className="mt-4 border-t border-zinc-200 pt-4">
          <NavUser />
          <LogoutButton />
        </div>
      </aside>
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-bold">Track TDR</p>
            <NavUser compact />
          </div>
          <LogoutButton variant="header" />
        </div>
        <nav className="-mx-1 flex gap-2 overflow-x-auto pb-1">
          <DashboardNav mobile />
        </nav>
      </header>
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </div>
      </main>
    </div>
    </DashboardAccessGuard>
  );
}
