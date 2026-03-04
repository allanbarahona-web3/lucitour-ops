"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOpsRepo } from "@/lib/data/opsRepo";
import { useSession } from "@/lib/auth/sessionContext";
import { ContractsStatus, ContractsWorkflowStatus, type Trip, type TripMember } from "@/lib/types/ops";

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

export default function MyQueueSentPage() {
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

  const statusLabel = (value: ContractsWorkflowStatus | null) => {
    if (!value) {
      return "Sin estado";
    }
    if (value === ContractsWorkflowStatus.IN_PROGRESS) {
      return "En progreso";
    }
    if (value === ContractsWorkflowStatus.INFO_PENDING) {
      return "Info pendiente";
    }
    if (value === ContractsWorkflowStatus.SENT_TO_SIGN) {
      return "Enviado a firmar";
    }
    return "Aprobado";
  };

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
            .filter(
              (member) =>
                member.contractsStatus === ContractsStatus.SENT &&
                member.contractsSentByUserId === user.id,
            )
            .map((member) => ({ member, trip })),
        )
        .sort((a, b) =>
          (b.member.contractsSentAt ?? "").localeCompare(a.member.contractsSentAt ?? ""),
        )
        .map((entry) => ({
          ...entry,
          trip: tripMap[entry.member.tripId] ?? entry.trip,
        }));
      setRows(nextRows);
      setIsLoading(false);
    };

    void loadRows();
    const interval = setInterval(() => {
      void loadRows();
    }, 15000);
    return () => clearInterval(interval);
  }, [repo, user.id]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return rows;
    }
    return rows.filter(({ member }) => {
      const haystack = `${member.fullName} ${member.identification} ${member.reservationCode}`
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query, rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Contratos en revision</h1>
          <p className="text-sm text-slate-600">Envios a contratos pendientes de revision.</p>
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
            <table className="min-w-[1180px] w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-600">
                <tr>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Reserva</th>
                  <th className="px-3 py-2">Enviado</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Tomado por</th>
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
                    <td className="px-3 py-2 text-slate-600">{formatDate(member.contractsSentAt)}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {statusLabel(member.contractsWorkflowStatus)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {member.contractsTakenByUserId
                        ? userById.get(member.contractsTakenByUserId) ?? "-"
                        : "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {member.contractsStatusUpdatedAt
                        ? new Date(member.contractsStatusUpdatedAt).toLocaleString()
                        : "-"}
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
