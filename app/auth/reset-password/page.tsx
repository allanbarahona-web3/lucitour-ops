"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const tokenFromQuery = new URLSearchParams(window.location.search).get("token") ?? "";
    setToken(tokenFromQuery);
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token.trim()) {
      setError("Falta el token de recuperacion.");
      return;
    }
    if (newPassword.length < 8) {
      setError("La nueva contrasena debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contrasenas no coinciden.");
      return;
    }

    setSubmitting(true);
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/auth/reset-password`, {
        method: "POST",
        headers: buildApiHeaders(apiBaseUrl, {
          "Content-Type": "application/json",
          "x-org-id": getOrgId(),
        }),
        body: JSON.stringify({ token: token.trim(), newPassword }),
      });

      if (!response.ok) {
        setError("No fue posible restablecer la contrasena. Verifica el token o solicita uno nuevo.");
        return;
      }

      setSuccess("Contrasena actualizada correctamente. Ya puedes iniciar sesion.");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Error de red al restablecer la contrasena.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
        <h1 className="text-xl font-semibold text-slate-900">Restablecer contrasena</h1>
        <p className="mt-2 text-sm text-slate-600">
          Ingresa el token que recibiste por correo y define tu nueva contrasena.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">Token</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              type="text"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Token de recuperacion"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">Nueva contrasena</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">Confirmar contrasena</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
          {success ? <p className="text-xs text-emerald-700">{success}</p> : null}

          <Button type="submit" className="w-full" disabled={submitting}>
            Guardar nueva contrasena
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-500">
          Volver a{" "}
          <Link href="/auth/login" className="font-semibold text-slate-700 underline">
            iniciar sesion
          </Link>
        </p>
      </div>
    </div>
  );
}
