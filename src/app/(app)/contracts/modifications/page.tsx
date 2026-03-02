"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "../../../../components/ui/button";
import { getOpsRepo } from "../../../../lib/data/opsRepo";
import { useSession } from "../../../../lib/auth/sessionContext";
import {
  ContractModificationStatus,
  Role,
  type ContractModificationRequest,
  type Trip,
  type TripMember,
} from "../../../../lib/types/ops";

type ModificationRow = ContractModificationRequest & {
  memberName: string;
  tripName: string;
  requestedByName: string;
  processedByName: string;
};

const getStepLabel = (step: ContractModificationRequest["step"]) => {
  switch (step) {
    case "STEP1":
      return "Paso 1 · Datos del viaje";
    case "STEP2":
      return "Paso 2 · Seguro y emergencia";
    case "STEP3":
      return "Paso 3 · Acompanantes";
    case "STEP4":
      return "Paso 4 · Documentos";
    default:
      return step;
  }
};

const formatDate = (value: string) => {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
};

const formatPayload = (payload: ContractModificationRequest["payload"]) => {
  const keys = Object.keys(payload);
  if (keys.length === 0) {
    return "Sin cambios";
  }
  return keys.join(", ");
};

export default function ContractModificationsPage() {
  const repo = useMemo(() => getOpsRepo(), []);
  const { users, user } = useSession();
  const [items, setItems] = useState<ModificationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const canProcess = user.role === Role.CONTRACTS || user.role === Role.ADMIN;
  const userMap = useMemo(() => new Map(users.map((entry) => [entry.id, entry.name])), [users]);

  const loadData = async () => {
    setIsLoading(true);
    const [modifications, trips] = await Promise.all([
      repo.listContractModifications(),
      repo.listTrips(),
    ]);

    const tripMap = trips.reduce<Record<string, Trip>>((acc, trip) => {
      acc[trip.id] = trip;
      return acc;
    }, {});

    const memberMap = new Map<string, TripMember>();
    await Promise.all(
      trips.map(async (trip) => {
        const members = await repo.listTripMembers(trip.id);
        members.forEach((member) => memberMap.set(member.id, member));
      }),
    );

    const rows = modifications.map((mod) => ({
      ...mod,
      memberName: memberMap.get(mod.memberId)?.fullName ?? "-",
      tripName: tripMap[mod.tripId]?.name ?? "-",
      requestedByName: userMap.get(mod.requestedByUserId) ?? "-",
      processedByName: userMap.get(mod.processedByUserId ?? "") ?? "-",
    }));

    setItems(rows);
    setIsLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const markAsDone = async (request: ModificationRow) => {
    if (!canProcess || request.status === ContractModificationStatus.DONE) {
      return;
    }
    const processedAt = new Date().toISOString();
    setItems((prev) =>
      prev.map((item) =>
        item.id === request.id
          ? {
              ...item,
              status: ContractModificationStatus.DONE,
              processedAt,
              processedByUserId: user.id,
              processedByName: user.name,
            }
          : item,
      ),
    );
    const updated = await repo.updateContractModification(request.id, {
      status: ContractModificationStatus.DONE,
      processedAt,
      processedByUserId: user.id,
    });
    if (updated) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === request.id
            ? {
                ...item,
                ...updated,
                processedByName: userMap.get(updated.processedByUserId ?? "") ?? "-",
              }
            : item,
        ),
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Modificaciones</h1>
          <p className="text-sm text-slate-600">Solicitudes de cambios enviadas por agentes.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadData()}>
          Actualizar
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-600">Cargando modificaciones...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">Sin solicitudes pendientes.</p>
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-[1250px] w-full border-collapse text-xs">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Pasajero</th>
                <th className="px-3 py-2">Viaje</th>
                <th className="px-3 py-2">Paso</th>
                <th className="px-3 py-2">Campos</th>
                <th className="px-3 py-2">Enviado por</th>
                <th className="px-3 py-2">Procesado por</th>
                <th className="px-3 py-2">Procesado el</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Accion</th>
              </tr>
            </thead>
            <tbody>
              {items.map((mod) => (
                <tr key={mod.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-600">{formatDate(mod.createdAt)}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{mod.memberName}</td>
                  <td className="px-3 py-2 text-slate-600">{mod.tripName}</td>
                  <td className="px-3 py-2 text-slate-600">{getStepLabel(mod.step)}</td>
                  <td className="px-3 py-2 text-slate-600">{formatPayload(mod.payload)}</td>
                  <td className="px-3 py-2 text-slate-600">{mod.requestedByName}</td>
                  <td className="px-3 py-2 text-slate-600">{mod.processedByName}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {mod.processedAt ? formatDate(mod.processedAt) : "-"}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {mod.status === ContractModificationStatus.PENDING ? "Pendiente" : "Listo"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/trips/${mod.tripId}?focus=${mod.memberId}`}
                        className="text-xs font-semibold text-cyan-600 hover:underline"
                      >
                        Ver ficha
                      </Link>
                      {canProcess ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={mod.status === ContractModificationStatus.DONE}
                          onClick={() => void markAsDone(mod)}
                        >
                          {mod.status === ContractModificationStatus.DONE ? "Listo" : "Marcar listo"}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}