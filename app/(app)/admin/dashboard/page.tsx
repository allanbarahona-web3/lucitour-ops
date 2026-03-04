"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PayrollSettingsPanel } from "@/components/ops/PayrollSettingsPanel";
import { PayslipsPanel } from "@/components/ops/PayslipsPanel";
import { TimeTrackingPanel } from "@/components/ops/TimeTrackingPanel";
import { useSession } from "@/lib/auth/sessionContext";
import { getOpsRepo } from "@/lib/data/opsRepo";
import {
  ContractStatus,
  DocsStatus,
  ItineraryStatus,
  PassportStatus,
  type Trip,
  type TripMember,
} from "@/lib/types/ops";

interface DashboardStats {
  totalTrips: number;
  activeTrips: number;
  totalMembers: number;
  pendingMembers: number;
}

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
  });
  const [tripStatusCounts, setTripStatusCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const loadData = async () => {
      const trips = await repo.listTrips();
      const membersByTrip = await Promise.all(
        trips.map(async (trip) => repo.listTripMembers(trip.id)),
      );

      const allMembers = membersByTrip.flat();
      const pendingCount = allMembers.filter(isPending).length;

      const statusCounts = trips.reduce<Record<string, number>>((acc, trip) => {
        acc[trip.status] = (acc[trip.status] ?? 0) + 1;
        return acc;
      }, {});

      setStats({
        totalTrips: trips.length,
        activeTrips: trips.filter((trip) => trip.status === "ACTIVE").length,
        totalMembers: allMembers.length,
        pendingMembers: pendingCount,
      });
      setTripStatusCounts(statusCounts);
    };

    void loadData();
  }, [repo]);

  if (user.role !== "ADMIN") {
    return <div className="text-sm text-slate-600">No autorizado</div>;
  }

  const maxStatusCount = Math.max(1, ...Object.values(tripStatusCounts));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-600">Resumen operativo general.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total viajes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">{stats.totalTrips}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Viajes activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">{stats.activeTrips}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total pasajeros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">{stats.totalMembers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">{stats.pendingMembers}</div>
          </CardContent>
        </Card>
      </div>

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
                  className="h-2 rounded-full bg-slate-900"
                  style={{ width: `${(count / maxStatusCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
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
