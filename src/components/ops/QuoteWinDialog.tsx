"use client";

import { useEffect, useMemo, useState } from "react";
import type { Resolver } from "react-hook-form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import type {
  CatalogItem,
  CatalogName,
  CreateTripMemberInput,
  Lead,
  TripMember,
  User,
} from "../../lib/types/ops";
import {
  BillingStatus,
  ContractStatus,
  ContractsStatus,
  DocsStatus,
  ItineraryStatus,
  MaritalStatus,
  PassportStatus,
  QuoteStatus,
} from "../../lib/types/ops";
import type { IOpsRepo } from "../../lib/data/opsRepo";

const formSchema = z.object({
  tripName: z.string().min(2, "Nombre de viaje requerido"),
  dateFrom: z.string().min(1, "Fecha inicio requerida"),
  dateTo: z.string().min(1, "Fecha fin requerida"),
  maxSeats: z.coerce.number().min(1, "Cupo requerido"),
  fullName: z.string().min(2, "Nombre requerido"),
  phone: z.string().min(3, "Telefono requerido"),
  email: z.string().min(3, "Correo requerido").email("Correo invalido"),
  identificationTypeId: z.string().min(1, "Tipo requerido"),
  identification: z.string().min(1, "Identificacion requerida"),
  seats: z.coerce.number().min(1, "Asientos requeridos"),
  luggage: z.boolean().default(false),
  airlineId: z.string().min(1, "Aerolinea requerida"),
  lodgingTypeId: z.string().min(1, "Hospedaje requerido"),
  accommodationId: z.string().min(1, "Acomodacion requerida"),
  insuranceId: z.string().min(1, "Seguro requerido"),
  nationalityId: z.string().min(1, "Nacionalidad requerida"),
  address: z.string().min(2, "Direccion requerida"),
  maritalStatus: z.string().optional(),
  profession: z.string().min(2, "Profesion requerida"),
  emergencyContactName: z.string().min(2, "Contacto requerido"),
  emergencyContactPhone: z.string().min(3, "Telefono requerido"),
  specialSituations: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type CatalogMap = Record<CatalogName, CatalogItem[]>;

interface QuoteWinDialogProps {
  open: boolean;
  lead: Lead | null;
  repo: IOpsRepo;
  catalogs: CatalogMap;
  currentUser: User;
  onClose: () => void;
  onCompleted: (lead: Lead, member: TripMember) => void;
}

const selectClassName =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900";

const maritalOptions = [
  { value: MaritalStatus.SINGLE, label: "Soltero" },
  { value: MaritalStatus.MARRIED, label: "Casado" },
  { value: MaritalStatus.DIVORCED, label: "Divorciado" },
  { value: MaritalStatus.WIDOWED, label: "Viudo" },
];

export const QuoteWinDialog = ({
  open,
  lead,
  repo,
  catalogs,
  currentUser,
  onClose,
  onCompleted,
}: QuoteWinDialogProps) => {
  const [isSaving, setIsSaving] = useState(false);

  const defaultTripName = useMemo(() => {
    if (!lead) {
      return "";
    }
    const base = lead.quoteDestination || lead.fullName;
    return base ? `Cotizacion: ${base}` : "Cotizacion personalizada";
  }, [lead]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      tripName: "",
      dateFrom: "",
      dateTo: "",
      maxSeats: 1,
      fullName: "",
      phone: "",
      email: "",
      identificationTypeId: "",
      identification: "",
      seats: 1,
      luggage: false,
      airlineId: "",
      lodgingTypeId: "",
      accommodationId: "",
      insuranceId: "",
      nationalityId: "",
      address: "",
      maritalStatus: "",
      profession: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      specialSituations: "",
    },
  });

  useEffect(() => {
    if (!open || !lead) {
      return;
    }
    form.reset({
      tripName: defaultTripName,
      dateFrom: "",
      dateTo: "",
      maxSeats: 1,
      fullName: lead.fullName,
      phone: lead.phone,
      email: lead.email,
      identificationTypeId: lead.identificationTypeId,
      identification: lead.identification,
      seats: 1,
      luggage: false,
      airlineId: "",
      lodgingTypeId: "",
      accommodationId: "",
      insuranceId: "",
      nationalityId: "",
      address: "",
      maritalStatus: "",
      profession: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      specialSituations: "",
    });
  }, [defaultTripName, form, lead, open]);

  const handleSave = form.handleSubmit(async (values: FormValues, event) => {
    if (!lead) {
      return;
    }
    const isDraft = (event?.nativeEvent as SubmitEvent | undefined)?.submitter?.id ===
      "quote-save-draft";

    setIsSaving(true);
    const now = new Date().toISOString();
    const trip = await repo.createTrip({
      name: values.tripName,
      dateFrom: values.dateFrom,
      dateTo: values.dateTo,
      status: "PLANNED",
      maxSeats: values.maxSeats,
      lodgingType: "HOTEL",
      packageBasePrice: 0,
      reservationMinPerPerson: 0,
    });

    const payload: CreateTripMemberInput = {
      fullName: values.fullName,
      phone: values.phone,
      email: values.email,
      reservationCode: "",
      identificationTypeId: values.identificationTypeId,
      identification: values.identification,
      seats: values.seats,
      luggage: values.luggage,
      airlineId: values.airlineId,
      lodgingTypeId: values.lodgingTypeId,
      accommodationId: values.accommodationId,
      insuranceId: values.insuranceId,
      nationalityId: values.nationalityId,
      contractStatus: ContractStatus.MISSING,
      docsStatus: DocsStatus.NOT_UPLOADED,
      passportStatus: PassportStatus.NOT_ENTERED,
      itineraryStatus: ItineraryStatus.MISSING,
      details: "",
      wantsReservation: true,
      packageName: lead.quoteDestination || values.tripName,
      packageLodgingType: "",
      packageBasePrice: 0,
      packageFinalPrice: 0,
      reservationMinPerPerson: 0,
      reservationFinalPerPerson: 0,
      paymentPlanMonths: null,
      accommodationType: "",
      seatUnitPrice: null,
      luggageType: "",
      luggageQuantity: null,
      luggageUnitPrice: null,
      extraTours: [],
      address: values.address,
      maritalStatus: (values.maritalStatus as MaritalStatus) || "",
      profession: values.profession,
      wantsInsurance: null,
      hasOwnInsurance: null,
      emergencyContactName: values.emergencyContactName,
      emergencyContactPhone: values.emergencyContactPhone,
      specialSituations: values.specialSituations ?? "",
      hasCompanions: null,
      companions: [],
      hasMinorCompanions: false,
      hasParentalAuthority: null,
      documents: [],
      docFlags: {
        idCard: false,
        passport: false,
        minorPermit: false,
        insurance: false,
        paymentProof: false,
      },
      isDraft,
      contractsStatus: isDraft ? ContractsStatus.NOT_SENT : ContractsStatus.SENT,
      contractsSentByUserId: isDraft ? null : currentUser.id,
      contractsSentAt: isDraft ? null : now,
      contractsWorkflowStatus: null,
      contractsTakenByUserId: null,
      contractsTakenAt: null,
      contractsStatusUpdatedAt: null,
      billingStatus: isDraft ? BillingStatus.NOT_SENT : BillingStatus.SENT,
      billingSentByUserId: isDraft ? null : currentUser.id,
      billingSentAt: isDraft ? null : now,
      billingStatusUpdatedAt: isDraft ? null : now,
      billingTotalAmount: null,
      quoteCode: lead.quoteCode || null,
      assignedToUserId: currentUser.id,
    };

    const member = await repo.createTripMember(trip.id, payload);
    const updatedLead = await repo.updateLead(lead.id, {
      quoteStatus: QuoteStatus.WON,
      quoteTripId: trip.id,
      quoteTripMemberId: member.id,
      quoteStatusUpdatedAt: now,
      quoteWonAt: now,
    });

    if (updatedLead) {
      onCompleted(updatedLead, member);
    }
    setIsSaving(false);
    onClose();
  });

  const catalogOptions = useMemo(
    () => ({
      airlines: catalogs.airlines,
      lodgingTypes: catalogs.lodgingTypes,
      accommodations: catalogs.accommodations,
      insurances: catalogs.insurances,
      nationalities: catalogs.nationalities,
      identificationTypes: catalogs.identificationTypes,
    }),
    [catalogs],
  );

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cotizacion ganada</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSave}>
          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-900">Viaje</div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Nombre del viaje</Label>
                <Input {...form.register("tripName")} />
              </div>
              <div className="space-y-1">
                <Label>Cupos maximos</Label>
                <Input type="number" min={1} {...form.register("maxSeats")} />
              </div>
              <div className="space-y-1">
                <Label>Fecha inicio</Label>
                <Input type="date" {...form.register("dateFrom")} />
              </div>
              <div className="space-y-1">
                <Label>Fecha fin</Label>
                <Input type="date" {...form.register("dateTo")} />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-900">Pasajero</div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Nombre completo</Label>
                <Input {...form.register("fullName")} />
              </div>
              <div className="space-y-1">
                <Label>Telefono</Label>
                <Input {...form.register("phone")} />
              </div>
              <div className="space-y-1">
                <Label>Correo</Label>
                <Input type="email" {...form.register("email")} />
              </div>
              <div className="space-y-1">
                <Label>Tipo de identificacion</Label>
                <select className={selectClassName} {...form.register("identificationTypeId")}>
                  <option value="">Selecciona...</option>
                  {catalogOptions.identificationTypes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Identificacion</Label>
                <Input {...form.register("identification")} />
              </div>
              <div className="space-y-1">
                <Label>Asientos</Label>
                <Input type="number" min={1} {...form.register("seats")} />
              </div>
              <div className="space-y-1">
                <Label>Equipaje</Label>
                <div className="flex items-center gap-2 text-sm">
                  <input type="checkbox" {...form.register("luggage")} />
                  <span>Incluye maleta</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Aerolinea</Label>
                <select className={selectClassName} {...form.register("airlineId")}>
                  <option value="">Selecciona...</option>
                  {catalogOptions.airlines.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Hospedaje</Label>
                <select className={selectClassName} {...form.register("lodgingTypeId")}>
                  <option value="">Selecciona...</option>
                  {catalogOptions.lodgingTypes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Acomodacion</Label>
                <select className={selectClassName} {...form.register("accommodationId")}>
                  <option value="">Selecciona...</option>
                  {catalogOptions.accommodations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Seguro</Label>
                <select className={selectClassName} {...form.register("insuranceId")}>
                  <option value="">Selecciona...</option>
                  {catalogOptions.insurances.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Nacionalidad</Label>
                <select className={selectClassName} {...form.register("nationalityId")}>
                  <option value="">Selecciona...</option>
                  {catalogOptions.nationalities.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Direccion</Label>
                <Input {...form.register("address")} />
              </div>
              <div className="space-y-1">
                <Label>Estado civil</Label>
                <select className={selectClassName} {...form.register("maritalStatus")}>
                  <option value="">Selecciona...</option>
                  {maritalOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Profesion</Label>
                <Input {...form.register("profession")} />
              </div>
              <div className="space-y-1">
                <Label>Contacto emergencia</Label>
                <Input {...form.register("emergencyContactName")} />
              </div>
              <div className="space-y-1">
                <Label>Telefono emergencia</Label>
                <Input {...form.register("emergencyContactPhone")} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Situaciones especiales</Label>
                <Input {...form.register("specialSituations")} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button id="quote-save-draft" type="submit" variant="outline" disabled={isSaving}>
              Guardar borrador
            </Button>
            <Button type="submit" disabled={isSaving}>
              Enviar a contratos
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
