"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth/sessionContext";

const getApiBaseUrl = (): string => {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!value) {
    throw new Error("Missing NEXT_PUBLIC_API_BASE_URL");
  }
  return value.replace(/\/$/, "");
};

const getOrgId = (): string => process.env.NEXT_PUBLIC_ORG_ID?.trim() || "lucitour";

const buildApiHeaders = (apiBaseUrl: string, init?: HeadersInit): Headers => {
  const headers = new Headers(init);
  if (apiBaseUrl.includes(".ngrok-free.dev") || apiBaseUrl.includes(".ngrok-free.app")) {
    headers.set("ngrok-skip-browser-warning", "true");
  }
  return headers;
};

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isReady } = useSession();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [requestingReset, setRequestingReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      router.replace("/my-queue");
    }
  }, [isAuthenticated, isReady, router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setError("Ingresa tu usuario/correo y tu clave.");
      return;
    }

    setError(null);
    setLoading(true);
    const result = await login(identifier.trim(), password);
    setLoading(false);

    if (!result.ok) {
      setError(result.error ?? "No se pudo iniciar sesion.");
      return;
    }

    router.replace("/my-queue");
  };

  const handleForgotPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResetMessage(null);
    setError(null);

    if (!resetEmail.trim()) {
      setError("Ingresa un correo para recuperar la contrasena.");
      return;
    }

    setRequestingReset(true);
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/auth/forgot-password`, {
        method: "POST",
        headers: buildApiHeaders(apiBaseUrl, {
          "Content-Type": "application/json",
          "x-org-id": getOrgId(),
        }),
        body: JSON.stringify({ email: resetEmail.trim() }),
      });

      if (!response.ok) {
        setError("No se pudo procesar la solicitud de recuperacion.");
        return;
      }

      setResetMessage("Si el correo existe, recibiras un enlace para restablecer la contrasena.");
    } catch {
      setError("Error de red al solicitar recuperacion.");
    } finally {
      setRequestingReset(false);
    }
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
              <h1 className="mt-6 text-3xl font-semibold text-slate-900 md:text-4xl">Iniciar sesion</h1>
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
                  <label className="text-xs font-semibold text-slate-600">Usuario o correo</label>
                  <input
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    type="text"
                    autoComplete="username"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    placeholder="usuario o usuario@lucitour.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Clave</label>
                  <input
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                {error ? <p className="text-xs text-rose-600">{error}</p> : null}
                <Button type="submit" className="w-full" disabled={loading}>
                  Entrar
                </Button>
              </form>
              <form className="mt-5 space-y-3 border-t border-slate-100 pt-4" onSubmit={handleForgotPassword}>
                <label className="text-xs font-semibold text-slate-600">Olvide mi contrasena</label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  type="email"
                  autoComplete="email"
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                  placeholder="Correo para recuperar"
                />
                <Button type="submit" variant="outline" className="w-full" disabled={requestingReset}>
                  Enviar enlace de recuperacion
                </Button>
                {resetMessage ? <p className="text-xs text-emerald-700">{resetMessage}</p> : null}
                <p className="text-center text-[11px] text-slate-500">
                  Si ya tienes token, continua en{" "}
                  <Link className="font-semibold text-slate-700 underline" href="/auth/reset-password">
                    restablecer contrasena
                  </Link>
                </p>
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
