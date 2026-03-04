"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuoteWinDialog } from "@/components/ops/QuoteWinDialog";
import { getOpsRepo } from "@/lib/data/opsRepo";
import { useSession } from "@/lib/auth/sessionContext";
import {
  BillingStatus,
  ContractsStatus,
  QuoteStatus,
  type CatalogItem,
  type CatalogName,
  type Lead,
  type TripMember,
} from "@/lib/types/ops";

export default function QuotesPage() {
  const repo = useMemo(() => getOpsRepo(), []);
  const { user, users } = useSession();
  const [rows, setRows] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<QuoteStatus>(QuoteStatus.SENT);
  const [winLead, setWinLead] = useState<Lead | null>(null);
  const [memberById, setMemberById] = useState<Map<string, TripMember>>(new Map());
  const [catalogs, setCatalogs] = useState<Record<CatalogName, CatalogItem[]>>({
    airlines: [],
    lodgingTypes: [],
    accommodations: [],
    insurances: [],
    nationalities: [],
    identificationTypes: [],
  });

  const userById = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((user) => map.set(user.id, user.name));
    return map;
  }, [users]);

  const statusTabs = useMemo(
    () => [
      { id: QuoteStatus.SENT, label: "En cola" },
      { id: QuoteStatus.IN_PROGRESS, label: "En proceso" },
      { id: QuoteStatus.OFFER_SENT, label: "Cotizacion enviada" },
      { id: QuoteStatus.WON, label: "Ganada" },
      { id: QuoteStatus.PAUSED, label: "En pausa" },
      { id: QuoteStatus.LOST, label: "Perdida" },
    ],
    [],
  );

  useEffect(() => {
    const loadCatalogs = async () => {
      const [airlines, lodgingTypes, accommodations, insurances, nationalities, identificationTypes] =
        await Promise.all([
          repo.listCatalog("airlines"),
          repo.listCatalog("lodgingTypes"),
          repo.listCatalog("accommodations"),
          repo.listCatalog("insurances"),
          repo.listCatalog("nationalities"),
          repo.listCatalog("identificationTypes"),
        ]);

      setCatalogs({
        airlines,
        lodgingTypes,
        accommodations,
        insurances,
        nationalities,
        identificationTypes,
      });
    };

    const loadRows = async () => {
      setIsLoading(true);
      const leads = await repo.listLeads();
      const pendingQuotes = leads.filter((lead) =>
        [
          QuoteStatus.SENT,
          QuoteStatus.IN_PROGRESS,
          QuoteStatus.OFFER_SENT,
          QuoteStatus.WON,
          QuoteStatus.PAUSED,
          QuoteStatus.LOST,
        ].includes(lead.quoteStatus),
      );
      setRows(pendingQuotes);

      const relatedTripIds = Array.from(
        new Set(pendingQuotes.map((lead) => lead.quoteTripId).filter(Boolean)),
      ) as string[];
      if (relatedTripIds.length > 0) {
        const membersList = await Promise.all(
          relatedTripIds.map((tripId) => repo.listTripMembers(tripId)),
        );
        const map = new Map<string, TripMember>();
        membersList.flat().forEach((member) => map.set(member.id, member));
        setMemberById(map);
      } else {
        setMemberById(new Map());
      }
      setIsLoading(false);
    };

    void loadCatalogs();
    void loadRows();
  }, [repo]);

  const handleMarkInProgress = async (lead: Lead) => {
    setBusyLeadId(lead.id);
    const now = new Date().toISOString();
    const updated = await repo.updateLead(lead.id, {
      quoteStatus: QuoteStatus.IN_PROGRESS,
      quoteTakenByUserId: user.id,
      quoteTakenAt: now,
      quoteStatusUpdatedAt: now,
    });
    if (updated) {
      setRows((prev) => prev.map((row) => (row.id === lead.id ? updated : row)));
    }
    setBusyLeadId(null);
  };

  const handleUpdateStatus = async (lead: Lead, status: QuoteStatus) => {
    if (!lead.quoteTakenByUserId) {
      return;
    }
    setBusyLeadId(lead.id);
    const now = new Date().toISOString();
    const patch: Partial<Lead> = {
      quoteStatus: status,
      quoteStatusUpdatedAt: now,
    };

    if (status === QuoteStatus.OFFER_SENT) {
      patch.quoteOfferSentAt = now;
    }
    if (status === QuoteStatus.PAUSED) {
      patch.quotePausedAt = now;
    }
    if (status === QuoteStatus.LOST) {
      patch.quoteLostAt = now;
    }

    const updated = await repo.updateLead(lead.id, patch);
    if (updated) {
      setRows((prev) => prev.map((row) => (row.id === lead.id ? updated : row)));
    }
    setBusyLeadId(null);
  };

  const handleSendToContracts = async (lead: Lead) => {
    if (!lead.quoteTripId || !lead.quoteTripMemberId) {
      return;
    }
    const member = memberById.get(lead.quoteTripMemberId);
    if (!member || member.contractsStatus === ContractsStatus.SENT) {
      return;
    }
    setBusyLeadId(lead.id);
    const now = new Date().toISOString();
    const updated = await repo.updateTripMember(lead.quoteTripId, member.id, {
      contractsStatus: ContractsStatus.SENT,
      contractsSentByUserId: user.id,
      contractsSentAt: now,
      billingStatus: BillingStatus.SENT,
      billingSentByUserId: user.id,
      billingSentAt: now,
      isDraft: false,
    });
    if (updated) {
      setMemberById((prev) => {
        const next = new Map(prev);
        next.set(updated.id, updated);
        return next;
      });
    }
    setBusyLeadId(null);
  };

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

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const scopedRows = rows.filter((lead) => lead.quoteStatus === activeTab);
    if (!q) {
      return scopedRows;
    }
    return scopedRows.filter((lead) => {
      const haystack = `${lead.fullName} ${lead.identification}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [activeTab, query, rows]);

  const statusCounts = useMemo(() => {
    const counts = new Map<QuoteStatus, number>();
    statusTabs.forEach((tab) => counts.set(tab.id, 0));
    rows.forEach((lead) => {
      counts.set(lead.quoteStatus, (counts.get(lead.quoteStatus) ?? 0) + 1);
    });
    return counts;
  }, [rows, statusTabs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Cotizaciones</h1>
          <p className="text-sm text-slate-600">Solicitudes enviadas por agentes.</p>
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

      <div className="flex flex-wrap gap-2">
        {statusTabs.map((tab) => (
          <Button
            key={tab.id}
            size="sm"
            variant={activeTab === tab.id ? "default" : "outline"}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label} ({statusCounts.get(tab.id) ?? 0})
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clientes</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          {isLoading ? (
            <p className="text-sm text-slate-600">Cargando...</p>
          ) : filteredRows.length === 0 ? (
            <p className="text-sm text-slate-500">Sin solicitudes</p>
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
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Tomado por</th>
                  <th className="px-3 py-2">Tomado el</th>
                  <th className="px-3 py-2">Coti enviada</th>
                  <th className="px-3 py-2">Ganada</th>
                  <th className="px-3 py-2">Pausa</th>
                  <th className="px-3 py-2">Perdida</th>
                  <th className="px-3 py-2">Accion</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((lead) => (
                  <tr key={lead.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-900">{lead.fullName}</td>
                    <td className="px-3 py-2 text-slate-600">{lead.identification || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{lead.phone || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{lead.email || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{lead.quoteDestination || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{lead.quoteTravelMonth || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{lead.quoteCode || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {userById.get(lead.agentUserId) ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {lead.quoteStatus === QuoteStatus.SENT
                        ? "En cola"
                        : lead.quoteStatus === QuoteStatus.IN_PROGRESS
                          ? "En proceso"
                          : lead.quoteStatus === QuoteStatus.OFFER_SENT
                            ? "Cotizacion enviada"
                            : lead.quoteStatus === QuoteStatus.WON
                              ? "Ganada"
                              : lead.quoteStatus === QuoteStatus.PAUSED
                                ? "En pausa"
                                : "Perdida"}
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
                    <td className="px-3 py-2">
                      {lead.quoteStatus === QuoteStatus.SENT ? (
                        <Button
                          size="sm"
                          onClick={() => handleMarkInProgress(lead)}
                          disabled={busyLeadId === lead.id}
                        >
                          Marcar en proceso
                        </Button>
                      ) : lead.quoteStatus === QuoteStatus.IN_PROGRESS ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateStatus(lead, QuoteStatus.OFFER_SENT)}
                            disabled={busyLeadId === lead.id}
                          >
                            Cotizacion enviada
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setWinLead(lead)}
                            disabled={busyLeadId === lead.id}
                          >
                            Marcar ganada
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateStatus(lead, QuoteStatus.PAUSED)}
                            disabled={busyLeadId === lead.id}
                          >
                            Pausar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateStatus(lead, QuoteStatus.LOST)}
                            disabled={busyLeadId === lead.id}
                          >
                            Perder
                          </Button>
                        </div>
                      ) : lead.quoteStatus === QuoteStatus.OFFER_SENT ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() => setWinLead(lead)}
                            disabled={busyLeadId === lead.id}
                          >
                            Marcar ganada
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateStatus(lead, QuoteStatus.PAUSED)}
                            disabled={busyLeadId === lead.id}
                          >
                            Pausar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateStatus(lead, QuoteStatus.LOST)}
                            disabled={busyLeadId === lead.id}
                          >
                            Perder
                          </Button>
                        </div>
                      ) : lead.quoteStatus === QuoteStatus.WON ? (
                        lead.quoteTripMemberId &&
                        memberById.get(lead.quoteTripMemberId)?.isDraft ? (
                          <Button
                            size="sm"
                            onClick={() => handleSendToContracts(lead)}
                            disabled={busyLeadId === lead.id}
                          >
                            Enviar a contratos
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-500">Completado</span>
                        )
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <QuoteWinDialog
        open={Boolean(winLead)}
        lead={winLead}
        repo={repo}
        catalogs={catalogs}
        currentUser={user}
        onClose={() => setWinLead(null)}
        onCompleted={(updatedLead, member) => {
          setRows((prev) => prev.map((row) => (row.id === updatedLead.id ? updatedLead : row)));
          setMemberById((prev) => {
            const next = new Map(prev);
            next.set(member.id, member);
            return next;
          });
          setWinLead(null);
        }}
      />
    </div>
  );
}
