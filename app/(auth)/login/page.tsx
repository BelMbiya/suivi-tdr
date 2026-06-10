import { LoginForm } from "@/features/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Track TDR
          </p>
          <h1 className="mt-2 text-2xl font-bold text-zinc-950">
            Connectez-vous
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Accédez au dashboard de supervision temps réel.
          </p>
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
            Sur téléphone : utilisez le <strong>Wi‑Fi</strong> (même réseau que le PC).
            En 4G/5G, une adresse <code className="rounded bg-amber-100 px-1">192.168.x.x</code>{" "}
            ne fonctionne pas et la page peut rester lente ou bloquée.
          </p>
        </div>
        <LoginForm nextPath={params.next ?? null} />
      </div>
    </main>
  );
}
