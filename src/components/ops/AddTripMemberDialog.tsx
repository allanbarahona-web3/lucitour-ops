"use client";

import { useEffect, useMemo, useState } from "react";
import type { Resolver } from "react-hook-form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import type { CatalogItem, CatalogName, CreateTripMemberInput, User } from "../../lib/types/ops";
import type { IOpsRepo } from "../../lib/data/opsRepo";
import {
  ContractsStatus,
  ContractStatus,
  DocsStatus,
  ItineraryStatus,
  PassportStatus,
  BillingStatus,
  QuoteStatus,
  Role,
} from "../../lib/types/ops";
import { AddCatalogItemDialog } from "./AddCatalogItemDialog";

const adminSchema = z.object({
  fullName: z.string().min(2, "Nombre requerido"),
  phone: z.string().min(3, "Telefono requerido"),
  identificationTypeId: z.string().min(1, "Tipo requerido"),
  identification: z.string().min(1, "Identificacion requerida"),
  seats: z.coerce.number().min(1, "Asientos requeridos"),
  luggage: z.boolean().default(false),
  airlineId: z.string().min(1, "Aerolinea requerida"),
  lodgingTypeId: z.string().min(1, "Hospedaje requerido"),
  accommodationId: z.string().min(1, "Acomodacion requerida"),
  insuranceId: z.string().min(1, "Seguro requerido"),
  nationalityId: z.string().min(1, "Nacionalidad requerida"),
  assignedToUserId: z.string().optional(),
});

