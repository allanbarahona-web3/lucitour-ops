"use client";

import { TimeTrackingPanel } from "@/components/ops/TimeTrackingPanel";
import { useSession } from "@/lib/auth/sessionContext";

export default function TimeTrackingPage() {
  const { user } = useSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Marcaje</h1>
        <p className="text-sm text-slate-600">
          Registra tu entrada para desbloquear el sistema.
        </p>
      </div>

      <TimeTrackingPanel
        title="Marcaje de turno"
        helper={`Usuario activo: ${user.name}`}
        userScope="all"
        restrictToCurrentUser
      />
    </div>
  );
}
