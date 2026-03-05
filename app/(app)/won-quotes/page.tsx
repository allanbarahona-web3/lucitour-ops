"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOpsRepo } from "@/lib/data/opsRepo";
import { useSession } from "@/lib/auth/sessionContext";
import {
  QuoteStatus,
  type Lead,
  type Trip,
  type TripMember,
} from "@/lib/types/ops";

type RowItem = {
  lead: Lead;
  member: TripMember | null;
  trip: Trip | null;
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatStatus = (value?: string | null) => {
  if (!value) {
    return "-";
  }
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export default function WonQuotesPage() {
  const repo = useMemo(() => getOpsRepo(), []);
  const { users } = useSession();
  const [rows, setRows] = useState<RowItem[]>([]);
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
      const [leads, trips] = await Promise.all([repo.listLeads(), repo.listTrips()]);
      const wonLeads = leads.filter((lead) => lead.quoteStatus === QuoteStatus.WON);
      const tripMap = new Map<string, Trip>();
      trips.forEach((trip) => tripMap.set(trip.id, trip));

      const tripIds = Array.from(
        new Set(wonLeads.map((lead) => lead.quoteTripId).filter(Boolean)),
      ) as string[];
      const membersList = await Promise.all(
        tripIds.map((tripId) => repo.listTripMembers(tripId)),
      );
      const memberMap = new Map<string, TripMember>();
      membersList.flat().forEach((member) => memberMap.set(member.id, member));

      const nextRows = wonLeads.map((lead) => ({
        lead,
        member: lead.quoteTripMemberId ? memberMap.get(lead.quoteTripMemberId) ?? null : null,
        trip: lead.quoteTripId ? tripMap.get(lead.quoteTripId) ?? null : null,
      }));
      setRows(nextRows);
      setIsLoading(false);
    };

    void loadRows();
    const interval = setInterval(loadRows, 15000);
    return () => clearInterval(interval);
  }, [repo]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return rows;
    }
    return rows.filter(({ lead }) => {
      const haystack = `${lead.fullName} ${lead.identification} ${lead.quoteCode ?? ""}`
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query, rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Cotizaciones ganadas</h1>
          <p className="text-sm text-slate-600">
            Listado de cotizaciones ganadas para seguimiento y facturacion.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <input
            className="w-full min-w-[220px] rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 sm:w-auto"
            placeholder="Buscar por nombre, ID o cotizacion"
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
          <CardTitle>Cotizaciones</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          {isLoading ? (
            <p className="text-sm text-slate-600">Cargando...</p>
          ) : filteredRows.length === 0 ? (
            <p className="text-sm text-slate-500">Sin cotizaciones ganadas</p>
          ) : (
            <table className="min-w-[1500px] w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-600">
                <tr>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Telefono</th>
                  <th className="px-3 py-2">Correo</th>
                  <th className="px-3 py-2">Destino</th>
                  <th className="px-3 py-2">Mes viaje</th>
                  <th className="px-3 py-2">Cotizacion</th>
                  <th className="px-3 py-2">Agente</th>
                  <th className="px-3 py-2">Ganada el</th>
                  <th className="px-3 py-2">Viaje</th>
                  <th className="px-3 py-2">Contratos</th>
                  <th className="px-3 py-2">Facturacion</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(({ lead, member, trip }) => (
                  <tr key={lead.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-900">{lead.fullName}</td>
                    <td className="px-3 py-2 text-slate-600">{lead.identification || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{lead.phone || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{lead.email || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {lead.quoteDestination || "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {lead.quoteTravelMonth || "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{lead.quoteCode || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {userById.get(lead.agentUserId) ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{formatDate(lead.quoteWonAt)}</td>
                    <td className="px-3 py-2 text-slate-600">{trip ? trip.name : "-"}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {formatStatus(member?.contractsStatus ?? null)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {formatStatus(member?.billingStatus ?? null)}
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