const agentSchema = z.object({
  fullName: z.string().min(2, "Nombre requerido"),
  phone: z.string().min(3, "Telefono requerido"),
  email: z.string().min(3, "Correo requerido").email("Correo invalido"),
  identificationTypeId: z.string().min(1, "Tipo requerido"),
  identification: z.string().min(1, "Identificacion requerida"),
  wantsReservation: z.enum(["YES", "NO", "QUOTE"]),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof adminSchema> & Partial<z.infer<typeof agentSchema>>;

type CatalogMap = Record<CatalogName, CatalogItem[]>;

interface AddTripMemberDialogProps {
  tripId: string;
  tripName: string;
  tripLodgingType: CreateTripMemberInput["packageLodgingType"];
  tripPackageBasePrice: number;
  tripReservationMinPerPerson: number;
  repo: IOpsRepo;
  users: User[];
  currentUser: User;
  catalogs: CatalogMap;
  maxSeatsRemaining: number;
  isTripClosed: boolean;
  onMemberCreated: () => Promise<void>;
  onCatalogAdded: (catalogName: CatalogName, item: CatalogItem) => void;
}

const selectClassName =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900";

const generateReservationCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  const now = new Date();
  const month = months[now.getMonth()] ?? "MES";
  const year = String(now.getFullYear()).slice(-2);
  let suffix = "";
  for (let i = 0; i < 4; i += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${month}${year}${suffix}`;
};

const quoteMonthOptions = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export const AddTripMemberDialog = ({
  tripId,
  tripName,
  tripLodgingType,
  tripPackageBasePrice,
  tripReservationMinPerPerson,
  repo,
  users,
  currentUser,
  catalogs,
  maxSeatsRemaining,
  isTripClosed,
  onMemberCreated,
  onCatalogAdded,
}: AddTripMemberDialogProps) => {
  const [open, setOpen] = useState(false);
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false);
  const [catalogToAdd, setCatalogToAdd] = useState<CatalogName | null>(null);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [quoteLeadId, setQuoteLeadId] = useState<string | null>(null);
  const [quoteDestination, setQuoteDestination] = useState("");
  const [quoteMonthValue, setQuoteMonthValue] = useState("");
  const [quoteYearValue, setQuoteYearValue] = useState("");
  const [isSavingQuote, setIsSavingQuote] = useState(false);
  const isAdmin = currentUser.role === Role.ADMIN;
  const isAgent = currentUser.role === Role.AGENT || currentUser.role === Role.SUPERVISOR;

  const form = useForm<FormValues>({
    resolver: zodResolver(isAgent ? agentSchema : adminSchema) as Resolver<FormValues>,
    defaultValues: {
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
      assignedToUserId: currentUser.id,
      wantsReservation: "YES",
      notes: "",
    },
  });

  const wantsReservation = form.watch("wantsReservation");

  useEffect(() => {
    if (!open) {
      form.reset({
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
        assignedToUserId: currentUser.id,
        wantsReservation: "YES",
        notes: "",
      });
    }
  }, [open, form, currentUser.id]);

  const handleSubmit = form.handleSubmit(async (values: FormValues) => {
    const wantsReservation = isAgent ? values.wantsReservation : "YES";
    if (isAgent && wantsReservation === "NO") {
      form.setError("wantsReservation", { message: "Usa Convertir en lead." });
      return;
    }

    if (isTripClosed) {
      form.setError("seats", { message: "Viaje cerrado, sin cupos." });
      return;
    }
    if (values.seats && values.seats > maxSeatsRemaining) {
      form.setError("seats", {
        message: `Solo hay ${maxSeatsRemaining} cupos disponibles.`,
      });
      return;
    }

    const seats = typeof values.seats === "number" ? values.seats : 1;

    if (isAgent && wantsReservation === "QUOTE") {
      const lead = await repo.createLead({
        agentUserId: currentUser.id,
        fullName: values.fullName,
        identificationTypeId: values.identificationTypeId,
        identification: values.identification,
        phone: values.phone,
        email: values.email ?? "",
        wantsReservation: false,
        notes: values.notes ?? "",
        quoteDestination: "",
        quoteTravelMonth: "",
        quoteStatus: QuoteStatus.PENDING,
      });
      setQuoteLeadId(lead.id);
      setQuoteDestination("");
      setQuoteMonthValue("");
      setQuoteYearValue(String(new Date().getFullYear()));
      setQuoteDialogOpen(true);
      setOpen(false);
      return;
    }

    const payload: CreateTripMemberInput = {
      fullName: values.fullName,
      phone: values.phone,
      email: values.email ?? "",
      reservationCode: generateReservationCode(),
      identificationTypeId: values.identificationTypeId,
      identification: values.identification,
      seats,
      luggage: values.luggage ?? false,
      airlineId: values.airlineId ?? "",
      lodgingTypeId: values.lodgingTypeId ?? "",
      accommodationId: values.accommodationId ?? "",
      insuranceId: values.insuranceId ?? "",
      nationalityId: values.nationalityId ?? "",
      contractStatus: ContractStatus.MISSING,
      docsStatus: DocsStatus.NOT_UPLOADED,
      passportStatus: PassportStatus.NOT_ENTERED,
      itineraryStatus: ItineraryStatus.MISSING,
      details: "",
      wantsReservation: true,
      packageName: tripName,
      packageLodgingType: tripLodgingType,
      packageBasePrice: tripPackageBasePrice,
      packageFinalPrice: tripPackageBasePrice * seats,
      reservationMinPerPerson: tripReservationMinPerPerson,
      reservationFinalPerPerson: tripReservationMinPerPerson,
      paymentPlanMonths: null,
      accommodationType: "",
      seatUnitPrice: null,
      luggageType: "",
      luggageQuantity: null,
      luggageUnitPrice: null,
      extraTours: [],
      address: "",
      maritalStatus: "",
      profession: "",
      wantsInsurance: null,
      hasOwnInsurance: null,
      emergencyContactName: "",
      emergencyContactPhone: "",
      specialSituations: "",
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
      isDraft: false,
      contractsStatus: ContractsStatus.NOT_SENT,
      contractsSentByUserId: null,
      contractsSentAt: null,
      contractsWorkflowStatus: null,
      contractsTakenByUserId: null,
      contractsTakenAt: null,
      contractsStatusUpdatedAt: null,
      billingStatus: BillingStatus.NOT_SENT,
      billingSentByUserId: null,
      billingSentAt: null,
      billingStatusUpdatedAt: null,
      billingTotalAmount: null,
      assignedToUserId: values.assignedToUserId ?? currentUser.id,
    };

    await repo.createTripMember(tripId, payload);
    await onMemberCreated();
    setOpen(false);
  });

  const handleConvertLead = async () => {
    const values = form.getValues();
    await repo.createLead({
      agentUserId: currentUser.id,
      fullName: values.fullName,
      identificationTypeId: values.identificationTypeId,
      identification: values.identification,
      phone: values.phone,
      email: values.email ?? "",
      wantsReservation: false,
      notes: values.notes ?? "",
      quoteDestination: "",
      quoteTravelMonth: "",
      quoteStatus: QuoteStatus.PENDING,
    });
    setOpen(false);
  };

  const handleSendQuote = async () => {
    if (
      !quoteLeadId ||
      !quoteDestination.trim() ||
      !quoteMonthValue.trim() ||
      !quoteYearValue.trim()
    ) {
      return;
    }
    setIsSavingQuote(true);
    const travelMonth = `${quoteMonthValue} ${quoteYearValue}`;
    await repo.updateLead(quoteLeadId, {
      quoteDestination: quoteDestination.trim(),
      quoteTravelMonth: travelMonth,
      quoteStatus: QuoteStatus.SENT,
    });
    setIsSavingQuote(false);
    setQuoteDialogOpen(false);
    setQuoteLeadId(null);
  };

  const makeCatalogOptions = (catalogName: CatalogName) => {
    const base = catalogs[catalogName] ?? [];
    return isAdmin ? [...base, { id: "__add_new__", name: "+ Agregar nuevo...", active: true }] : base;
  };

  const handleCatalogSelect = (catalogName: CatalogName, value: string) => {
    if (value === "__add_new__") {
      setCatalogToAdd(catalogName);
      setCatalogDialogOpen(true);
      return "";
    }

    return value;
  };

  const catalogOptions = useMemo(
    () => ({
      airlines: makeCatalogOptions("airlines"),
      lodgingTypes: makeCatalogOptions("lodgingTypes"),
      accommodations: makeCatalogOptions("accommodations"),
      insurances: makeCatalogOptions("insurances"),
      nationalities: makeCatalogOptions("nationalities"),
      identificationTypes: makeCatalogOptions("identificationTypes"),
    }),
    [catalogs, isAdmin],
  );

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button disabled={isTripClosed && !isAgent}>Agregar pasajero</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar pasajero</DialogTitle>
          </DialogHeader>
          {isTripClosed ? (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-rose-600">
                NO HAY CUPOS DISPONIBLES PARA ESTE VIAJE.
              </p>
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cerrar
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nombre completo</Label>
              <Input id="fullName" {...form.register("fullName")} />
              {form.formState.errors.fullName ? (
                <p className="text-xs text-red-600">{form.formState.errors.fullName.message}</p>
              ) : null}
            </div>
            {isAgent ? (
              <div className="space-y-2">
                <Label htmlFor="email">Correo electronico</Label>
                <Input id="email" type="email" {...form.register("email")} />
                {form.formState.errors.email ? (
                  <p className="text-xs text-red-600">{form.formState.errors.email.message}</p>
                ) : null}
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefono</Label>
                <Input id="phone" {...form.register("phone")} />
                {form.formState.errors.phone ? (
                  <p className="text-xs text-red-600">{form.formState.errors.phone.message}</p>
                ) : null}
              </div>
              {isAgent ? (
                <div className="space-y-2">
                  <Label htmlFor="wantsReservation">Deseas reservar</Label>
                  <div className="flex items-center gap-4 text-sm text-slate-700">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="wantsReservation"
                        className="h-4 w-4 rounded-full border-slate-300"
                        checked={wantsReservation === "YES"}
                        onChange={() => form.setValue("wantsReservation", "YES")}
                      />
                      <span>Si</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="wantsReservation"
                        className="h-4 w-4 rounded-full border-slate-300"
                        checked={wantsReservation === "NO"}
                        onChange={() => form.setValue("wantsReservation", "NO")}
                      />
                      <span>No</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="wantsReservation"
                        className="h-4 w-4 rounded-full border-slate-300"
                        checked={wantsReservation === "QUOTE"}
                        onChange={() => form.setValue("wantsReservation", "QUOTE")}
                      />
                      <span>Cotizar</span>
                    </label>
                  </div>
                  {form.formState.errors.wantsReservation ? (
                    <p className="text-xs text-red-600">
                      {form.formState.errors.wantsReservation.message}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-600">Reserva</div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Se genera automaticamente al guardar.
                  </div>
                </div>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="identificationType">Tipo identificacion</Label>
                <select
                  id="identificationType"
                  className={selectClassName}
                  {...form.register("identificationTypeId")}
                  onChange={(event) => {
                    const nextValue = handleCatalogSelect(
                      "identificationTypes",
                      event.target.value,
                    );
                    form.setValue("identificationTypeId", nextValue, { shouldValidate: true });
                  }}
                >
                  <option value="">Selecciona</option>
                  {catalogOptions.identificationTypes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {form.formState.errors.identificationTypeId ? (
                  <p className="text-xs text-red-600">
                    {form.formState.errors.identificationTypeId.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="identification">Identificacion</Label>
                <Input id="identification" {...form.register("identification")} />
                {form.formState.errors.identification ? (
                  <p className="text-xs text-red-600">
                    {form.formState.errors.identification.message}
                  </p>
                ) : null}
              </div>
            </div>
            {isAgent ? (
              wantsReservation === "NO" ? (
                <div className="space-y-2">
                  <Label htmlFor="notes">Notas</Label>
                  <textarea
                    id="notes"
                    className="min-h-[120px] w-full rounded-md border border-slate-300 p-3 text-sm"
                    {...form.register("notes")}
                  />
                  <div className="flex justify-end">
                    <Button type="button" variant="outline" onClick={() => void handleConvertLead()}>
                      Convertir en lead
                    </Button>
                  </div>
                </div>
              ) : null
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="airline">Aerolinea</Label>
                    <select
                      id="airline"
                      className={selectClassName}
                      {...form.register("airlineId")}
                      onChange={(event) => {
                        const nextValue = handleCatalogSelect("airlines", event.target.value);
                        form.setValue("airlineId", nextValue, { shouldValidate: true });
                      }}
                    >
                      <option value="">Selecciona</option>
                      {catalogOptions.airlines.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    {form.formState.errors.airlineId ? (
                      <p className="text-xs text-red-600">{form.formState.errors.airlineId.message}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lodging">Hospedaje</Label>
                    <select
                      id="lodging"
                      className={selectClassName}
                      {...form.register("lodgingTypeId")}
                      onChange={(event) => {
                        const nextValue = handleCatalogSelect("lodgingTypes", event.target.value);
                        form.setValue("lodgingTypeId", nextValue, { shouldValidate: true });
                      }}
                    >
                      <option value="">Selecciona</option>
                      {catalogOptions.lodgingTypes.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    {form.formState.errors.lodgingTypeId ? (
                      <p className="text-xs text-red-600">{form.formState.errors.lodgingTypeId.message}</p>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="accommodation">Acomodacion</Label>
                    <select
                      id="accommodation"
                      className={selectClassName}
                      {...form.register("accommodationId")}
                      onChange={(event) => {
                        const nextValue = handleCatalogSelect("accommodations", event.target.value);
                        form.setValue("accommodationId", nextValue, { shouldValidate: true });
                      }}
                    >
                      <option value="">Selecciona</option>
                      {catalogOptions.accommodations.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    {form.formState.errors.accommodationId ? (
                      <p className="text-xs text-red-600">
                        {form.formState.errors.accommodationId.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="insurance">Seguro</Label>
                    <select
                      id="insurance"
                      className={selectClassName}
                      {...form.register("insuranceId")}
                      onChange={(event) => {
                        const nextValue = handleCatalogSelect("insurances", event.target.value);
                        form.setValue("insuranceId", nextValue, { shouldValidate: true });
                      }}
                    >
                      <option value="">Selecciona</option>
                      {catalogOptions.insurances.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    {form.formState.errors.insuranceId ? (
                      <p className="text-xs text-red-600">{form.formState.errors.insuranceId.message}</p>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="nationality">Nacionalidad</Label>
                    <select
                      id="nationality"
                      className={selectClassName}
                      {...form.register("nationalityId")}
                      onChange={(event) => {
                        const nextValue = handleCatalogSelect("nationalities", event.target.value);
                        form.setValue("nationalityId", nextValue, { shouldValidate: true });
                      }}
                    >
                      <option value="">Selecciona</option>
                      {catalogOptions.nationalities.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    {form.formState.errors.nationalityId ? (
                      <p className="text-xs text-red-600">{form.formState.errors.nationalityId.message}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="seats">Asientos</Label>
                    <Input id="seats" type="number" min={1} {...form.register("seats")} />
                    {form.formState.errors.seats ? (
                      <p className="text-xs text-red-600">{form.formState.errors.seats.message}</p>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="luggage">Equipaje</Label>
                    <select
                      id="luggage"
                      className={selectClassName}
                      {...form.register("luggage")}
                      onChange={(event) =>
                        form.setValue("luggage", event.target.value === "true", { shouldValidate: true })
                      }
                    >
                      <option value="false">No</option>
                      <option value="true">Si</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assignedTo">Asignado a</Label>
                    <select
                      id="assignedTo"
                      className={selectClassName}
                      {...form.register("assignedToUserId")}
                    >
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
            {isAgent && wantsReservation === "NO" ? null : (
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  Guardar
                </Button>
              </div>
            )}
          </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={quoteDialogOpen} onOpenChange={setQuoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar a cotizaciones</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="quoteDestination">Destino a cotizar</Label>
              <Input
                id="quoteDestination"
                value={quoteDestination}
                onChange={(event) => setQuoteDestination(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="quoteMonth">Mes a viajar</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  id="quoteMonth"
                  className={selectClassName}
                  value={quoteMonthValue}
                  onChange={(event) => setQuoteMonthValue(event.target.value)}
                >
                  <option value="">Mes</option>
                  {quoteMonthOptions.map((month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </select>
                <select
                  className={selectClassName}
                  value={quoteYearValue}
                  onChange={(event) => setQuoteYearValue(event.target.value)}
                >
                  <option value="">Ano</option>
                  {Array.from({ length: 6 }, (_, index) => {
                    const year = new Date().getFullYear() + index;
                    return (
                      <option key={year} value={String(year)}>
                        {year}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setQuoteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSendQuote()} disabled={isSavingQuote}>
              {isSavingQuote ? "Enviando..." : "Enviar a cotizaciones"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AddCatalogItemDialog
        open={catalogDialogOpen}
        onOpenChange={(nextOpen) => {
          setCatalogDialogOpen(nextOpen);
          if (!nextOpen) {
            setCatalogToAdd(null);
          }
        }}
        catalogName={catalogToAdd}
        repo={repo}
        onCreated={(item: CatalogItem) => {
          if (!catalogToAdd) {
            return;
          }

          onCatalogAdded(catalogToAdd, item);

          const fieldMap: Record<CatalogName, keyof FormValues> = {
            airlines: "airlineId",
            lodgingTypes: "lodgingTypeId",
            accommodations: "accommodationId",
            insurances: "insuranceId",
            nationalities: "nationalityId",
            identificationTypes: "identificationTypeId",
          };

          const field = fieldMap[catalogToAdd];
          form.setValue(field, item.id, { shouldValidate: true });
          setCatalogDialogOpen(false);
          setCatalogToAdd(null);
        }}
      />
    </>
  );
};
