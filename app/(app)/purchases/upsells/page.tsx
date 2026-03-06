"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PurchasesUpsellsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Upsells</h1>
          <p className="text-sm text-slate-600">Adicionales confirmados por el cliente.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Actualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Solicitudes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Sin upsells por procesar.</p>
        </CardContent>
      </Card>
    </div>
  );
}
