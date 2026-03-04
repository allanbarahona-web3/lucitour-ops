"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getOpsRepo } from "@/lib/data/opsRepo";
import { useSession } from "@/lib/auth/sessionContext";
import { QuoteStatus, type Lead } from "@/lib/types/ops";

const statusLabels: Record<QuoteStatus, string> = {
  [QuoteStatus.PENDING]: "Pendiente",
  [QuoteStatus.SENT]: "En cola",
  [QuoteStatus.IN_PROGRESS]: "En proceso",
  [QuoteStatus.OFFER_SENT]: "Cotizacion enviada",
  [QuoteStatus.WON]: "Ganada",
  [QuoteStatus.PAUSED]: "En pausa",
  [QuoteStatus.LOST]: "Perdida",
};

const statusClasses: Record<QuoteStatus, string> = {
  [QuoteStatus.PENDING]: "bg-slate-200 text-slate-700",
  [QuoteStatus.SENT]: "bg-sky-100 text-sky-700",
  [QuoteStatus.IN_PROGRESS]: "bg-amber-100 text-amber-700",
  [QuoteStatus.OFFER_SENT]: "bg-indigo-100 text-indigo-700",
  [QuoteStatus.WON]: "bg-emerald-100 text-emerald-700",
  [QuoteStatus.PAUSED]: "bg-slate-100 text-slate-600",
  [QuoteStatus.LOST]: "bg-rose-100 text-rose-700",
};

export default function MyQueueQuotesPage() {
  const repo = useMemo(() => getOpsRepo(), []);
  const { user, users } = useSession();
  const [rows, setRows] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");

  const userById = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((entry) => map.set(entry.id, entry.name));
    return map;
  }, [users]);

  useEffect(() => {
    const loadRows = async () => {
      setIsLoading(true);
      const leads = await repo.listLeads();
      const nextRows = leads.filter(
        (lead) => lead.agentUserId === user.id && lead.quoteStatus !== QuoteStatus.PENDING,
      );
      setRows(nextRows);
      setIsLoading(false);
    };

    void loadRows();
  }, [repo, user.id]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return rows;
    }
    return rows.filter((lead) => {
      const haystack = `${lead.fullName} ${lead.identification}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query, rows]);

  const formatTimestamp = (value: string | null) => {
    if (!value) {
      return "-";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString("es-CR");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Cotizaciones enviadas</h1>
          <p className="text-sm text-slate-600">Estado en tiempo real segun cotizaciones.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <input
            className="w-full min-w-[220px] rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 sm:w-auto"
            placeholder="Buscar por nombre o ID"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Actualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clientes</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          {isLoading ? (
            <p className="text-sm text-slate-600">Cargando...</p>
          ) : filteredRows.length === 0 ? (
            <p className="text-sm text-slate-500">Sin cotizaciones</p>
          ) : (
            <table className="min-w-[1300px] w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-600">
                <tr>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Destino</th>
                  <th className="px-3 py-2">Mes viaje</th>
                  <th className="px-3 py-2">Cotizacion</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Tomado por</th>
                  <th className="px-3 py-2">Tomado el</th>
                  <th className="px-3 py-2">Coti enviada</th>
                  <th className="px-3 py-2">Ganada</th>
                  <th className="px-3 py-2">Pausa</th>
                  <th className="px-3 py-2">Perdida</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((lead) => (
                  <tr key={lead.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-900">{lead.fullName}</td>
                    <td className="px-3 py-2 text-slate-600">{lead.identification || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{lead.quoteDestination || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{lead.quoteTravelMonth || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{lead.quoteCode || "-"}</td>
                    <td className="px-3 py-2">
                      <Badge className={statusClasses[lead.quoteStatus]} variant="secondary">
                        {statusLabels[lead.quoteStatus]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {lead.quoteTakenByUserId
                        ? userById.get(lead.quoteTakenByUserId) ?? "-"
                        : "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {formatTimestamp(lead.quoteTakenAt)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {formatTimestamp(lead.quoteOfferSentAt)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {formatTimestamp(lead.quoteWonAt)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {formatTimestamp(lead.quotePausedAt)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {formatTimestamp(lead.quoteLostAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
