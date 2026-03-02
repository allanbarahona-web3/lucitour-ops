"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "../../../components/ui/button";
import { getOpsRepo } from "../../../lib/data/opsRepo";
import { useSession } from "../../../lib/auth/sessionContext";
import type { Trip, TripMember } from "../../../lib/types/ops";

export default function ContractsPage() {
  const repo = useMemo(() => getOpsRepo(), []);
  const { users } = useSession();
  const [items, setItems] = useState<TripMember[]>([]);
  const [tripMap, setTripMap] = useState<Record<string, Trip>>({});
  const [isLoading, setIsLoading] = useState(true);

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
  }, []);

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
                <th className="px-3 py-2">Enviado por</th>
                <th className="px-3 py-2">Fecha envio</th>
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
                    <td className="px-3 py-2">
                      <Link
                        href={`/trips/${member.tripId}?focus=${member.id}`}
                        className="text-xs font-semibold text-cyan-600 hover:underline"
                      >
                        Ver ficha
                      </Link>
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
