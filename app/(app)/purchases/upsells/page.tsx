"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOpsRepo } from "@/lib/data/opsRepo";
import { UpsellOrderStatus, type Trip, type TripMember, type UpsellOrder } from "@/lib/types/ops";

export default function PurchasesUpsellsPage() {
  const repo = useMemo(() => getOpsRepo(), []);
  const [rows, setRows] = useState<UpsellOrder[]>([]);
  const [tripMap, setTripMap] = useState<Record<string, Trip>>({});
  const [memberMap, setMemberMap] = useState<Record<string, TripMember>>({});
  const [isLoading, setIsLoading] = useState(true);

  const loadRows = async () => {
    setIsLoading(true);
    const [orders, trips] = await Promise.all([repo.listUpsellOrders(), repo.listTrips()]);
    const byTrip = trips.reduce<Record<string, Trip>>((acc, trip) => {
      acc[trip.id] = trip;
      return acc;
    }, {});
    const membersByTrip = await Promise.all(
      trips.map(async (trip) => ({
        tripId: trip.id,
        members: await repo.listTripMembers(trip.id),
      })),
    );
    const byMember = membersByTrip.reduce<Record<string, TripMember>>((acc, block) => {
      block.members.forEach((member) => {
        acc[member.id] = member;
      });
      return acc;
    }, {});
    const sorted = orders
      .filter((order) => order.status !== UpsellOrderStatus.CANCELLED)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setTripMap(byTrip);
    setMemberMap(byMember);
    setRows(sorted);
    setIsLoading(false);
  };

  useEffect(() => {
    void loadRows();
    const interval = setInterval(() => {
      void loadRows();
    }, 15000);
    return () => clearInterval(interval);
  }, [repo]);

  const updateStatus = async (orderId: string, status: UpsellOrderStatus) => {
    await repo.updateUpsellOrder(orderId, { status });
    await loadRows();
  };

  const statusLabel: Record<UpsellOrderStatus, string> = {
    [UpsellOrderStatus.DRAFT]: "Borrador",
    [UpsellOrderStatus.SENT_TO_PURCHASES]: "Pendiente",
    [UpsellOrderStatus.IN_PROGRESS]: "En proceso",
    [UpsellOrderStatus.PURCHASED]: "Comprado",
    [UpsellOrderStatus.BILLED]: "Facturado",
    [UpsellOrderStatus.CANCELLED]: "Cancelado",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Upsells pendientes</h1>
          <p className="text-sm text-slate-600">Anexos enviados por agentes para compras y facturacion.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadRows()}>
          Actualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Solicitudes</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          {isLoading ? (
            <p className="text-sm text-slate-500">Cargando solicitudes...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500">Sin upsells por procesar.</p>
          ) : (
            <table className="min-w-[1200px] w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-600">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Pasajero</th>
                  <th className="px-3 py-2">Viaje</th>
                  <th className="px-3 py-2">Cotizacion</th>
                  <th className="px-3 py-2">Lineas</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Accion</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => {
                  const member = memberMap[order.tripMemberId];
                  const trip = tripMap[order.tripId];
                  return (
                    <tr key={order.id} className="border-t border-slate-100 align-top">
                      <td className="px-3 py-2 text-slate-600">
                        {new Date(order.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-slate-900 font-medium">{member?.fullName ?? "-"}</td>
                      <td className="px-3 py-2 text-slate-600">{trip?.name ?? "-"}</td>
                      <td className="px-3 py-2 text-slate-600">{order.quoteCode ?? "-"}</td>
                      <td className="px-3 py-2 text-slate-600">
                        <div className="space-y-1">
                          {order.lines.map((line) => (
                            <div key={line.id} className="text-xs">
                              {line.label} · {line.ownerName} · {line.quantity} x USD {line.unitPrice.toFixed(2)} = USD {line.totalPrice.toFixed(2)}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-900">USD {order.totalAmount.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          {statusLabel[order.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                          value={order.status}
                          onChange={(event) =>
                            void updateStatus(order.id, event.target.value as UpsellOrderStatus)
                          }
                        >
                          {Object.values(UpsellOrderStatus).map((status) => (
                            <option key={status} value={status}>
                              {statusLabel[status]}
                            </option>
                          ))}
                        </select>
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
