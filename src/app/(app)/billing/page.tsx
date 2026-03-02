"use client";

import { useSession } from "../../../lib/auth/sessionContext";

export default function BillingPage() {
  const { user } = useSession();

  if (user.role !== "BILLING" && user.role !== "ADMIN" && user.role !== "ACCOUNTING") {
    return <div className="text-sm text-slate-600">No autorizado</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Facturacion</h1>
        <p className="text-sm text-slate-600">Modulo para facturas, abonos y ciclo de cobranza.</p>
      </div>
    </div>
  );
}
