"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { getOpsRepo } from "../../../lib/data/opsRepo";
import { useSession } from "../../../lib/auth/sessionContext";
import {
  ContractStatus,
  ItineraryStatus,
  PassportStatus,
  type Trip,
  type TripMember,
} from "../../../lib/types/ops";

const groupLabels = {
  passport: "Pasaporte",
  contract: "Contrato",
  itinerary: "Itinerario",
} as const;

type QueueGroupKey = keyof typeof groupLabels;

type QueueItem = {
  key: QueueGroupKey;
  member: TripMember;
};

const getMemberGroups = (member: TripMember): QueueGroupKey[] => {
  const groups: QueueGroupKey[] = [];

  if (member.passportStatus === PassportStatus.NOT_ENTERED) {
    groups.push("passport");
  }

  if (member.contractStatus === ContractStatus.MISSING) {
    groups.push("contract");
  }

  if (member.itineraryStatus === ItineraryStatus.MISSING) {
    groups.push("itinerary");
  }

  return groups;
};

export default function MyQueuePage() {
  const repo = useMemo(() => getOpsRepo(), []);
  const { user } = useSession();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [tripMap, setTripMap] = useState<Record<string, Trip>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadQueue = async () => {
      setIsLoading(true);
      const [queueMembers, trips] = await Promise.all([
        repo.deriveQueue(user.id),
        repo.listTrips(),
      ]);

      const nextTripMap = trips.reduce<Record<string, Trip>>((acc, trip) => {
        acc[trip.id] = trip;
        return acc;
      }, {});

      const nextItems = queueMembers.flatMap((member) =>
        getMemberGroups(member).map((group) => ({ key: group, member })),
      );

      setTripMap(nextTripMap);
      setItems(nextItems);
      setIsLoading(false);
    };

    void loadQueue();
  }, [repo, user.id]);

  const grouped = useMemo(() => {
    return items.reduce<Record<QueueGroupKey, QueueItem[]>>(
      (acc, item) => {
        acc[item.key].push(item);
        return acc;
      },
      { passport: [], contract: [], itinerary: [] },
    );
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Mi cola</h1>
          <p className="text-sm text-slate-600">Pendientes asignados a ti.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Actualizar
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-600">Cargando pendientes...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(Object.keys(grouped) as QueueGroupKey[]).map((key) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle>{groupLabels[key]}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {grouped[key].length === 0 ? (
                  <p className="text-sm text-slate-500">Sin pendientes</p>
                ) : (
                  grouped[key].map(({ member }) => {
                    const trip = tripMap[member.tripId];
                    return (
                      <Link
                        key={`${key}-${member.id}`}
                        href={`/trips/${member.tripId}?focus=${member.id}`}
                        className="block rounded-md border border-slate-200 px-3 py-2 text-sm transition hover:border-slate-300"
                      >
                        <div className="font-medium text-slate-900">{member.fullName}</div>
                        <div className="text-xs text-slate-500">
                          {trip ? trip.name : "Viaje"} · {member.reservationCode}
                        </div>
                      </Link>
                    );
                  })
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
