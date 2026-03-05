"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getOpsRepo } from "@/lib/data/opsRepo";
import { useSession } from "@/lib/auth/sessionContext";
import { ContractsWorkflowStatus, Role, type Trip, type TripMember } from "@/lib/types/ops";

export default function ContractsPage() {
  const repo = useMemo(() => getOpsRepo(), []);
  const { user, users } = useSession();
  const [items, setItems] = useState<TripMember[]>([]);
  const [tripMap, setTripMap] = useState<Record<string, Trip>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const canViewClient = user.role === Role.ADMIN || user.role === Role.CONTRACTS;

  const userById = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((user) => map.set(user.id, user.name));
    return map;
  }, [users]);

  const loadQueue = async () => {
    setIsLoading(true);
    const [queueMembers, trips] = await Promise.all([
      repo.listContractsQueue(),
      repo.listTrips(),
    ]);

    const nextTripMap = trips.reduce<Record<string, Trip>>((acc, trip) => {
      acc[trip.id] = trip;
      return acc;
    }, {});

    setTripMap(nextTripMap);
    setItems(queueMembers);
    setIsLoading(false);
  };

  useEffect(() => {
    void loadQueue();
    const interval = setInterval(() => {
      void loadQueue();
    }, 15000);
    return () => clearInterval(interval);
  }, [repo]);

  const statusOptions = [
    { value: ContractsWorkflowStatus.IN_PROGRESS, label: "En progreso" },
    { value: ContractsWorkflowStatus.INFO_PENDING, label: "Info pendiente" },
    { value: ContractsWorkflowStatus.SENT_TO_SIGN, label: "Enviado a firmar" },
    { value: ContractsWorkflowStatus.APPROVED, label: "Aprobado" },
  ];

  const handleStatusChange = async (member: TripMember, status: ContractsWorkflowStatus) => {
    setBusyId(member.id);
    const now = new Date().toISOString();
    const updated = await repo.updateTripMember(member.tripId, member.id, {
      contractsWorkflowStatus: status,
      contractsTakenByUserId: member.contractsTakenByUserId ?? user.id,
      contractsTakenAt: member.contractsTakenAt ?? now,
      contractsStatusUpdatedAt: now,
      updatedAt: now,
    });
    if (updated) {
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    }
    setBusyId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Contratos</h1>
          <p className="text-sm text-slate-600">Envios listos para contratos.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadQueue()}>
          Actualizar
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-600">Cargando contratos...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">Sin envios pendientes.</p>
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-[1100px] w-full border-collapse text-xs">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Pasajero</th>
                <th className="px-3 py-2">Viaje</th>
                <th className="px-3 py-2">Reserva</th>
                <th className="px-3 py-2">Cotizacion</th>
                <th className="px-3 py-2">Enviado por</th>
                <th className="px-3 py-2">Fecha envio</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Tomado por</th>
                <th className="px-3 py-2">Actualizado</th>
                <th className="px-3 py-2">Accion</th>
              </tr>
            </thead>
            <tbody>
              {items.map((member) => {
                const trip = tripMap[member.tripId];
                return (
                  <tr key={member.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-900">{member.fullName}</td>
                    <td className="px-3 py-2 text-slate-600">{trip ? trip.name : "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{member.reservationCode || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{member.quoteCode || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {member.contractsSentByUserId
                        ? userById.get(member.contractsSentByUserId) ?? "-"
                        : "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {member.contractsSentAt
                        ? new Date(member.contractsSentAt).toLocaleString()
                        : "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      <select
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                        value={member.contractsWorkflowStatus ?? ""}
                        onChange={(event) =>
                          void handleStatusChange(
                            member,
                            event.target.value as ContractsWorkflowStatus,
                          )
                        }
                        disabled={busyId === member.id}
                      >
                        <option value="">Selecciona</option>
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
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
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        <Link
                          href={`/trips/${member.tripId}?focus=${member.id}`}
                          className="text-xs font-semibold text-cyan-600 hover:underline"
                        >
                          Ver ficha
                        </Link>
                        {canViewClient && member.clientId ? (
                          <Link
                            href={`/clients?clientId=${member.clientId}`}
                            className="text-xs font-semibold text-cyan-600 hover:underline"
                          >
                            Ver cliente
                          </Link>
                        ) : null}
                      </div>
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
