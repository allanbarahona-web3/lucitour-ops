"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TripMembersTable } from "@/components/ops/TripMembersTable";
import { getOpsRepo } from "@/lib/data/opsRepo";
import { useSession } from "@/lib/auth/sessionContext";
import { users } from "@/lib/auth/mockSession";
import { Role, type Trip } from "@/lib/types/ops";

interface TripDetailPageProps {
  params: { tripId: string };
}

export default function TripDetailPage({ params }: TripDetailPageProps) {
  const repo = useMemo(() => getOpsRepo(), []);
  const router = useRouter();
  const { user } = useSession();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const canViewTrips = [Role.ADMIN, Role.AGENT, Role.SUPERVISOR].includes(user.role);

  useEffect(() => {
    const loadTrip = async () => {
      setIsLoading(true);
      const data = await repo.getTrip(params.tripId);
      setTrip(data);
      setIsLoading(false);
    };

    void loadTrip();
  }, [params.tripId, repo]);

  if (!canViewTrips) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold text-slate-900">Viajes</h1>
        <p className="text-sm text-slate-600">
          No tienes permisos para ver esta seccion.
        </p>
        <Button variant="outline" onClick={() => router.push("/my-queue")}>Volver</Button>
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-sm text-slate-600">Cargando viaje...</div>;
  }

  if (!trip) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Viaje no encontrado.</p>
        <Button variant="outline" onClick={() => router.push("/trips")}>Volver</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button variant="outline" size="sm" onClick={() => router.push("/trips")}>
            Volver
          </Button>
          <h1 className="mt-3 text-2xl font-semibold text-slate-900">{trip.name}</h1>
          <p className="text-sm text-slate-600">
            {trip.dateFrom} - {trip.dateTo}
          </p>
        </div>
      </div>

      <TripMembersTable
        tripId={trip.id}
        tripName={trip.name}
        tripDateFrom={trip.dateFrom}
        tripDateTo={trip.dateTo}
        repo={repo}
        users={users}
        currentUser={user}
        maxSeats={trip.maxSeats}
      />
    </div>
  );
}
