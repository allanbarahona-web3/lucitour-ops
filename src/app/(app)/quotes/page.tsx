"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QuoteWinDialog } from "@/components/ops/QuoteWinDialog";
import { getOpsRepo } from "@/lib/data/opsRepo";
import { useSession } from "@/lib/auth/sessionContext";
import {
  BillingStatus,
  ContractsStatus,
  QuoteStatus,
  type BillingConfig,
  type QuoteDraft,
  type QuoteDraftSection,
  type QuoteLodgingStay,
  type QuotePriceType,
  type CatalogItem,
  type CatalogName,
  type Lead,
  type TripMember,
} from "@/lib/types/ops";

export default function QuotesPage() {
  const repo = useMemo(() => getOpsRepo(), []);
  const { user, users } = useSession();
  const [rows, setRows] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<QuoteStatus>(QuoteStatus.SENT);
  const [winLead, setWinLead] = useState<Lead | null>(null);
  const [newQuoteOpen, setNewQuoteOpen] = useState(false);
  const [newQuoteError, setNewQuoteError] = useState("");
  const [isCreatingLead, setIsCreatingLead] = useState(false);
  const [newQuoteDraft, setNewQuoteDraft] = useState({
    fullName: "",
    identificationTypeId: "",
    identification: "",
    phone: "",
    email: "",
    quoteDestination: "",
    quoteTravelMonth: "",
    notes: "",
  });
  const [exchangeRate, setExchangeRate] = useState(500);
  const [quoteConfig, setQuoteConfig] = useState<BillingConfig | null>(null);
  const [quoteWizardOpen, setQuoteWizardOpen] = useState(false);
  const [quoteWizardStep, setQuoteWizardStep] = useState(0);
  const [quoteWizardLead, setQuoteWizardLead] = useState<Lead | null>(null);
  const [draftSavedMessage, setDraftSavedMessage] = useState("");
  const [quoteLeadDraft, setQuoteLeadDraft] = useState({
    quoteDestination: "",
    quoteTravelMonth: "",
    quoteTravelDateFrom: "",
    quoteTravelDateTo: "",
    quotePartySize: "",
    notes: "",
  });
  const [quoteDraft, setQuoteDraft] = useState<QuoteDraft | null>(null);
  const [quoteDraftError, setQuoteDraftError] = useState("");
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [memberById, setMemberById] = useState<Map<string, TripMember>>(new Map());
  const [catalogs, setCatalogs] = useState<Record<CatalogName, CatalogItem[]>>({
    airlines: [],
    lodgingTypes: [],
    accommodations: [],
    insurances: [],
    nationalities: [],
    identificationTypes: [],
  });

  const userById = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((user) => map.set(user.id, user.name));
    return map;
  }, [users]);

  const statusTabs = useMemo(
    () => [
      { id: QuoteStatus.SENT, label: "En cola" },
      { id: QuoteStatus.IN_PROGRESS, label: "En proceso" },
      { id: QuoteStatus.OFFER_SENT, label: "Cotizacion enviada" },
      { id: QuoteStatus.WON, label: "Ganada" },
      { id: QuoteStatus.PAUSED, label: "En pausa" },
      { id: QuoteStatus.LOST, label: "Perdida" },
    ],
    [],
  );

  const makeDraftItemId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const buildDefaultDraft = (): QuoteDraft => ({
    sections: [
      {
        id: "flights",
        title: "Vuelos",
        items: [
          {
            id: makeDraftItemId(),
            label: "Vuelo internacional",
            quantity: null,
            unitPrice: null,
            selected: true,
            priceType: "PER_PERSON",
            customPax: null,
            marginRate: null,
            flightType: "INTERNATIONAL",
          },
          {
            id: makeDraftItemId(),
            label: "Equipaje adicional",
            quantity: null,
            unitPrice: null,
            selected: false,
            priceType: "PER_PERSON",
            customPax: null,
            marginRate: null,
            flightType: "INTERNATIONAL",
          },
        ],
      },
      {
        id: "tours",
        title: "Tours",
        items: [
          {
            id: makeDraftItemId(),
            label: "City tour",
            quantity: null,
            unitPrice: null,
            selected: true,
            priceType: "PER_PERSON",
            customPax: null,
            marginRate: null,
          },
        ],
      },
      {
        id: "transfers",
        title: "Traslados",
        items: [
          {
            id: makeDraftItemId(),
            label: "Traslado aeropuerto - hotel",
            quantity: null,
            unitPrice: null,
            selected: true,
            priceType: "PER_GROUP",
            customPax: null,
            marginRate: null,
          },
          {
            id: makeDraftItemId(),
            label: "Traslado hotel - aeropuerto",
            quantity: null,
            unitPrice: null,
            selected: true,
            priceType: "PER_GROUP",
            customPax: null,
            marginRate: null,
          },
        ],
      },
      {
        id: "extras",
        title: "Extras",
        items: [
          {
            id: makeDraftItemId(),
            label: "Seguro de viaje",
            quantity: null,
            unitPrice: null,
            selected: false,
            priceType: "PER_PERSON",
            customPax: null,
            marginRate: null,
          },
          {
            id: makeDraftItemId(),
            label: "Asistencia 24/7",
            quantity: null,
            unitPrice: null,
            selected: false,
            priceType: "PER_PERSON",
            customPax: null,
            marginRate: null,
          },
        ],
      },
    ],
    lodgingStays: [
      {
        id: makeDraftItemId(),
        city: "",
        nights: null,
        lodgingType: "Hotel",
        accommodation: "Matrimonial",
        mealPlan: "Desayuno incluido",
        detail: "",
        pricePerNight: null,
        priceType: "PER_GROUP",
        customPax: null,
        marginRate: null,
      },
    ],
    notes: "",
    validUntil: "",
  });

  const normalizeQuoteDraft = (draft: QuoteDraft): QuoteDraft => ({
    ...draft,
    sections: draft.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => ({
        ...item,
        priceType: item.priceType ?? "PER_PERSON",
        customPax: item.customPax ?? null,
        marginRate: item.marginRate ?? null,
        flightType: section.id === "flights" ? item.flightType ?? "INTERNATIONAL" : undefined,
      })),
    })),
    lodgingStays: draft.lodgingStays.map((stay) => ({
      ...stay,
      priceType: stay.priceType ?? "PER_GROUP",
      customPax: stay.customPax ?? null,
      marginRate: stay.marginRate ?? null,
    })),
  });

  useEffect(() => {
    const loadCatalogs = async () => {
      const [airlines, lodgingTypes, accommodations, insurances, nationalities, identificationTypes] =
        await Promise.all([
          repo.listCatalog("airlines"),
          repo.listCatalog("lodgingTypes"),
          repo.listCatalog("accommodations"),
          repo.listCatalog("insurances"),
          repo.listCatalog("nationalities"),
          repo.listCatalog("identificationTypes"),
        ]);

      setCatalogs({
        airlines,
        lodgingTypes,
        accommodations,
        insurances,
        nationalities,
        identificationTypes,
      });
    };

    const loadRows = async () => {
      setIsLoading(true);
      const [leads, billingConfig] = await Promise.all([
        repo.listLeads(),
        repo.getBillingConfig(),
      ]);
      setExchangeRate(billingConfig.exchangeRate);
      setQuoteConfig(billingConfig);
      const pendingQuotes = leads.filter((lead) =>
        [
          QuoteStatus.SENT,
          QuoteStatus.IN_PROGRESS,
          QuoteStatus.OFFER_SENT,
          QuoteStatus.WON,
          QuoteStatus.PAUSED,
          QuoteStatus.LOST,
        ].includes(lead.quoteStatus),
      );
      setRows(pendingQuotes);

      const relatedTripIds = Array.from(
        new Set(pendingQuotes.map((lead) => lead.quoteTripId).filter(Boolean)),
      ) as string[];
      if (relatedTripIds.length > 0) {
        const membersList = await Promise.all(
          relatedTripIds.map((tripId) => repo.listTripMembers(tripId)),
        );
        const map = new Map<string, TripMember>();
        membersList.flat().forEach((member) => map.set(member.id, member));
        setMemberById(map);
      } else {
        setMemberById(new Map());
      }
      setIsLoading(false);
    };

    void loadCatalogs();
    void loadRows();
    const interval = setInterval(() => {
      void loadRows();
    }, 15000);
    return () => clearInterval(interval);
  }, [repo]);

  const openQuoteWizard = (lead: Lead) => {
    setQuoteWizardLead(lead);
    setDraftSavedMessage("");
    setQuoteLeadDraft({
      quoteDestination: lead.quoteDestination ?? "",
      quoteTravelMonth: lead.quoteTravelMonth ?? "",
      quoteTravelDateFrom: lead.quoteTravelDateFrom ?? "",
      quoteTravelDateTo: lead.quoteTravelDateTo ?? "",
      quotePartySize: lead.quotePartySize ? String(lead.quotePartySize) : "",
      notes: lead.notes ?? "",
    });
    const draft = lead.quoteDraft ?? buildDefaultDraft();
    if (!draft.lodgingStays || draft.lodgingStays.length === 0) {
      draft.lodgingStays = buildDefaultDraft().lodgingStays;
    }
    setQuoteDraft(normalizeQuoteDraft(draft));
    setQuoteWizardStep(0);
    setQuoteDraftError("");
    setQuoteWizardOpen(true);
  };

  const updateSection = (
    sectionId: QuoteDraftSection["id"],
    updater: (section: QuoteDraftSection) => QuoteDraftSection,
  ) => {
    setQuoteDraft((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        sections: prev.sections.map((section) =>
          section.id === sectionId ? updater(section) : section,
        ),
      };
    });
  };

  const addDraftItem = (sectionId: QuoteDraftSection["id"]) => {
    updateSection(sectionId, (section) => ({
      ...section,
      items: [
        ...section.items,
        {
          id: makeDraftItemId(),
          label: "",
          quantity: null,
          unitPrice: null,
          selected: true,
          priceType: "PER_PERSON",
          customPax: null,
          marginRate: null,
          flightType: sectionId === "flights" ? "INTERNATIONAL" : undefined,
        },
      ],
    }));
  };

  const removeDraftItem = (sectionId: QuoteDraftSection["id"], itemId: string) => {
    updateSection(sectionId, (section) => ({
      ...section,
      items: section.items.filter((item) => item.id !== itemId),
    }));
  };

  const updateDraftItem = (
    sectionId: QuoteDraftSection["id"],
    itemId: string,
    patch: Partial<QuoteDraftSection["items"][number]>,
  ) => {
    updateSection(sectionId, (section) => ({
      ...section,
      items: section.items.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item,
      ),
    }));
  };

  const addLodgingStay = () => {
    setQuoteDraft((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        lodgingStays: [
          ...prev.lodgingStays,
          {
            id: makeDraftItemId(),
            city: "",
            nights: null,
            lodgingType: "Hotel",
            accommodation: "Matrimonial",
            mealPlan: "Desayuno incluido",
            detail: "",
            pricePerNight: null,
            priceType: "PER_GROUP",
            customPax: null,
            marginRate: null,
          },
        ],
      };
    });
  };

  const updateLodgingStay = (stayId: string, patch: Partial<QuoteLodgingStay>) => {
    setQuoteDraft((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        lodgingStays: prev.lodgingStays.map((stay) =>
          stay.id === stayId ? { ...stay, ...patch } : stay,
        ),
      };
    });
  };

  const removeLodgingStay = (stayId: string) => {
    setQuoteDraft((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        lodgingStays: prev.lodgingStays.filter((stay) => stay.id !== stayId),
      };
    });
  };

  const handleSaveQuoteDraft = async (nextStep?: number) => {
    if (!quoteWizardLead || !quoteDraft) {
      return;
    }
    setIsSavingDraft(true);
    setQuoteDraftError("");
    const now = new Date().toISOString();
    const shouldMarkInProgress =
      quoteWizardLead.quoteStatus === QuoteStatus.SENT ||
      quoteWizardLead.quoteStatus === QuoteStatus.PENDING;
    const patch: Partial<Lead> = {
      quoteDestination: quoteLeadDraft.quoteDestination,
      quoteTravelMonth: quoteLeadDraft.quoteTravelMonth,
      quoteTravelDateFrom: quoteLeadDraft.quoteTravelDateFrom,
      quoteTravelDateTo: quoteLeadDraft.quoteTravelDateTo,
      quotePartySize: quoteLeadDraft.quotePartySize
        ? Number(quoteLeadDraft.quotePartySize)
        : null,
      notes: quoteLeadDraft.notes,
      quoteDraft,
      quoteDraftUpdatedAt: now,
    };

    if (shouldMarkInProgress) {
      patch.quoteStatus = QuoteStatus.IN_PROGRESS;
      patch.quoteTakenByUserId = quoteWizardLead.quoteTakenByUserId ?? user.id;
      patch.quoteTakenAt = quoteWizardLead.quoteTakenAt ?? now;
      patch.quoteStatusUpdatedAt = now;
    }

    const updated = await repo.updateLead(quoteWizardLead.id, patch);
    if (!updated) {
      setQuoteDraftError("No se pudo guardar la cotizacion.");
      setIsSavingDraft(false);
      return;
    }
    setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    setQuoteWizardLead(updated);
    setIsSavingDraft(false);
    if (typeof nextStep === "number") {
      setQuoteWizardStep(nextStep);
    } else {
      setQuoteWizardOpen(false);
      setDraftSavedMessage("Borrador guardado. Puedes retomarlo en Editar cotizacion.");
      if (typeof window !== "undefined") {
        window.setTimeout(() => setDraftSavedMessage(""), 4000);
      }
    }
  };

  const handleSendQuoteOffer = async () => {
    if (!quoteWizardLead || !quoteDraft) {
      return;
    }
    setIsSavingDraft(true);
    setQuoteDraftError("");
    const now = new Date().toISOString();
    const updated = await repo.updateLead(quoteWizardLead.id, {
      quoteDestination: quoteLeadDraft.quoteDestination,
      quoteTravelMonth: quoteLeadDraft.quoteTravelMonth,
      quoteTravelDateFrom: quoteLeadDraft.quoteTravelDateFrom,
      quoteTravelDateTo: quoteLeadDraft.quoteTravelDateTo,
      quotePartySize: quoteLeadDraft.quotePartySize
        ? Number(quoteLeadDraft.quotePartySize)
        : null,
      notes: quoteLeadDraft.notes,
      quoteDraft,
      quoteDraftUpdatedAt: now,
      quoteStatus: QuoteStatus.OFFER_SENT,
      quoteStatusUpdatedAt: now,
      quoteOfferSentAt: now,
    });
    if (!updated) {
      setQuoteDraftError("No se pudo enviar la cotizacion.");
      setIsSavingDraft(false);
      return;
    }
    setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    setQuoteWizardLead(updated);
    setActiveTab(QuoteStatus.OFFER_SENT);
    setIsSavingDraft(false);
    setQuoteWizardOpen(false);
  };

  const handleMarkInProgress = async (lead: Lead) => {
    setBusyLeadId(lead.id);
    const now = new Date().toISOString();
    const updated = await repo.updateLead(lead.id, {
      quoteStatus: QuoteStatus.IN_PROGRESS,
      quoteTakenByUserId: user.id,
      quoteTakenAt: now,
      quoteStatusUpdatedAt: now,
    });
    if (updated) {
      setRows((prev) => prev.map((row) => (row.id === lead.id ? updated : row)));
      openQuoteWizard(updated);
    }
    setBusyLeadId(null);
  };

  const handleUpdateStatus = async (lead: Lead, status: QuoteStatus) => {
    if (!lead.quoteTakenByUserId) {
      return;
    }
    setBusyLeadId(lead.id);
    const now = new Date().toISOString();
    const patch: Partial<Lead> = {
      quoteStatus: status,
      quoteStatusUpdatedAt: now,
    };

    if (status === QuoteStatus.OFFER_SENT) {
      patch.quoteOfferSentAt = now;
    }
    if (status === QuoteStatus.PAUSED) {
      patch.quotePausedAt = now;
    }
    if (status === QuoteStatus.LOST) {
      patch.quoteLostAt = now;
    }

    const updated = await repo.updateLead(lead.id, patch);
    if (updated) {
      setRows((prev) => prev.map((row) => (row.id === lead.id ? updated : row)));
    }
    setBusyLeadId(null);
  };

  const handleCreateQuoteLead = async () => {
    const trimmedName = newQuoteDraft.fullName.trim();
    if (!trimmedName) {
      setNewQuoteError("Nombre requerido.");
      return;
    }
    if (!newQuoteDraft.identificationTypeId) {
      setNewQuoteError("Tipo de identificacion requerido.");
      return;
    }
    if (!newQuoteDraft.identification.trim()) {
      setNewQuoteError("Identificacion requerida.");
      return;
    }
    if (!newQuoteDraft.phone.trim()) {
      setNewQuoteError("Telefono requerido.");
      return;
    }
    setIsCreatingLead(true);
    const now = new Date().toISOString();
    const created = await repo.createLead({
      fullName: trimmedName,
      identificationTypeId: newQuoteDraft.identificationTypeId,
      identification: newQuoteDraft.identification.trim(),
      phone: newQuoteDraft.phone.trim(),
      email: newQuoteDraft.email.trim(),
      wantsReservation: false,
      notes: newQuoteDraft.notes.trim(),
      quoteDestination: newQuoteDraft.quoteDestination.trim(),
      quoteTravelMonth: newQuoteDraft.quoteTravelMonth.trim(),
      quoteStatus: QuoteStatus.SENT,
      quoteStatusUpdatedAt: now,
      agentUserId: user.id,
    });
    setRows((prev) => [created, ...prev]);
    setActiveTab(QuoteStatus.SENT);
    setNewQuoteOpen(false);
    setNewQuoteError("");
    setNewQuoteDraft({
      fullName: "",
      identificationTypeId: "",
      identification: "",
      phone: "",
      email: "",
      quoteDestination: "",
      quoteTravelMonth: "",
      notes: "",
    });
    setIsCreatingLead(false);
  };

  const handleSendToContracts = async (lead: Lead) => {
    if (!lead.quoteTripId || !lead.quoteTripMemberId) {
      return;
    }
    const member = memberById.get(lead.quoteTripMemberId);
    if (!member || member.contractsStatus === ContractsStatus.SENT) {
      return;
    }
    setBusyLeadId(lead.id);
    const now = new Date().toISOString();
    const updated = await repo.updateTripMember(lead.quoteTripId, member.id, {
      contractsStatus: ContractsStatus.SENT,
      contractsSentByUserId: user.id,
      contractsSentAt: now,
      billingStatus: BillingStatus.SENT,
      billingSentByUserId: user.id,
      billingSentAt: now,
      billingStatusUpdatedAt: now,
      isDraft: false,
    });
    if (updated) {
      setMemberById((prev) => {
        const next = new Map(prev);
        next.set(updated.id, updated);
        return next;
      });
    }
    setBusyLeadId(null);
  };

  const formatTimestamp = (value: string | null) => {
    if (!value) {
      return "-";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString("es-CR");
  };

  const formatTravelWindow = (from?: string, to?: string, month?: string) => {
    const formatDate = (value?: string) => {
      if (!value) {
        return "";
      }
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return value;
      }
      return parsed.toLocaleDateString("es-CR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    };

    const fromLabel = formatDate(from);
    const toLabel = formatDate(to);
    if (fromLabel || toLabel) {
      if (fromLabel && toLabel) {
        return `${fromLabel} – ${toLabel}`;
      }
      if (fromLabel) {
        return `Desde ${fromLabel}`;
      }
      return `Hasta ${toLabel}`;
    }
    return month || "-";
  };

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const scopedRows = rows.filter((lead) => lead.quoteStatus === activeTab);
    if (!q) {
      return scopedRows;
    }
    return scopedRows.filter((lead) => {
      const haystack = `${lead.fullName} ${lead.identification}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [activeTab, query, rows]);

  const statusCounts = useMemo(() => {
    const counts = new Map<QuoteStatus, number>();
    statusTabs.forEach((tab) => counts.set(tab.id, 0));
    rows.forEach((lead) => {
      counts.set(lead.quoteStatus, (counts.get(lead.quoteStatus) ?? 0) + 1);
    });
    return counts;
  }, [rows, statusTabs]);

  const quotePartySizeValue = Number(quoteLeadDraft.quotePartySize || 0);

  const resolveMarginRate = (
    sectionId: QuoteDraftSection["id"],
    marginRate: number | null | undefined,
    flightType?: "INTERNATIONAL" | "DOMESTIC",
  ) => {
    if (typeof marginRate === "number") {
      return marginRate;
    }
    const defaults = quoteConfig?.quoteMarginRates;
    if (!defaults) {
      return 0;
    }
    if (sectionId === "flights") {
      return flightType === "DOMESTIC" ? defaults.flightsDomestic : defaults.flightsInternational;
    }
    if (sectionId === "tours") {
      return defaults.tours;
    }
    if (sectionId === "transfers") {
      return defaults.transfers;
    }
    if (sectionId === "extras") {
      return defaults.extras;
    }
    return 0;
  };

  const resolveLodgingMarginRate = (marginRate: number | null | undefined) => {
    if (typeof marginRate === "number") {
      return marginRate;
    }
    return quoteConfig?.quoteMarginRates.lodging ?? 0;
  };

  const quoteTotals = useMemo(() => {
    if (!quoteDraft) {
      return {
        baseSubtotal: 0,
        marginTotal: 0,
        subtotalWithMargin: 0,
        cardFee: 0,
        vendorCommission: 0,
        taxAmount: 0,
        totalBeforeFee: 0,
        feePerPax: 0,
        feeTotal: 0,
        totalFinal: 0,
        totalPerPerson: 0,
        flightTicketPerPerson: 0,
        reservationPerPerson: 0,
      };
    }

    let baseSubtotal = 0;
    let marginTotal = 0;
    let subtotalWithMargin = 0;
    let flightTicketPerPerson = 0;

    quoteDraft.sections.forEach((section) => {
      section.items.forEach((item) => {
        if (!item.selected) {
          return;
        }
        const quantity = typeof item.quantity === "number" ? item.quantity : 0;
        const price = typeof item.unitPrice === "number" ? item.unitPrice : 0;
        const paxMultiplier =
          item.priceType === "PER_PERSON"
            ? Number(item.customPax ?? quotePartySizeValue)
            : 1;
        const baseTotal = quantity * price * paxMultiplier;
        const marginRate = resolveMarginRate(section.id, item.marginRate, item.flightType);
        const marginAmount = baseTotal * marginRate;
        baseSubtotal += baseTotal;
        marginTotal += marginAmount;
        subtotalWithMargin += baseTotal + marginAmount;

        if (section.id === "flights" && item.priceType === "PER_PERSON") {
          const perPersonTotal = quantity * price * (1 + marginRate);
          flightTicketPerPerson += perPersonTotal;
        }
      });
    });

    quoteDraft.lodgingStays.forEach((stay) => {
      const nights = stay.nights ?? 0;
      const price = stay.pricePerNight ?? 0;
      const paxMultiplier =
        stay.priceType === "PER_PERSON"
            ? Number(stay.customPax ?? quotePartySizeValue)
          : 1;
      const baseTotal = nights * price * paxMultiplier;
      const marginRate = resolveLodgingMarginRate(stay.marginRate);
      const marginAmount = baseTotal * marginRate;
      baseSubtotal += baseTotal;
      marginTotal += marginAmount;
      subtotalWithMargin += baseTotal + marginAmount;
    });

    const cardFee = subtotalWithMargin * (quoteConfig?.cardFeeRate ?? 0);
    const vendorCommission = subtotalWithMargin * (quoteConfig?.vendorCommissionRate ?? 0);
    const taxAmount = subtotalWithMargin * (quoteConfig?.taxRate ?? 0);
    const totalBeforeFee = subtotalWithMargin + cardFee + vendorCommission + taxAmount;

    const feeTier = (quoteConfig?.perPaxFeeTiers ?? []).find((tier) => {
      if (!quotePartySizeValue) {
        return false;
      }
      const maxOk = tier.maxPax ? quotePartySizeValue <= tier.maxPax : true;
      return quotePartySizeValue >= tier.minPax && maxOk;
    });
    const feePerPax = feeTier?.feePerPax ?? 0;
    const feeTotal = feePerPax * (quotePartySizeValue || 0);
    const totalFinal = totalBeforeFee + feeTotal;
    const totalPerPerson = quotePartySizeValue ? totalFinal / quotePartySizeValue : 0;
    const reservationPerPerson = Math.max(flightTicketPerPerson, totalPerPerson);

    return {
      baseSubtotal,
      marginTotal,
      subtotalWithMargin,
      cardFee,
      vendorCommission,
      taxAmount,
      totalBeforeFee,
      feePerPax,
      feeTotal,
      totalFinal,
      totalPerPerson,
      flightTicketPerPerson,
      reservationPerPerson,
    };
  }, [quoteDraft, quoteConfig, quotePartySizeValue]);

  const effectiveRate = Math.max(exchangeRate || 0, 500);
  const rateLabel = exchangeRate < 500 ? "(Min 500 aplicado)" : "(Rate real)";

  const quoteSteps = [
    { id: "details", label: "Datos" },
    { id: "lodging", label: "Hospedaje" },
    { id: "flights", label: "Vuelos" },
    { id: "tours", label: "Tours" },
    { id: "extras", label: "Traslados/Extras" },
    { id: "summary", label: "Resumen" },
  ];

  const renderSectionEditor = (sectionId: QuoteDraftSection["id"]) => {
    if (sectionId === "lodging") {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Estancias</p>
            <Button size="sm" variant="outline" onClick={addLodgingStay}>
              Agregar estancia
            </Button>
          </div>
          <div className="max-h-[520px] space-y-4 overflow-y-auto pr-2">
            {quoteDraft?.lodgingStays.map((stay, index) => {
              const stayPax =
                stay.priceType === "PER_PERSON"
                  ? Number(stay.customPax ?? quotePartySizeValue)
                  : 1;
              const stayBase = (stay.nights ?? 0) * (stay.pricePerNight ?? 0) * stayPax;
              const stayMarginRate = resolveLodgingMarginRate(stay.marginRate);
              const stayTotal = stayBase * (1 + stayMarginRate);
              return (
                <details key={stay.id} className="rounded-lg border border-slate-200">
                  <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-800">
                    <span>
                      Estancia {index + 1} · {stay.city || "Sin ciudad"}
                    </span>
                    <span className="text-xs font-semibold text-slate-600">
                      {(stay.nights ?? "-")} noches · ${stayTotal.toFixed(2)}
                    </span>
                  </summary>
                  <div className="border-t border-slate-100 px-4 py-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800">Detalles</p>
                      {quoteDraft.lodgingStays.length > 1 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeLodgingStay(stay.id)}
                        >
                          Quitar
                        </Button>
                      ) : null}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Ciudad</Label>
                      <Input
                        value={stay.city}
                        placeholder="Ej: Madrid"
                        onChange={(event) =>
                          updateLodgingStay(stay.id, { city: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Noches</Label>
                      <Input
                        type="number"
                        min={1}
                        value={stay.nights ?? ""}
                        onChange={(event) =>
                          updateLodgingStay(stay.id, {
                            nights: event.target.value ? Number(event.target.value) : null,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo de hospedaje</Label>
                      <select
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={stay.lodgingType}
                        onChange={(event) =>
                          updateLodgingStay(stay.id, { lodgingType: event.target.value })
                        }
                      >
                        <option value="Hotel">Hotel</option>
                        <option value="Airbnb">Airbnb</option>
                        <option value="Hostel">Hostel</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Acomodacion</Label>
                      <select
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={stay.accommodation}
                        onChange={(event) =>
                          updateLodgingStay(stay.id, { accommodation: event.target.value })
                        }
                      >
                        <option value="Matrimonial">Matrimonial</option>
                        <option value="Individual">Individual</option>
                        <option value="Doble">Doble</option>
                        <option value="Triple">Triple</option>
                        <option value="Familiar">Familiar</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Alimentacion</Label>
                      <select
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={stay.mealPlan}
                        onChange={(event) =>
                          updateLodgingStay(stay.id, { mealPlan: event.target.value })
                        }
                      >
                        <option value="Desayuno incluido">Desayuno incluido</option>
                        <option value="2 tiempos">2 tiempos</option>
                        <option value="3 tiempos">3 tiempos</option>
                        <option value="Todo incluido">Todo incluido</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Detalle / nombre del hospedaje</Label>
                      <Input
                        value={stay.detail}
                        placeholder="Ej: Hotel Riu, Casa Colonial..."
                        onChange={(event) =>
                          updateLodgingStay(stay.id, { detail: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Precio por noche (USD)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={stay.pricePerNight ?? ""}
                        onChange={(event) =>
                          updateLodgingStay(stay.id, {
                            pricePerNight: event.target.value ? Number(event.target.value) : null,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo de precio</Label>
                      <select
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={stay.priceType}
                        onChange={(event) =>
                          updateLodgingStay(stay.id, {
                            priceType: event.target.value as QuotePriceType,
                          })
                        }
                      >
                        <option value="PER_PERSON">Por persona</option>
                        <option value="PER_GROUP">Por grupo</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Pax (opcional)</Label>
                      <Input
                        type="number"
                        min={1}
                        placeholder={stay.priceType === "PER_PERSON" ? "Total" : "No aplica"}
                        value={stay.customPax ?? ""}
                        disabled={stay.priceType !== "PER_PERSON"}
                        onChange={(event) =>
                          updateLodgingStay(stay.id, {
                            customPax: event.target.value ? Number(event.target.value) : null,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Margen %</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={(stay.marginRate ?? resolveLodgingMarginRate(null)) * 100}
                        onChange={(event) =>
                          updateLodgingStay(stay.id, {
                            marginRate: event.target.value
                              ? Number(event.target.value) / 100
                              : null,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Total estancia</Label>
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        ${stayTotal.toFixed(2)}
                      </div>
                    </div>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      );
    }
    const section = quoteDraft?.sections.find((entry) => entry.id === sectionId);
    if (!section) {
      return null;
    }
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">{section.title}</h3>
          <Button size="sm" variant="outline" onClick={() => addDraftItem(sectionId)}>
            Agregar item
          </Button>
        </div>
        <div className="rounded-lg border border-slate-200">
          <table className="w-full table-auto border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-600">
              <tr>
                <th className="px-3 py-2">Incluir</th>
                <th className="px-3 py-2">Detalle</th>
                <th className="px-3 py-2">Tipo precio</th>
                <th className="px-3 py-2">Pax</th>
                <th className="px-3 py-2">Cant.</th>
                <th className="px-3 py-2">Precio USD</th>
                <th className="px-3 py-2">Margen %</th>
                {sectionId === "flights" ? <th className="px-3 py-2">Tipo vuelo</th> : null}
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Accion</th>
              </tr>
            </thead>
            <tbody>
              {section.items.map((item) => {
                const quantity = typeof item.quantity === "number" ? item.quantity : 0;
                const unitPrice = typeof item.unitPrice === "number" ? item.unitPrice : 0;
                const paxMultiplier =
                  item.priceType === "PER_PERSON"
                    ? Number(item.customPax ?? quotePartySizeValue)
                    : 1;
                const marginRate = resolveMarginRate(sectionId, item.marginRate, item.flightType);
                const baseTotal = quantity * unitPrice * paxMultiplier;
                const total = baseTotal * (1 + marginRate);
                return (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={(event) =>
                          updateDraftItem(sectionId, item.id, { selected: event.target.checked })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="w-full"
                        value={item.label}
                        onChange={(event) =>
                          updateDraftItem(sectionId, item.id, { label: event.target.value })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                        value={item.priceType}
                        onChange={(event) =>
                          updateDraftItem(sectionId, item.id, {
                            priceType: event.target.value as QuotePriceType,
                          })
                        }
                      >
                        <option value="PER_PERSON">Por persona</option>
                        <option value="PER_GROUP">Por grupo</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="w-full"
                        type="number"
                        min={1}
                        placeholder={item.priceType === "PER_PERSON" ? "Total" : "-"}
                        value={item.customPax ?? ""}
                        disabled={item.priceType !== "PER_PERSON"}
                        onChange={(event) =>
                          updateDraftItem(sectionId, item.id, {
                            customPax: event.target.value ? Number(event.target.value) : null,
                          })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="w-full"
                        type="number"
                        min={1}
                        value={item.quantity ?? ""}
                        onChange={(event) =>
                          updateDraftItem(sectionId, item.id, {
                            quantity: event.target.value ? Number(event.target.value) : null,
                          })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="w-full"
                        type="number"
                        min={0}
                        value={item.unitPrice ?? ""}
                        onChange={(event) =>
                          updateDraftItem(sectionId, item.id, {
                            unitPrice: event.target.value ? Number(event.target.value) : null,
                          })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="w-full"
                        type="number"
                        min={0}
                        step="0.01"
                        value={(item.marginRate ?? marginRate) * 100}
                        onChange={(event) =>
                          updateDraftItem(sectionId, item.id, {
                            marginRate: event.target.value
                              ? Number(event.target.value) / 100
                              : null,
                          })
                        }
                      />
                    </td>
                    {sectionId === "flights" ? (
                      <td className="px-3 py-2">
                        <select
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                          value={item.flightType ?? "INTERNATIONAL"}
                          onChange={(event) =>
                            updateDraftItem(sectionId, item.id, {
                              flightType: event.target.value as "INTERNATIONAL" | "DOMESTIC",
                            })
                          }
                        >
                          <option value="INTERNATIONAL">Internacional</option>
                          <option value="DOMESTIC">Interno</option>
                        </select>
                      </td>
                    ) : null}
                    <td className="px-3 py-2 text-slate-700">
                      ${total.toFixed(2)}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeDraftItem(sectionId, item.id)}
                      >
                        Eliminar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Cotizaciones</h1>
          <p className="text-sm text-slate-600">Solicitudes enviadas por agentes.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button size="sm" onClick={() => setNewQuoteOpen(true)}>
            Nueva cotizacion
          </Button>
          <input
            className="w-full min-w-[220px] rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 sm:w-auto"
            placeholder="Buscar por nombre o ID"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Actualizar
          </Button>
        </div>
      </div>

      {draftSavedMessage ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {draftSavedMessage}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {statusTabs.map((tab) => (
          <Button
            key={tab.id}
            size="sm"
            variant={activeTab === tab.id ? "default" : "outline"}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label} ({statusCounts.get(tab.id) ?? 0})
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clientes</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          {isLoading ? (
            <p className="text-sm text-slate-600">Cargando...</p>
          ) : filteredRows.length === 0 ? (
            <p className="text-sm text-slate-500">Sin solicitudes</p>
          ) : (
            <table className="min-w-[1500px] w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-600">
                <tr>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Telefono</th>
                  <th className="px-3 py-2">Correo</th>
                  <th className="px-3 py-2">Destino</th>
                  <th className="px-3 py-2">Fechas viaje</th>
                  <th className="px-3 py-2">Cotizacion</th>
                  <th className="px-3 py-2">Agente</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Tomado por</th>
                  <th className="px-3 py-2">Tomado el</th>
                  <th className="px-3 py-2">Coti enviada</th>
                  <th className="px-3 py-2">Ganada</th>
                  <th className="px-3 py-2">Pausa</th>
                  <th className="px-3 py-2">Perdida</th>
                  <th className="px-3 py-2">Accion</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((lead) => (
                  <tr key={lead.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-900">{lead.fullName}</td>
                    <td className="px-3 py-2 text-slate-600">{lead.identification || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{lead.phone || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{lead.email || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{lead.quoteDestination || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {formatTravelWindow(
                        lead.quoteTravelDateFrom,
                        lead.quoteTravelDateTo,
                        lead.quoteTravelMonth,
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{lead.quoteCode || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {userById.get(lead.agentUserId) ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {lead.quoteStatus === QuoteStatus.SENT
                        ? "En cola"
                        : lead.quoteStatus === QuoteStatus.IN_PROGRESS
                          ? "En proceso"
                          : lead.quoteStatus === QuoteStatus.OFFER_SENT
                            ? "Cotizacion enviada"
                            : lead.quoteStatus === QuoteStatus.WON
                              ? "Ganada"
                              : lead.quoteStatus === QuoteStatus.PAUSED
                                ? "En pausa"
                                : "Perdida"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {lead.quoteTakenByUserId
                        ? userById.get(lead.quoteTakenByUserId) ?? "-"
                        : "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {formatTimestamp(lead.quoteTakenAt)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {formatTimestamp(lead.quoteOfferSentAt)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {formatTimestamp(lead.quoteWonAt)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {formatTimestamp(lead.quotePausedAt)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {formatTimestamp(lead.quoteLostAt)}
                    </td>
                    <td className="px-3 py-2">
                      {lead.quoteStatus === QuoteStatus.WON ? (
                        lead.quoteTripMemberId &&
                        memberById.get(lead.quoteTripMemberId)?.isDraft ? (
                          <Button
                            size="sm"
                            onClick={() => handleSendToContracts(lead)}
                            disabled={busyLeadId === lead.id}
                          >
                            Enviar a contratos
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-500">Completado</span>
                        )
                      ) : lead.quoteStatus === QuoteStatus.SENT ||
                        lead.quoteStatus === QuoteStatus.IN_PROGRESS ||
                        lead.quoteStatus === QuoteStatus.OFFER_SENT ? (
                        <select
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
                          value=""
                          disabled={busyLeadId === lead.id}
                          onChange={(event) => {
                            const next = event.target.value;
                            if (!next) {
                              return;
                            }
                            if (next === "IN_PROGRESS") {
                              void handleMarkInProgress(lead);
                              } else if (next === "EDIT_QUOTE") {
                                openQuoteWizard(lead);
                            } else if (next === "WIN") {
                              setWinLead(lead);
                            } else {
                              void handleUpdateStatus(lead, next as QuoteStatus);
                            }
                            event.currentTarget.value = "";
                          }}
                        >
                          <option value="">Acciones</option>
                          {lead.quoteStatus === QuoteStatus.SENT ? (
                            <option value="IN_PROGRESS">Marcar en proceso</option>
                          ) : null}
                          {lead.quoteStatus === QuoteStatus.IN_PROGRESS ? (
                            <>
                                <option value="EDIT_QUOTE">Editar cotizacion</option>
                              <option value={QuoteStatus.OFFER_SENT}>Cotizacion enviada</option>
                              <option value="WIN">Marcar ganada</option>
                              <option value={QuoteStatus.PAUSED}>Pausar</option>
                              <option value={QuoteStatus.LOST}>Perder</option>
                            </>
                          ) : null}
                          {lead.quoteStatus === QuoteStatus.OFFER_SENT ? (
                            <>
                              <option value="EDIT_QUOTE">Editar cotizacion</option>
                              <option value="WIN">Marcar ganada</option>
                              <option value={QuoteStatus.PAUSED}>Pausar</option>
                              <option value={QuoteStatus.LOST}>Perder</option>
                            </>
                          ) : null}
                        </select>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <QuoteWinDialog
        open={Boolean(winLead)}
        lead={winLead}
        repo={repo}
        catalogs={catalogs}
        currentUser={user}
        onClose={() => setWinLead(null)}
        onCompleted={(updatedLead, member) => {
          setRows((prev) => prev.map((row) => (row.id === updatedLead.id ? updatedLead : row)));
          setMemberById((prev) => {
            const next = new Map(prev);
            next.set(member.id, member);
            return next;
          });
          setWinLead(null);
        }}
      />

      <Dialog
        open={quoteWizardOpen}
        onOpenChange={(open) => {
          setQuoteWizardOpen(open);
          if (!open) {
            setQuoteDraftError("");
          }
        }}
      >
        <DialogContent className="w-[90vw] max-w-none sm:w-[85vw] lg:w-[75vw]">
          <DialogHeader>
            <DialogTitle>Armar cotizacion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {quoteSteps.map((step, index) => (
                <span
                  key={step.id}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    quoteWizardStep === index
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {index + 1}. {step.label}
                </span>
              ))}
            </div>

            {quoteWizardStep === 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {quoteWizardLead?.fullName ?? "-"}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Contacto</Label>
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {(quoteWizardLead?.phone ?? "-") + " · " + (quoteWizardLead?.email ?? "-")}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Destino</Label>
                  <Input
                    value={quoteLeadDraft.quoteDestination}
                    onChange={(event) =>
                      setQuoteLeadDraft((prev) => ({
                        ...prev,
                        quoteDestination: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mes de viaje</Label>
                  <Input
                    value={quoteLeadDraft.quoteTravelMonth}
                    onChange={(event) =>
                      setQuoteLeadDraft((prev) => ({
                        ...prev,
                        quoteTravelMonth: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha inicio</Label>
                  <Input
                    type="date"
                    value={quoteLeadDraft.quoteTravelDateFrom}
                    onChange={(event) =>
                      setQuoteLeadDraft((prev) => ({
                        ...prev,
                        quoteTravelDateFrom: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha fin</Label>
                  <Input
                    type="date"
                    value={quoteLeadDraft.quoteTravelDateTo}
                    onChange={(event) =>
                      setQuoteLeadDraft((prev) => ({
                        ...prev,
                        quoteTravelDateTo: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cantidad de personas</Label>
                  <Input
                    type="number"
                    min={1}
                    value={quoteLeadDraft.quotePartySize}
                    onChange={(event) =>
                      setQuoteLeadDraft((prev) => ({
                        ...prev,
                        quotePartySize: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Notas internas</Label>
                  <textarea
                    className="min-h-[90px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={quoteLeadDraft.notes}
                    onChange={(event) =>
                      setQuoteLeadDraft((prev) => ({ ...prev, notes: event.target.value }))
                    }
                  />
                </div>
              </div>
            ) : null}

            {quoteWizardStep === 1 ? renderSectionEditor("lodging") : null}
            {quoteWizardStep === 2 ? renderSectionEditor("flights") : null}
            {quoteWizardStep === 3 ? renderSectionEditor("tours") : null}
            {quoteWizardStep === 4 ? (
              <div className="space-y-6">
                {renderSectionEditor("transfers")}
                {renderSectionEditor("extras")}
              </div>
            ) : null}
            {quoteWizardStep === 5 ? (
              <div className="space-y-4">
                <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">Totales</p>
                    <div className="mt-2 flex flex-wrap items-center gap-4">
                      <div>
                        <p className="text-xs text-slate-500">Total USD</p>
                        <p className="text-xl font-semibold text-slate-900">
                          ${quoteTotals.totalFinal.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Total CRC</p>
                        <p className="text-xl font-semibold text-slate-900">
                          CRC {(quoteTotals.totalFinal * effectiveRate).toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-500">
                          TC {effectiveRate} {rateLabel}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">Desglose</p>
                    <div className="mt-2 space-y-2 text-sm text-slate-700">
                      <div className="flex items-center justify-between">
                        <span>Subtotal base</span>
                        <span className="font-semibold text-slate-900">
                          ${quoteTotals.baseSubtotal.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Margen total</span>
                        <span className="font-semibold text-slate-900">
                          ${quoteTotals.marginTotal.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Subtotal con margen</span>
                        <span className="font-semibold text-slate-900">
                          ${quoteTotals.subtotalWithMargin.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>
                          Tarjetas ({((quoteConfig?.cardFeeRate ?? 0) * 100).toFixed(2)}%)
                        </span>
                        <span className="font-semibold text-slate-900">
                          ${quoteTotals.cardFee.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>
                          Comision vendedor ({((quoteConfig?.vendorCommissionRate ?? 0) * 100).toFixed(2)}%)
                        </span>
                        <span className="font-semibold text-slate-900">
                          ${quoteTotals.vendorCommission.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>IVA ({((quoteConfig?.taxRate ?? 0) * 100).toFixed(2)}%)</span>
                        <span className="font-semibold text-slate-900">
                          ${quoteTotals.taxAmount.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Total con recargos</span>
                        <span className="font-semibold text-slate-900">
                          ${quoteTotals.totalBeforeFee.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Fee por pax ({quoteTotals.feePerPax.toFixed(2)} x {quotePartySizeValue || 0})</span>
                        <span className="font-semibold text-slate-900">
                          ${quoteTotals.feeTotal.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                        <span className="text-slate-900">Total final</span>
                        <span className="font-semibold text-slate-900">
                          ${quoteTotals.totalFinal.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Total por persona</span>
                        <span className="font-semibold text-slate-900">
                          ${quoteTotals.totalPerPerson.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Ticket aereo por persona</span>
                        <span className="font-semibold text-slate-900">
                          ${quoteTotals.flightTicketPerPerson.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Reserva por persona (min)</span>
                        <span className="font-semibold text-slate-900">
                          ${quoteTotals.reservationPerPerson.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">Fechas de viaje</p>
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      {formatTravelWindow(
                        quoteLeadDraft.quoteTravelDateFrom,
                        quoteLeadDraft.quoteTravelDateTo,
                        quoteLeadDraft.quoteTravelMonth,
                      )}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">Hospedaje</p>
                    <div className="mt-2 space-y-2 text-sm text-slate-700">
                      {quoteDraft?.lodgingStays.map((stay, index) => (
                        <div key={stay.id} className="rounded-md border border-slate-200 p-3">
                          <p className="text-sm font-semibold text-slate-900">
                            Estancia {index + 1} · {stay.city || "Sin ciudad"}
                          </p>
                          <p className="text-xs text-slate-600">
                            {(stay.nights ?? "-")} noches · {stay.lodgingType} · {stay.accommodation} · {stay.mealPlan}
                          </p>
                          {stay.detail ? (
                            <p className="text-xs text-slate-600">{stay.detail}</p>
                          ) : null}
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            ${(() => {
                              const stayPax =
                                stay.priceType === "PER_PERSON"
                                  ? Number(stay.customPax ?? quotePartySizeValue)
                                  : 1;
                              const stayBase = (stay.nights ?? 0) * (stay.pricePerNight ?? 0) * stayPax;
                              const stayMarginRate = resolveLodgingMarginRate(stay.marginRate);
                              return (stayBase * (1 + stayMarginRate)).toFixed(2);
                            })()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Valido hasta</Label>
                    <Input
                      type="date"
                      value={quoteDraft?.validUntil ?? ""}
                      onChange={(event) =>
                        setQuoteDraft((prev) =>
                          prev ? { ...prev, validUntil: event.target.value } : prev,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notas para el cliente</Label>
                    <textarea
                      className="min-h-[120px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={quoteDraft?.notes ?? ""}
                      onChange={(event) =>
                        setQuoteDraft((prev) =>
                          prev ? { ...prev, notes: event.target.value } : prev,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-slate-800">Resumen de items</p>
                    {quoteDraft?.sections.map((section) => {
                      const selectedItems = section.items.filter((item) => item.selected);
                      if (selectedItems.length === 0) {
                        return null;
                      }
                      return (
                        <div key={section.id} className="rounded-md border border-slate-200 p-3">
                          <p className="text-xs font-semibold uppercase text-slate-500">
                            {section.title}
                          </p>
                          <ul className="mt-2 space-y-1 text-sm text-slate-700">
                            {selectedItems.map((item) => (
                              <li key={item.id} className="flex items-center justify-between">
                                <span>
                                  {item.label || "Item sin nombre"} · {item.quantity ?? 0} x ${
                                    item.unitPrice ?? 0
                                  } · {item.priceType === "PER_PERSON" ? "por persona" : "por grupo"}
                                </span>
                                <span className="font-semibold text-slate-900">
                                  ${(() => {
                                    const quantity = item.quantity ?? 0;
                                    const unitPrice = item.unitPrice ?? 0;
                                    const paxMultiplier =
                                      item.priceType === "PER_PERSON"
                                        ? Number(item.customPax ?? quotePartySizeValue)
                                        : 1;
                                    const marginRate = resolveMarginRate(
                                      section.id,
                                      item.marginRate,
                                      item.flightType,
                                    );
                                    const baseTotal = quantity * unitPrice * paxMultiplier;
                                    return (baseTotal * (1 + marginRate)).toFixed(2);
                                  })()}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {quoteDraftError ? (
              <p className="text-xs text-rose-600">{quoteDraftError}</p>
            ) : null}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" onClick={() => setQuoteWizardOpen(false)}>
              Cancelar
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              {quoteWizardStep > 0 ? (
                <Button
                  variant="outline"
                  onClick={() => setQuoteWizardStep((prev) => Math.max(prev - 1, 0))}
                >
                  Atras
                </Button>
              ) : null}
              <Button
                variant="outline"
                onClick={() => void handleSaveQuoteDraft()}
                disabled={isSavingDraft}
              >
                {isSavingDraft ? "Guardando..." : "Guardar borrador"}
              </Button>
              {quoteWizardStep < quoteSteps.length - 1 ? (
                <Button
                  onClick={() => void handleSaveQuoteDraft(quoteWizardStep + 1)}
                  disabled={isSavingDraft}
                >
                  {isSavingDraft ? "Guardando..." : "Guardar y continuar"}
                </Button>
              ) : (
                <Button onClick={() => void handleSendQuoteOffer()} disabled={isSavingDraft}>
                  {isSavingDraft ? "Enviando..." : "Enviar al cliente"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={newQuoteOpen}
        onOpenChange={(open) => {
          setNewQuoteOpen(open);
          if (!open) {
            setNewQuoteError("");
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nueva cotizacion</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre completo</Label>
              <Input
                value={newQuoteDraft.fullName}
                onChange={(event) =>
                  setNewQuoteDraft((prev) => ({ ...prev, fullName: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo identificacion</Label>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={newQuoteDraft.identificationTypeId}
                onChange={(event) =>
                  setNewQuoteDraft((prev) => ({
                    ...prev,
                    identificationTypeId: event.target.value,
                  }))
                }
              >
                <option value="">Seleccionar</option>
                {catalogs.identificationTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Identificacion</Label>
              <Input
                value={newQuoteDraft.identification}
                onChange={(event) =>
                  setNewQuoteDraft((prev) => ({ ...prev, identification: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Telefono</Label>
              <Input
                value={newQuoteDraft.phone}
                onChange={(event) =>
                  setNewQuoteDraft((prev) => ({ ...prev, phone: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Correo</Label>
              <Input
                value={newQuoteDraft.email}
                onChange={(event) =>
                  setNewQuoteDraft((prev) => ({ ...prev, email: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Destino</Label>
              <Input
                value={newQuoteDraft.quoteDestination}
                onChange={(event) =>
                  setNewQuoteDraft((prev) => ({ ...prev, quoteDestination: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Mes de viaje</Label>
              <Input
                value={newQuoteDraft.quoteTravelMonth}
                onChange={(event) =>
                  setNewQuoteDraft((prev) => ({ ...prev, quoteTravelMonth: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Notas</Label>
              <textarea
                className="min-h-[90px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={newQuoteDraft.notes}
                onChange={(event) =>
                  setNewQuoteDraft((prev) => ({ ...prev, notes: event.target.value }))
                }
              />
            </div>
          </div>
          {newQuoteError ? <p className="text-xs text-rose-600">{newQuoteError}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNewQuoteOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCreateQuoteLead()} disabled={isCreatingLead}>
              {isCreatingLead ? "Guardando..." : "Crear cotizacion"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
