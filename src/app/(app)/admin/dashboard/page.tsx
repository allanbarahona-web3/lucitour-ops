"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PayrollSettingsPanel } from "@/components/ops/PayrollSettingsPanel";
import { PayslipsPanel } from "@/components/ops/PayslipsPanel";
import { TimeTrackingPanel } from "@/components/ops/TimeTrackingPanel";
import { useSession } from "@/lib/auth/sessionContext";
import { getOpsRepo } from "@/lib/data/opsRepo";
import {
  BillingStatus,
  ContractStatus,
  ContractsStatus,
  DocsStatus,
  ItineraryStatus,
  PassportStatus,
  QuoteStatus,
  type Trip,
  type TripMember,
} from "@/lib/types/ops";

interface DashboardStats {
  totalTrips: number;
  activeTrips: number;
  totalMembers: number;
  pendingMembers: number;
  contractsSent: number;
  billingSent: number;
  quoteActive: number;
}

type MonthlySale = {
  key: string;
  label: string;
  amount: number;
};

const formatDateInput = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isPending = (member: TripMember) =>
  member.contractStatus === ContractStatus.MISSING ||
  member.docsStatus === DocsStatus.NOT_UPLOADED ||
  member.passportStatus === PassportStatus.NOT_ENTERED ||
  member.itineraryStatus === ItineraryStatus.MISSING;

