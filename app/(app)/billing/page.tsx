"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOpsRepo } from "@/lib/data/opsRepo";
import { useSession } from "@/lib/auth/sessionContext";
import {
  BillingStatus,
  QuoteStatus,
  UpsellOrderStatus,
  type Trip,
  type TripMember,
  type UpsellOrder,
} from "@/lib/types/ops";

type RowItem = {
  member: TripMember;
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

export default function BillingPage() {
  const repo = useMemo(() => getOpsRepo(), []);
  const { user, users } = useSession();
  const [rows, setRows] = useState<RowItem[]>([]);
  const [upsellRows, setUpsellRows] = useState<UpsellOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [exchangeRate, setExchangeRate] = useState(500);
  const [wonQuoteCount, setWonQuoteCount] = useState(0);

  const userById = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((entry) => map.set(entry.id, entry.name));
    return map;
  }, [users]);

  useEffect(() => {
    const loadRows = async () => {
      setIsLoading(true);
      const [trips, billingConfig, leads, upsellOrders] = await Promise.all([
        repo.listTrips(),
        repo.getBillingConfig(),
        repo.listLeads(),
        repo.listUpsellOrders(),
      ]);
      setExchangeRate(billingConfig.exchangeRate);
      setWonQuoteCount(leads.filter((lead) => lead.quoteStatus === QuoteStatus.WON).length);
      const tripMap = trips.reduce<Record<string, Trip>>((acc, trip) => {
        acc[trip.id] = trip;
        return acc;
      }, {});
      const tripMembersByTrip = await Promise.all(
        trips.map(async (trip) => ({
          trip,
          members: await repo.listTripMembers(trip.id),
        })),
      );
      const nextRows = tripMembersByTrip
        .flatMap(({ trip, members }) =>
          members
            .filter((member) => member.billingStatus === BillingStatus.SENT)
            .map((member) => ({ member, trip: tripMap[member.tripId] ?? trip })),
        )
        .sort((a, b) =>
          (b.member.billingSentAt ?? "").localeCompare(a.member.billingSentAt ?? ""),
        );
      setRows(nextRows);
      setUpsellRows(
        upsellOrders
          .filter((order) => order.status !== UpsellOrderStatus.CANCELLED)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
      setIsLoading(false);
    };

    void loadRows();
    const interval = setInterval(() => {
      void loadRows();
    }, 15000);
    return () => clearInterval(interval);
  }, [repo]);

  if (user.role !== "BILLING" && user.role !== "ADMIN" && user.role !== "ACCOUNTING") {
    return <div className="text-sm text-slate-600">No autorizado</div>;
  }

  const filteredRows = rows.filter(({ member }) => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return true;
    }
    const haystack = `${member.fullName} ${member.identification} ${member.reservationCode}`
      .toLowerCase();
    return haystack.includes(q);
  });

  const filteredUpsellRows = upsellRows.filter((order) => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return true;
    }
    const member = rows.find((row) => row.member.id === order.tripMemberId)?.member;
    const haystack = `${member?.fullName ?? ""} ${member?.identification ?? ""} ${order.quoteCode ?? ""}`
      .toLowerCase();
    return haystack.includes(q);
  });

  const updateUpsellStatus = async (orderId: string, status: UpsellOrderStatus) => {
    const updated = await repo.updateUpsellOrder(orderId, { status });
    if (!updated) {
      return;
    }
    setUpsellRows((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  const updateMemberLocal = (memberId: string, amount: number | null) => {
    setRows((prev) =>
      prev.map((row) =>
        row.member.id === memberId
          ? { ...row, member: { ...row.member, billingTotalAmount: amount } }
          : row,
      ),
    );
  };

  const persistAmount = async (member: TripMember, amount: number | null) => {
    const updated = await repo.updateTripMember(member.tripId, member.id, {
      billingTotalAmount: amount,
      billingStatusUpdatedAt: new Date().toISOString(),
    });
    if (updated) {
      setRows((prev) =>
        prev.map((row) => (row.member.id === updated.id ? { ...row, member: updated } : row)),
      );
    }
  };

  const scheduleAmountUpdate = (member: TripMember, value: string) => {
    const parsed = Number(value);
    const amount = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    updateMemberLocal(member.id, amount);
    const key = `${member.id}:billingTotalAmount`;
    if (debounceTimers.current[key]) {
      clearTimeout(debounceTimers.current[key]);
    }
    debounceTimers.current[key] = setTimeout(() => {
      void persistAmount(member, amount);
    }, 500);
  };

  const effectiveRate = Math.max(exchangeRate || 0, 500);
  const rateLabel = exchangeRate < 500 ? "(Min 500 aplicado)" : "(Rate real)";
  const rateColorClass = exchangeRate < 500 ? "text-amber-600" : "text-emerald-600";


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Facturacion</h1>
          <p className="text-sm text-slate-600">Pendientes enviados desde contratos/cotizaciones.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600">Tipo cambio</span>
            <span className={`text-xs font-semibold ${rateColorClass}`}>
              {exchangeRate} {rateLabel}
            </span>
          </div>
          <input
            className="w-full min-w-[220px] rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 sm:w-auto"
            placeholder="Buscar por nombre, ID o reserva"
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
          <CardTitle>Cotizaciones ganadas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-600">Pendientes de seguimiento y facturacion.</p>
            <p className="text-2xl font-semibold text-slate-900">{wonQuoteCount}</p>
          </div>
          <Link className="text-sm font-medium text-cyan-700 hover:underline" href="/won-quotes">
            Ver listado
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clientes</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          {isLoading ? (
            <p className="text-sm text-slate-600">Cargando...</p>
          ) : filteredRows.length === 0 ? (
            <p className="text-sm text-slate-500">Sin enviados</p>
          ) : (
            <table className="min-w-[1200px] w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-600">
                <tr>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Reserva</th>
                  <th className="px-3 py-2">Cotizacion</th>
                  <th className="px-3 py-2">Monto USD</th>
                  <th className="px-3 py-2">Monto CRC</th>
                  <th className="px-3 py-2">Enviado por</th>
                  <th className="px-3 py-2">Fecha envio</th>
                  <th className="px-3 py-2">Actualizado</th>
                  <th className="px-3 py-2">Viaje</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(({ member, trip }) => (
                  <tr key={member.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-900">{member.fullName}</td>
                    <td className="px-3 py-2 text-slate-600">{member.identification || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{member.reservationCode}</td>
                    <td className="px-3 py-2 text-slate-600">{member.quoteCode || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">
                      <input
                        className="w-32 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900"
                        type="number"
                        min={0}
                        value={member.billingTotalAmount ?? ""}
                        onChange={(event) => scheduleAmountUpdate(member, event.target.value)}
                        placeholder="0"
                      />
                    </td>
                    <td className={`px-3 py-2 text-xs font-semibold ${rateColorClass}`}>
                      {member.billingTotalAmount !== null
                        ? `CRC ${(member.billingTotalAmount * effectiveRate).toFixed(2)} ${rateLabel}`
                        : "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {member.billingSentByUserId
                        ? userById.get(member.billingSentByUserId) ?? "-"
                        : "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{formatDate(member.billingSentAt)}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {formatDate(member.billingStatusUpdatedAt)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{trip ? trip.name : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Anexos de adicionales</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          {isLoading ? (
            <p className="text-sm text-slate-600">Cargando anexos...</p>
          ) : filteredUpsellRows.length === 0 ? (
            <p className="text-sm text-slate-500">Sin anexos</p>
          ) : (
            <table className="min-w-[1100px] w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-600">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Pasajero</th>
                  <th className="px-3 py-2">Cotizacion</th>
                  <th className="px-3 py-2">Total USD</th>
                  <th className="px-3 py-2">Total CRC</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Lineas</th>
                </tr>
              </thead>
              <tbody>
                {filteredUpsellRows.map((order) => {
                  const member = rows.find((row) => row.member.id === order.tripMemberId)?.member;
                  return (
                    <tr key={order.id} className="border-t border-slate-100 align-top">
                      <td className="px-3 py-2 text-slate-600">{formatDate(order.createdAt)}</td>
                      <td className="px-3 py-2 text-slate-900">{member?.fullName ?? "-"}</td>
                      <td className="px-3 py-2 text-slate-600">{order.quoteCode ?? "-"}</td>
                      <td className="px-3 py-2 font-semibold text-slate-900">USD {order.totalAmount.toFixed(2)}</td>
                      <td className={`px-3 py-2 text-xs font-semibold ${rateColorClass}`}>
                        CRC {(order.totalAmount * effectiveRate).toFixed(2)} {rateLabel}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                          value={order.status}
                          onChange={(event) =>
                            void updateUpsellStatus(order.id, event.target.value as UpsellOrderStatus)
                          }
                        >
                          {Object.values(UpsellOrderStatus).map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        <div className="space-y-1">
                          {order.lines.map((line) => (
                            <div key={line.id} className="text-xs">
                              {line.label} · {line.ownerName} · {line.quantity} x USD {line.unitPrice.toFixed(2)} = USD {line.totalPrice.toFixed(2)}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
