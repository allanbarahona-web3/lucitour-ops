"use client";

import { useMemo } from "react";
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
  [Role.VIEWER]: "Viewer",
};

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, users, updateUserRole } = useSession();
  const roleOptions = useMemo(() => Object.values(Role), []);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Usuarios</h1>
        <p className="text-sm text-slate-600">
          Administra los roles de acceso.
        </p>
      </div>

      <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-[900px] w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Correo</th>
              <th className="px-3 py-2">Rol</th>
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
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {roleLabels[role]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
