"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const cards = [
  {
    href: "/purchases/flights",
    title: "Vuelos",
    description: "Compras de boletos pendientes.",
  },
  {
    href: "/purchases/insurances",
    title: "Seguros",
    description: "Polizas solicitadas por agentes.",
  },
  {
    href: "/purchases/upsells",
    title: "Upsells",
    description: "Adicionales confirmados por el cliente.",
  },
  {
    href: "/purchases/check-in",
    title: "Check-in aereo",
    description: "Pases de abordaje en proceso.",
  },
];

export default function PurchasesDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard Compras</h1>
        <p className="text-sm text-slate-600">
          Gestiona vuelos, seguros, upsells y check-in aereo.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="block">
            <Card className="h-full transition hover:border-slate-300">
              <CardHeader>
                <CardTitle>{card.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-semibold text-slate-900">0</div>
                <div className="text-xs text-slate-500">Solicitudes</div>
                <p className="text-sm text-slate-600">{card.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
