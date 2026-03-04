"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth/sessionContext";

export default function LoginPage() {
  const router = useRouter();
  const { users, login, isAuthenticated, isReady } = useSession();
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      router.replace("/my-queue");
    }
  }, [isAuthenticated, isReady, router]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedUserId || !password.trim()) {
      setError("Selecciona un usuario e ingresa la clave.");
      return;
    }
    setError(null);
    const ok = login(selectedUserId);
    if (!ok) {
      setError("Usuario inexistente. Contacta al administrador.");
      return;
    }
    router.replace("/my-queue");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="relative min-h-screen">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,116,144,0.15),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(251,191,36,0.12),_transparent_50%)]" />
        <div className="relative mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-12">
          <div className="grid w-full gap-10 md:grid-cols-[1.1fr_0.9fr]">
            <div className="flex flex-col justify-center">
              <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Operaciones Lucitour
              </div>
              <h1 className="mt-6 text-3xl font-semibold text-slate-900 md:text-4xl">
                Iniciar sesion
              </h1>
              <p className="mt-3 text-sm text-slate-600">
                Accede para iniciar tu jornada.
              </p>
              <div className="mt-8 grid gap-4 text-sm text-slate-600">
                <div className="rounded-lg border border-slate-200 bg-white/80 p-4">
                  <div className="text-xs font-semibold text-slate-500">Control de jornada</div>
                  <div className="mt-2 text-sm text-slate-700">
                    Revisa tus pendientes e iniciemos el día.
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white/80 p-4">
                  <div className="text-xs font-semibold text-slate-500">Seguimiento</div>
                  <div className="mt-2 text-sm text-slate-700">
                    Recuerda seguir tu horario, si tienes dudas contacta con soporte.
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
              <div className="flex flex-col items-center">
                <Image
                  src="/logo/logo-lucitour.png"
                  alt="Logo Lucitour"
                  width={140}
                  height={140}
                  priority
                />
                <h2 className="mt-4 text-lg font-semibold text-slate-900">Bienvenido</h2>
                <p className="text-xs text-slate-500">Ingresa tus credenciales</p>
              </div>

              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Usuario</label>
                  <select
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    value={selectedUserId}
                    onChange={(event) => setSelectedUserId(event.target.value)}
                  >
                    {users.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name} ({entry.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Clave</label>
                  <input
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                {error ? <p className="text-xs text-rose-600">{error}</p> : null}
                <Button type="submit" className="w-full">
                  Entrar
                </Button>
              </form>
              <p className="mt-4 text-center text-[11px] text-slate-400">
                Soporte interno · Lucitour Ops
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