export default function AdminDashboardPage() {
  const { user } = useSession();
  const repo = useMemo(() => getOpsRepo(), []);
  const [stats, setStats] = useState<DashboardStats>({
    totalTrips: 0,
    activeTrips: 0,
    totalMembers: 0,
    pendingMembers: 0,
    contractsSent: 0,
    billingSent: 0,
    quoteActive: 0,
  });
  const [tripStatusCounts, setTripStatusCounts] = useState<Record<string, number>>({});
  const [quoteStatusCounts, setQuoteStatusCounts] = useState<Record<string, number>>({});
  const [pipelineCounts, setPipelineCounts] = useState<Record<string, number>>({});
  const [monthlySales, setMonthlySales] = useState<MonthlySale[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const applyPreset = (preset: "today" | "7d" | "month" | "ytd") => {
    const now = new Date();
    const today = formatDateInput(now);
    if (preset === "today") {
      setStartDate(today);
      setEndDate(today);
      return;
    }
    if (preset === "7d") {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      setStartDate(formatDateInput(start));
      setEndDate(today);
      return;
    }
    if (preset === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(formatDateInput(start));
      setEndDate(today);
      return;
    }
    const start = new Date(now.getFullYear(), 0, 1);
    setStartDate(formatDateInput(start));
    setEndDate(today);
  };

  useEffect(() => {
    const loadData = async () => {
      const trips = await repo.listTrips();
      const membersByTrip = await Promise.all(
        trips.map(async (trip) => repo.listTripMembers(trip.id)),
      );
      const leads = await repo.listLeads();

      const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
      const end = endDate ? new Date(`${endDate}T23:59:59`) : null;
      const isInRange = (value?: string | null) => {
        if (!value) {
          return false;
        }
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
          return false;
        }
        if (start && parsed < start) {
          return false;
        }
        if (end && parsed > end) {
          return false;
        }
        return true;
      };

      const allMembers = membersByTrip.flat();
      const filteredMembers = start || end
        ? allMembers.filter((member) => isInRange(member.createdAt))
        : allMembers;
      const filteredTrips = start || end
        ? trips.filter((trip) => isInRange(`${trip.dateFrom}T00:00:00`))
        : trips;
      const filteredLeads = start || end
        ? leads.filter((lead) => isInRange(lead.createdAt))
        : leads;

      const pendingCount = filteredMembers.filter(isPending).length;
      const contractsSent = filteredMembers.filter(
        (member) =>
          member.contractsStatus === ContractsStatus.SENT &&
          (!start && !end ? true : isInRange(member.contractsSentAt ?? "")),
      ).length;
      const billingSent = filteredMembers.filter(
        (member) =>
          member.billingStatus === BillingStatus.SENT &&
          (!start && !end ? true : isInRange(member.billingSentAt ?? "")),
      ).length;
      const quoteActive = filteredLeads.filter(
        (lead) =>
          lead.quoteStatus === QuoteStatus.IN_PROGRESS ||
          lead.quoteStatus === QuoteStatus.OFFER_SENT,
      ).length;

      const statusCounts = filteredTrips.reduce<Record<string, number>>((acc, trip) => {
        acc[trip.status] = (acc[trip.status] ?? 0) + 1;
        return acc;
      }, {});

      setStats({
        totalTrips: filteredTrips.length,
        activeTrips: filteredTrips.filter((trip) => trip.status === "ACTIVE").length,
        totalMembers: filteredMembers.length,
        pendingMembers: pendingCount,
        contractsSent,
        billingSent,
        quoteActive,
      });
      setTripStatusCounts(statusCounts);

      const quoteCounts = filteredLeads.reduce<Record<string, number>>((acc, lead) => {
        acc[lead.quoteStatus] = (acc[lead.quoteStatus] ?? 0) + 1;
        return acc;
      }, {});
      setQuoteStatusCounts(quoteCounts);

      const contractPending = filteredMembers.filter(
        (member) => member.contractStatus === ContractStatus.MISSING,
      ).length;
      const identificationPending = filteredMembers.filter(
        (member) =>
          member.passportStatus === PassportStatus.NOT_ENTERED ||
          member.docsStatus === DocsStatus.NOT_UPLOADED,
      ).length;
      setPipelineCounts({
        "Contratos pendientes": contractPending,
        "Identificaciones pendientes": identificationPending,
        "Contratos enviados": contractsSent,
        "Facturacion enviada": billingSent,
      });

      const salesByMonth = new Map<string, number>();
      filteredMembers.forEach((member) => {
        if (
          member.billingStatus !== BillingStatus.SENT ||
          member.billingTotalAmount === null ||
          !member.billingSentAt
        ) {
          return;
        }
        if (start || end) {
          if (!isInRange(member.billingSentAt)) {
            return;
          }
        }
        const sentDate = new Date(member.billingSentAt);
        if (Number.isNaN(sentDate.getTime())) {
          return;
        }
        const key = `${sentDate.getFullYear()}-${String(sentDate.getMonth() + 1).padStart(2, "0")}`;
        salesByMonth.set(key, (salesByMonth.get(key) ?? 0) + member.billingTotalAmount);
      });

      const monthNames = [
        "Ene",
        "Feb",
        "Mar",
        "Abr",
        "May",
        "Jun",
        "Jul",
        "Ago",
        "Sep",
        "Oct",
        "Nov",
        "Dic",
      ];
      const salesArray = Array.from(salesByMonth.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, amount]) => {
          const [year, month] = key.split("-");
          const monthIndex = Number(month) - 1;
          const label = `${monthNames[monthIndex] ?? month} ${year}`;
          return { key, label, amount };
        });
      setMonthlySales(salesArray);
    };

    void loadData();
  }, [repo, startDate, endDate]);

  if (user.role !== "ADMIN") {
    return <div className="text-sm text-slate-600">No autorizado</div>;
  }

  const maxStatusCount = Math.max(1, ...Object.values(tripStatusCounts));
  const maxQuoteCount = Math.max(1, ...Object.values(quoteStatusCounts));
  const maxPipelineCount = Math.max(1, ...Object.values(pipelineCounts));
  const maxSales = Math.max(1, ...monthlySales.map((entry) => entry.amount));

  const statusColor: Record<string, string> = {
    ACTIVE: "bg-emerald-500",
    PLANNED: "bg-cyan-500",
    COMPLETED: "bg-slate-700",
    CANCELLED: "bg-rose-500",
  };

  const quoteColor: Record<string, string> = {
    PENDING: "bg-slate-300",
    SENT: "bg-sky-500",
    IN_PROGRESS: "bg-amber-500",
    OFFER_SENT: "bg-cyan-600",
    WON: "bg-emerald-500",
    PAUSED: "bg-violet-500",
    LOST: "bg-rose-500",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-600">
            Resumen operativo general. Filtros aplican a viajes, pasajeros, cotizaciones y ventas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "today", label: "Hoy" },
              { id: "7d", label: "7 dias" },
              { id: "month", label: "Mes" },
              { id: "ytd", label: "YTD" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className="rounded-full border border-slate-300 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                onClick={() => applyPreset(item.id as "today" | "7d" | "month" | "ytd")}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Desde</span>
            <input
              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Hasta</span>
            <input
              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
            onClick={() => {
              setStartDate("");
              setEndDate("");
            }}
          >
            Limpiar
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {[
          {
            title: "Total viajes",
            value: stats.totalTrips,
            tone: "from-slate-900 to-slate-700",
          },
          {
            title: "Viajes activos",
            value: stats.activeTrips,
            tone: "from-emerald-600 to-emerald-400",
          },
          {
            title: "Total pasajeros",
            value: stats.totalMembers,
            tone: "from-cyan-600 to-cyan-400",
          },
          {
            title: "Pendientes",
            value: stats.pendingMembers,
            tone: "from-amber-500 to-amber-300",
          },
          {
            title: "Contratos enviados",
            value: stats.contractsSent,
            tone: "from-indigo-600 to-indigo-400",
          },
          {
            title: "Cotizaciones activas",
            value: stats.quoteActive,
            tone: "from-rose-600 to-rose-400",
          },
        ].map((card) => (
          <Card key={card.title} className="border-none">
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`rounded-lg bg-gradient-to-br ${card.tone} px-4 py-6 text-3xl font-semibold text-white`}
              >
                {card.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Viajes por estado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(tripStatusCounts).map(([status, count]) => (
              <div key={status} className="space-y-1">
                <div className="flex items-center justify-between text-sm text-slate-700">
                  <span>{status}</span>
                  <span className="font-semibold text-slate-900">{count}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100">
                  <div
                    className={`h-2 rounded-full ${statusColor[status] ?? "bg-slate-900"}`}
                    style={{ width: `${(count / maxStatusCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cotizaciones por estado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(quoteStatusCounts).map(([status, count]) => (
              <div key={status} className="space-y-1">
                <div className="flex items-center justify-between text-sm text-slate-700">
                  <span>{status}</span>
                  <span className="font-semibold text-slate-900">{count}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100">
                  <div
                    className={`h-2 rounded-full ${quoteColor[status] ?? "bg-slate-900"}`}
                    style={{ width: `${(count / maxQuoteCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Embudo operativo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(pipelineCounts).map(([label, count]) => (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between text-sm text-slate-700">
                <span>{label}</span>
                <span className="font-semibold text-slate-900">{count}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-slate-900"
                  style={{ width: `${(count / maxPipelineCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ventas mensuales (USD)</CardTitle>
        </CardHeader>
        <CardContent>
          {monthlySales.length === 0 ? (
            <p className="text-sm text-slate-500">Sin ventas en el rango seleccionado.</p>
          ) : (
            <div className="flex h-56 items-end gap-3 overflow-x-auto">
              {monthlySales.map((entry) => (
                <div key={entry.key} className="flex w-20 flex-col items-center gap-2">
                  <div className="text-xs font-semibold text-slate-700">${entry.amount.toFixed(0)}</div>
                  <div className="flex h-40 w-full items-end rounded-md bg-slate-100">
                    <div
                      className="w-full rounded-md bg-gradient-to-t from-emerald-500 to-emerald-300"
                      style={{ height: `${(entry.amount / maxSales) * 100}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-500">{entry.label}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <TimeTrackingPanel
        title="Planillas de agentes"
        helper="Control de tiempos diarios para el call center."
        userScope="all"
      />

      <PayrollSettingsPanel canEdit={user.role === "ADMIN"} />

      <PayslipsPanel />
    </div>
  );
}
