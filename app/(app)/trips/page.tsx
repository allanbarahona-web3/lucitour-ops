"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Resolver } from "react-hook-form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getOpsRepo } from "@/lib/data/opsRepo";
import { Role, type Trip } from "@/lib/types/ops";
import { useSession } from "@/lib/auth/sessionContext";
import { getTripCapacityMetrics, getTripMetrics } from "@/lib/utils/opsMetrics";

const tripSchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  dateFrom: z.string().min(1, "Fecha inicio requerida"),
  dateTo: z.string().min(1, "Fecha fin requerida"),
  maxSeats: z.coerce.number().min(1, "Capacidad requerida"),
});

type TripFormValues = z.infer<typeof tripSchema>;

interface TripRow {
  trip: Trip;
  passengerCount: number;
  completionPercent: number;
  usedSeats: number;
  maxSeats: number;
  capacityPercent: number;
  isClosed: boolean;
}

export default function TripsPage() {
  const repo = useMemo(() => getOpsRepo(), []);
  const router = useRouter();
  const { user } = useSession();
  const [rows, setRows] = useState<TripRow[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const form = useForm<TripFormValues>({
    resolver: zodResolver(tripSchema) as Resolver<TripFormValues>,
    defaultValues: {
      name: "",
      dateFrom: "",
      dateTo: "",
      maxSeats: 1,
    },
  });
  const canViewTrips = [Role.ADMIN, Role.AGENT, Role.SUPERVISOR].includes(user.role);

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

  const loadTrips = async () => {
    const trips = await repo.listTrips();
    const metrics = await Promise.all(
      trips.map(async (trip: Trip) => {
        const members = await repo.listTripMembers(trip.id);
        const { passengerCount, completionPercent } = getTripMetrics(members);
        const capacity = getTripCapacityMetrics(members, trip.maxSeats);
        return {
          trip,
          passengerCount,
          completionPercent,
          usedSeats: capacity.usedSeats,
          maxSeats: trip.maxSeats,
          capacityPercent: capacity.percent,
          isClosed: capacity.isClosed,
        };
      }),
    );
    setRows(metrics);
  };

  useEffect(() => {
    void loadTrips();
  }, []);

  const handleCreate = form.handleSubmit(async (values: TripFormValues) => {
    if (user.role !== "ADMIN") {
      return;
    }
    await repo.createTrip({
      ...values,
      status: "PLANNED",
    });
    await loadTrips();
    form.reset();
    setIsOpen(false);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Viajes</h1>
          <p className="text-sm text-slate-600">Gestiona los viajes activos y planeados.</p>
        </div>
        {user.role === "ADMIN" ? (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button>Nuevo viaje</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo viaje</DialogTitle>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleCreate}>
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input id="name" {...form.register("name")} />
                  {form.formState.errors.name ? (
                    <p className="text-xs text-red-600">
                      {form.formState.errors.name.message}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="dateFrom">Fecha inicio</Label>
                    <Input id="dateFrom" type="date" {...form.register("dateFrom")} />
                    {form.formState.errors.dateFrom ? (
                      <p className="text-xs text-red-600">
                        {form.formState.errors.dateFrom.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateTo">Fecha fin</Label>
                    <Input id="dateTo" type="date" {...form.register("dateTo")} />
                    {form.formState.errors.dateTo ? (
                      <p className="text-xs text-red-600">
                        {form.formState.errors.dateTo.message}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Crear viaje</Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxSeats">Capacidad maxima</Label>
                  <Input
                    id="maxSeats"
                    type="number"
                    min={1}
                    {...form.register("maxSeats", { valueAsNumber: true })}
                  />
                  {form.formState.errors.maxSeats ? (
                    <p className="text-xs text-red-600">
                      {form.formState.errors.maxSeats.message}
                    </p>
                  ) : null}
                </div>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <Card
            key={row.trip.id}
            className="cursor-pointer transition hover:border-slate-300"
            onClick={() => router.push(`/trips/${row.trip.id}`)}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle>{row.trip.name}</CardTitle>
                {row.isClosed ? (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                    Cerrado
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-500">
                {row.trip.dateFrom} - {row.trip.dateTo}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Pasajeros</span>
                <span className="font-semibold text-slate-900">
                  {row.usedSeats} / {row.maxSeats}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Capacidad</span>
                  <span
                    className={`font-semibold ${
                      row.isClosed ? "text-rose-600" : "text-slate-900"
                    }`}
                  >
                    {row.capacityPercent}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100">
                  <div
                    className={`h-2 rounded-full ${
                      row.isClosed ? "bg-rose-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${row.capacityPercent}%` }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Completitud</span>
                  <span className="font-semibold text-slate-900">
                    {row.completionPercent}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-slate-900"
                    style={{ width: `${row.completionPercent}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
