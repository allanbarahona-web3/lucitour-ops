"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../../../components/ui/button";
import { useSession } from "../../../../lib/auth/sessionContext";
import { Role } from "../../../../lib/types/ops";

const roleLabels: Record<Role, string> = {
  [Role.ADMIN]: "Admin",
  [Role.SUPERVISOR]: "Supervisor",
  [Role.AGENT]: "Agente",
  [Role.ACCOUNTING]: "Contabilidad",
  [Role.CONTRACTS]: "Contratos",
  [Role.QUOTES]: "Cotizaciones",
  [Role.BILLING]: "Facturacion",
  [Role.PURCHASES]: "Compras",
  [Role.VIEWER]: "Viewer",
};

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, users, updateUserRole, addUser, removeUser } = useSession();
  const roleOptions = useMemo(() => Object.values(Role), []);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(Role.AGENT);
  const [error, setError] = useState("");

  if (user.role !== Role.ADMIN) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold text-slate-900">Usuarios</h1>
        <p className="text-sm text-slate-600">
          No tienes permisos para ver esta seccion.
        </p>
        <Button variant="outline" onClick={() => router.push("/admin/dashboard")}>
          Volver
        </Button>
      </div>
    );
  }

  const handleAddUser = () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName || !trimmedEmail) {
      setError("Nombre y correo son requeridos.");
      return;
    }
    if (users.some((entry) => entry.email.toLowerCase() === trimmedEmail)) {
      setError("Ya existe un usuario con ese correo.");
      return;
    }
    addUser({ name: trimmedName, email: trimmedEmail, role });
    setName("");
    setEmail("");
    setRole(Role.AGENT);
    setError("");
  };

  const handleRemoveUser = (userId: string) => {
    if (userId === user.id) {
      setError("No puedes eliminar tu propio usuario.");
      return;
    }
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Seguro que deseas eliminar este usuario?");
      if (!confirmed) {
        return;
      }
    }
    removeUser(userId);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Usuarios</h1>
        <p className="text-sm text-slate-600">
          Administra los roles de acceso.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Nombre"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Correo"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
          >
            {roleOptions.map((option) => (
              <option key={option} value={option}>
                {roleLabels[option]}
              </option>
            ))}
          </select>
          <Button onClick={handleAddUser}>Agregar usuario</Button>
        </div>
        {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
      </div>

      <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-[900px] w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Correo</th>
              <th className="px-3 py-2">Rol</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((entry) => (
              <tr key={entry.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-900">
                  {entry.name}
                </td>
                <td className="px-3 py-2 text-slate-600">{entry.email}</td>
                <td className="px-3 py-2">
                  <select
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900"
                    value={entry.role}
                    onChange={(event) =>
                      updateUserRole(entry.id, event.target.value as Role)
                    }
                  >
                    {roleOptions.map((roleOption) => (
                      <option key={roleOption} value={roleOption}>
                        {roleLabels[roleOption]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRemoveUser(entry.id)}
                  >
                    Eliminar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
