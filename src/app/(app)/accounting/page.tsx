"use client";

import { PayrollDeductionsPanel } from "../../../components/ops/PayrollDeductionsPanel";
import { PayrollSettingsPanel } from "../../../components/ops/PayrollSettingsPanel";
import { PayslipsPanel } from "../../../components/ops/PayslipsPanel";
import { TimeReportsPanel } from "../../../components/ops/TimeReportsPanel";
import { TimeTrackingPanel } from "../../../components/ops/TimeTrackingPanel";
import { useSession } from "../../../lib/auth/sessionContext";

export default function AccountingPage() {
  const { user } = useSession();

  if (user.role !== "ACCOUNTING" && user.role !== "ADMIN") {
    return <div className="text-sm text-slate-600">No autorizado</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Contabilidad</h1>
        <p className="text-sm text-slate-600">Planillas, pagos y reportes.</p>
      </div>

      <TimeTrackingPanel
        title="Planillas de tiempo"
        helper="Marcas de todos los roles."
        userScope="all"
      />

      <PayrollDeductionsPanel />

      <TimeReportsPanel />

      <PayslipsPanel />

      <PayrollSettingsPanel canEdit={user.role === "ADMIN"} />
    </div>
  );
}
