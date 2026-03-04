"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOpsRepo } from "@/lib/data/opsRepo";
import { useSession } from "@/lib/auth/sessionContext";
import {
  ContractsStatus,
  ContractStatus,
  DocsStatus,
  PassportStatus,
  QuoteStatus,
  type Trip,
  type TripMember,
} from "@/lib/types/ops";

const groupLabels = {
  contract: "Contratos Procesados",
  identification: "Identificaciones",
} as const;

type QueueGroupKey = keyof typeof groupLabels;

type QueueItem = {
  key: QueueGroupKey;
  member: TripMember;
};

type SentItem = {
  member: TripMember;
  trip: Trip | null;
};

const getMemberGroups = (member: TripMember): QueueGroupKey[] => {
  const groups: QueueGroupKey[] = [];

  if (member.contractStatus === ContractStatus.MISSING) {
    groups.push("contract");
  }

  if (
    member.passportStatus === PassportStatus.NOT_ENTERED ||
    member.docsStatus === DocsStatus.NOT_UPLOADED
  ) {
    groups.push("identification");
  }

  return groups;
};

export default function MyQueuePage() {
  const repo = useMemo(() => getOpsRepo(), []);
  const { user } = useSession();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [tripMap, setTripMap] = useState<Record<string, Trip>>({});
  const [sentItems, setSentItems] = useState<SentItem[]>([]);
  const [contractItems, setContractItems] = useState<TripMember[]>([]);
  const [quoteCount, setQuoteCount] = useState(0);
  const [billingCount, setBillingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadQueue = async () => {
      setIsLoading(true);
      const [queueMembers, trips, leads] = await Promise.all([
        repo.deriveQueue(user.id),
        repo.listTrips(),
        repo.listLeads(),
      ]);

      const nextTripMap = trips.reduce<Record<string, Trip>>((acc, trip) => {
        acc[trip.id] = trip;
        return acc;
      }, {});

      const nextItems = queueMembers.flatMap((member) =>
        getMemberGroups(member).map((group) => ({ key: group, member })),
      );

      const tripMembersByTrip = await Promise.all(
        trips.map(async (trip) => ({
          trip,
          members: await repo.listTripMembers(trip.id),
        })),
      );
      const nextContractItems = tripMembersByTrip
        .flatMap(({ members }) => members)
        .filter(
          (member) =>
            member.contractStatus === ContractStatus.SENT &&
            member.assignedToUserId === user.id,
        );

      const nextSentItems = tripMembersByTrip
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
        );

      const nextBillingCount = tripMembersByTrip
        .flatMap(({ members }) => members)
        .filter(
          (member) => member.billingStatus === "SENT" && member.assignedToUserId === user.id,
        ).length;

      const nextQuoteCount = leads.filter(
        (lead) => lead.agentUserId === user.id && lead.quoteStatus !== QuoteStatus.PENDING,
      ).length;

      setTripMap(nextTripMap);
      setItems(nextItems);
      setSentItems(nextSentItems);
      setContractItems(nextContractItems);
      setQuoteCount(nextQuoteCount);
      setBillingCount(nextBillingCount);
      setIsLoading(false);
    };

    void loadQueue();
    const interval = setInterval(() => {
      void loadQueue();
    }, 15000);
    return () => clearInterval(interval);
  }, [repo, user.id]);

  const grouped = useMemo(() => {
    return items.reduce<Record<QueueGroupKey, QueueItem[]>>(
      (acc, item) => {
        acc[item.key].push(item);
        return acc;
      },
      { contract: [], identification: [] },
    );
  }, [items]);


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard Agentes</h1>
          <p className="text-sm text-slate-600">Pendientes asignados a ti.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Actualizar
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-600">Cargando pendientes...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {([
            {
              key: "contract" as QueueGroupKey,
              href: "/my-queue/contracts",
              count: contractItems.length,
            },
            {
              key: "identification" as QueueGroupKey,
              href: "/my-queue/identifications",
              count: grouped.identification.length,
            },
            {
              key: "sent" as const,
              href: "/my-queue/sent",
              count: sentItems.length,
            },
            {
              key: "quotes" as const,
              href: "/my-queue/quotes",
              count: quoteCount,
            },
            {
              key: "billing" as const,
              href: "/my-queue/billing",
              count: billingCount,
            },
          ]).map((item) => (
            <Link key={item.href} href={item.href} className="block">
              <Card className="h-full transition hover:border-slate-300">
                <CardHeader>
                  <CardTitle>
                    {item.key === "sent"
                      ? "Contratos en revision"
                      : item.key === "quotes"
                        ? "Cotizaciones enviadas"
                        : item.key === "billing"
                          ? "Estados de cuenta"
                          : groupLabels[item.key]}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold text-slate-900">{item.count}</div>
                  <div className="text-xs text-slate-500">Registros</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
