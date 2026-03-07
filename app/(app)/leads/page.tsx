"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getOpsRepo } from "@/lib/data/opsRepo";
import { useSession } from "@/lib/auth/sessionContext";
import type { CatalogItem, Lead } from "@/lib/types/ops";

const inputClassName =
  "w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900";

const LEAD_PENDING_TAG = "[PENDIENTE_PASAJERO]";

const stripPendingTag = (notes: string) =>
  notes
    .replaceAll(LEAD_PENDING_TAG, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");

const withPendingTag = (notes: string) => {
  const cleanNotes = stripPendingTag(notes);
  return cleanNotes.length > 0 ? `${cleanNotes}\n${LEAD_PENDING_TAG}` : LEAD_PENDING_TAG;
};

export default function LeadsPage() {
  const repo = useMemo(() => getOpsRepo(), []);
  const { users, user } = useSession();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [idTypes, setIdTypes] = useState<CatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const isSupervisor = user.role === "SUPERVISOR";
  const isAdmin = user.role === "ADMIN";

  const userById = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((user) => map.set(user.id, user.name));
    return map;
  }, [users]);

  const agentUsers = useMemo(
    () => users.filter((entry) => entry.role === "AGENT" || entry.role === "SUPERVISOR"),
    [users],
  );

  const idTypeById = useMemo(() => {
    const map = new Map<string, string>();
    idTypes.forEach((item) => map.set(item.id, item.name));
    return map;
  }, [idTypes]);

  const loadLeads = async () => {
    setIsLoading(true);
    const [data, identificationTypes] = await Promise.all([
      repo.listLeads(),
      repo.listCatalog("identificationTypes"),
    ]);
    setLeads(data);
    setIdTypes(identificationTypes);
    setIsLoading(false);
  };

  useEffect(() => {
    void loadLeads();
  }, []);

  const updateLeadLocal = (leadId: string, patch: Partial<Lead>) => {
    setLeads((prev) =>
      prev.map((lead) => (lead.id === leadId ? { ...lead, ...patch } : lead)),
    );
  };

  const persistUpdate = async (leadId: string, patch: Partial<Lead>) => {
    const updated = await repo.updateLead(leadId, patch);
    if (updated) {
      setLeads((prev) => prev.map((lead) => (lead.id === leadId ? updated : lead)));
    }
  };

  const scheduleUpdate = (leadId: string, patch: Partial<Lead>, key: string, delay = 500) => {
    updateLeadLocal(leadId, patch);
    if (debounceTimers.current[key]) {
      clearTimeout(debounceTimers.current[key]);
    }
    debounceTimers.current[key] = setTimeout(() => {
      void persistUpdate(leadId, patch);
    }, delay);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Leads</h1>
          <p className="text-sm text-slate-600">Interesados que no reservaron.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadLeads()}>
          Actualizar
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-600">Cargando leads...</p>
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-[1100px] w-full border-collapse text-xs">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Agente</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Identificacion</th>
                <th className="px-3 py-2">Tipo ID</th>
                <th className="px-3 py-2">Telefono</th>
                <th className="px-3 py-2">Correo</th>
                <th className="px-3 py-2">Seguimiento</th>
                <th className="px-3 py-2">Notas</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const hasPendingPassenger = (lead.notes ?? "").includes(LEAD_PENDING_TAG);
                const cleanNotes = stripPendingTag(lead.notes ?? "");
                return (
                <tr key={lead.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-600">
                    {new Date(lead.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {isSupervisor || isAdmin ? (
                      <select
                        className={inputClassName}
                        value={lead.agentUserId}
                        onChange={(event) =>
                          scheduleUpdate(
                            lead.id,
                            { agentUserId: event.target.value },
                            `${lead.id}:agentUserId`,
                          )
                        }
                      >
                        {agentUsers.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      userById.get(lead.agentUserId) ?? "-"
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-900">{lead.fullName}</td>
                  <td className="px-3 py-2">{lead.identification}</td>
                  <td className="px-3 py-2">{idTypeById.get(lead.identificationTypeId) ?? "-"}</td>
                  <td className="px-3 py-2">{lead.phone}</td>
                  <td className="px-3 py-2">{lead.email}</td>
                  <td className="px-3 py-2">
                    {hasPendingPassenger ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                        Pendiente pasajero
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <textarea
                      className="min-h-[60px] w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
                      value={cleanNotes}
                      onChange={(event) =>
                        scheduleUpdate(
                          lead.id,
                          {
                            notes: hasPendingPassenger
                              ? withPendingTag(event.target.value)
                              : event.target.value,
                          },
                          `${lead.id}:notes`,
                        )
                      }
                    />
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
