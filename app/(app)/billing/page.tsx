"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOpsRepo } from "@/lib/data/opsRepo";
import { useSession } from "@/lib/auth/sessionContext";
import { BillingStatus, type Trip, type TripMember } from "@/lib/types/ops";

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
      const trips = await repo.listTrips();
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Facturacion</h1>
          <p className="text-sm text-slate-600">Pendientes enviados desde contratos/cotizaciones.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
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
    </div>
  );
}
