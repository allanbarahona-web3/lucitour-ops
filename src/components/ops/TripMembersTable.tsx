"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import type {
  CatalogItem,
  CatalogName,
  ContractModificationRequest,
  ContractModificationStep,
  UpdateContractModificationPatch,
  DocumentUpload,
  DocumentType,
  TripMember,
  UpdateTripMemberPatch,
  UpsellType,
  User,
} from "../../lib/types/ops";
import {
  ContractModificationStatus,
  ContractsStatus,
  ContractStatus,
  DocsStatus,
  ItineraryStatus,
  MaritalStatus,
  PassportStatus,
  BillingStatus,
  Role,
  UpsellOrderStatus,
} from "../../lib/types/ops";
import type { IOpsRepo } from "../../lib/data/opsRepo";
import { TripMemberFilters, type TripMemberFilterState } from "./TripMemberFilters";
import { AddCatalogItemDialog } from "./AddCatalogItemDialog";
import { AddTripMemberDialog } from "./AddTripMemberDialog";

const statusOptions = {
  contractStatus: [ContractStatus.SENT, ContractStatus.MISSING],
  docsStatus: [DocsStatus.UPLOADED, DocsStatus.NOT_UPLOADED],
  passportStatus: [PassportStatus.ENTERED, PassportStatus.NOT_ENTERED],
  itineraryStatus: [
    ItineraryStatus.READY,
    ItineraryStatus.MISSING,
    ItineraryStatus.NOT_APPLICABLE,
  ],
};

const maritalOptions = [
  { value: MaritalStatus.SINGLE, label: "Soltero" },
  { value: MaritalStatus.MARRIED, label: "Casado" },
  { value: MaritalStatus.DIVORCED, label: "Divorciado" },
  { value: MaritalStatus.WIDOWED, label: "Viudo" },
];

const selectClassName =
  "w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900";

const LEAD_PENDING_TAG = "[PENDIENTE_PASAJERO]";

const inputClassName =
  "w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900";

const isPending = (member: TripMember) =>
  member.contractStatus === ContractStatus.MISSING ||
  member.docsStatus === DocsStatus.NOT_UPLOADED ||
  member.passportStatus === PassportStatus.NOT_ENTERED ||
  member.itineraryStatus === ItineraryStatus.MISSING;

interface TripMembersTableProps {
  tripId: string;
  tripName: string;
  tripDateFrom: string;
  tripDateTo: string;
  tripLodgingType: TripMember["packageLodgingType"];
  tripPackageBasePrice: number;
  tripReservationMinPerPerson: number;
  repo: IOpsRepo;
  users: User[];
  currentUser: User;
  maxSeats: number;
}

type CatalogMap = Record<CatalogName, CatalogItem[]>;

type CatalogDialogTarget = {
  catalogName: CatalogName;
  memberId?: string;
  field?: keyof TripMember;
};

export const TripMembersTable = ({
  tripId,
  tripName,
  tripDateFrom,
  tripDateTo,
  tripLodgingType,
  tripPackageBasePrice,
  tripReservationMinPerPerson,
  repo,
  users,
  currentUser,
  maxSeats,
}: TripMembersTableProps) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [members, setMembers] = useState<TripMember[]>([]);
  const [catalogs, setCatalogs] = useState<CatalogMap>({
    airlines: [],
    lodgingTypes: [],
    accommodations: [],
    insurances: [],
    nationalities: [],
    identificationTypes: [],
  });
  const [filters, setFilters] = useState<TripMemberFilterState>({
    search: "",
    assignedToId: "",
    pendingOnly: false,
  });
  const [detailsDialog, setDetailsDialog] = useState<{ open: boolean; member: TripMember | null }>(
    { open: false, member: null },
  );
  const [detailsDraft, setDetailsDraft] = useState("");
  const [catalogDialog, setCatalogDialog] = useState<{
    open: boolean;
    target: CatalogDialogTarget | null;
  }>({ open: false, target: null });
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [blockLocks, setBlockLocks] = useState<Record<string, Record<string, boolean>>>({});
  const [docOwners, setDocOwners] = useState<Record<string, Record<DocumentType, string>>>({});
  const [docConcepts, setDocConcepts] = useState<
    Record<string, Record<DocumentType, { concept: string; conceptOther: string }>>
  >({});
  const [agentTab, setAgentTab] = useState<"active" | "sent">("active");
  const [expandedCompanionByMember, setExpandedCompanionByMember] = useState<
    Record<string, number | null>
  >({});
  const [expandedInsuranceByMember, setExpandedInsuranceByMember] = useState<
    Record<string, number | null>
  >({});
  const [expandedInsuranceTitularByMember, setExpandedInsuranceTitularByMember] = useState<
    Record<string, boolean>
  >({});
  const [modRequests, setModRequests] = useState<ContractModificationRequest[]>([]);
  const [modDialog, setModDialog] = useState<{ open: boolean; member: TripMember | null }>({
    open: false,
    member: null,
  });
  const [modExpandedCompanionIndex, setModExpandedCompanionIndex] = useState<
    number | null
  >(0);
  const [modExpandedInsuranceIndex, setModExpandedInsuranceIndex] = useState<
    number | null
  >(0);
  const [modExpandedInsuranceTitular, setModExpandedInsuranceTitular] = useState(true);
  const [sentSummaryDialog, setSentSummaryDialog] = useState<{
    open: boolean;
    member: TripMember | null;
  }>({ open: false, member: null });
  const [sentSummaryStep, setSentSummaryStep] = useState<
    "GENERAL" | "STEP1" | "STEP2" | "STEP3" | "STEP4" | "STEP5"
  >("GENERAL");
  const [modStep, setModStep] = useState<ContractModificationStep>("STEP1");
  const [modDraft, setModDraft] = useState<TripMember | null>(null);
  const [isSavingModification, setIsSavingModification] = useState(false);
  const [upsellDialog, setUpsellDialog] = useState<{ open: boolean; member: TripMember | null }>(
    {
      open: false,
      member: null,
    },
  );
  const [upsellLines, setUpsellLines] = useState<
    Array<{
      id: string;
      type: UpsellType;
      label: string;
      ownerName: string;
      quantity: number | null;
      unitPrice: number | null;
    }>
  >([]);
  const [upsellNotes, setUpsellNotes] = useState("");
  const [isSavingUpsell, setIsSavingUpsell] = useState(false);

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const [focusedMemberId, setFocusedMemberId] = useState<string | null>(null);

  const isAdmin = currentUser.role === Role.ADMIN;
  const isAgent = currentUser.role === Role.AGENT || currentUser.role === Role.SUPERVISOR;
  const isSupervisor = currentUser.role === Role.SUPERVISOR;
  const canManageClients = isAdmin || isSupervisor;

  const userById = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach((user) => map.set(user.id, user));
    return map;
  }, [users]);

  const agentUsers = useMemo(
    () => users.filter((user) => user.role === Role.AGENT || user.role === Role.SUPERVISOR),
    [users],
  );
  const loadCatalogs = async () => {
    const [
      airlines,
      lodgingTypes,
      accommodations,
      insurances,
      nationalities,
      identificationTypes,
    ] = await Promise.all([
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

  const loadMembers = async () => {
    const data = await repo.listTripMembers(tripId);
    const normalized = data.map((member) => ({
      ...member,
      companions: (member.companions ?? []).map((companion) => ({
        ...companion,
        identificationTypeId: companion.identificationTypeId ?? "",
        email: companion.email ?? "",
        phone: companion.phone ?? "",
        address: companion.address ?? "",
        maritalStatus: companion.maritalStatus ?? "",
        nationalityId: companion.nationalityId ?? "",
        profession: companion.profession ?? "",
        wantsInsurance: companion.wantsInsurance ?? null,
        insuranceId: companion.insuranceId ?? "",
        hasOwnInsurance: companion.hasOwnInsurance ?? null,
        emergencyContactName: companion.emergencyContactName ?? "",
        emergencyContactPhone: companion.emergencyContactPhone ?? "",
        specialSituations: companion.specialSituations ?? "",
      })),
      packageLodgingType: member.packageLodgingType ?? tripLodgingType ?? "",
      packageBasePrice: member.packageBasePrice ?? tripPackageBasePrice ?? 0,
      packageFinalPrice:
        member.packageFinalPrice ??
        (member.packageBasePrice ?? tripPackageBasePrice ?? 0) * Math.max(1, (member.companions ?? []).length + 1),
      reservationMinPerPerson:
        member.reservationMinPerPerson ?? tripReservationMinPerPerson ?? 0,
      reservationFinalPerPerson:
        member.reservationFinalPerPerson ??
        member.reservationMinPerPerson ??
        tripReservationMinPerPerson ??
        0,
      paymentPlanMonths: member.paymentPlanMonths ?? null,
      paymentBalanceTotal: member.paymentBalanceTotal ?? null,
      paymentInstallmentAmount: member.paymentInstallmentAmount ?? null,
      accommodationType: member.accommodationType ?? "",
      seatUnitPrice: member.seatUnitPrice ?? null,
      luggageType: member.luggageType ?? "",
      luggageQuantity: member.luggageQuantity ?? null,
      luggageUnitPrice: member.luggageUnitPrice ?? null,
      extraTours: member.extraTours ?? [],
    }));
    setMembers(normalized);
  };

  const loadModifications = async () => {
    const data = await repo.listContractModifications();
    setModRequests(data);
  };

  useEffect(() => {
    void loadCatalogs();
    void loadMembers();
    void loadModifications();
  }, [tripId]);

  useEffect(() => {
    if (!isAgent) {
      return;
    }
    const interval = setInterval(() => {
      void loadModifications();
    }, 15000);
    return () => clearInterval(interval);
  }, [isAgent, tripId]);

  useEffect(() => {
    const focusId = searchParams.get("focus");
    const requestedTab = searchParams.get("tab");
    if (requestedTab === "sent") {
      setAgentTab("sent");
    } else if (requestedTab === "active") {
      setAgentTab("active");
    }
    if (!focusId || members.length === 0) {
      return;
    }

    const targetMember = members.find((member) => member.id === focusId);
    if (targetMember && targetMember.contractsStatus === ContractsStatus.SENT) {
      setAgentTab("sent");
    }
    const target = rowRefs.current[focusId];
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      setFocusedMemberId(focusId);
      const timer = setTimeout(() => setFocusedMemberId(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [members, searchParams]);

  const updateMemberLocal = (memberId: string, patch: UpdateTripMemberPatch) => {
    setMembers((prev) =>
      prev.map((member) => (member.id === memberId ? { ...member, ...patch } : member)),
    );
  };

  const persistUpdate = async (memberId: string, patch: UpdateTripMemberPatch) => {
    const updated = await repo.updateTripMember(tripId, memberId, patch);
    if (updated) {
      setMembers((prev) =>
        prev.map((member) => (member.id === memberId ? updated : member)),
      );
    }
  };

  const scheduleUpdate = (
    memberId: string,
    patch: UpdateTripMemberPatch,
    key: string,
    delay = 500,
  ) => {
    updateMemberLocal(memberId, patch);
    if (debounceTimers.current[key]) {
      clearTimeout(debounceTimers.current[key]);
    }
    debounceTimers.current[key] = setTimeout(() => {
      void persistUpdate(memberId, patch);
    }, delay);
  };

  const handleSelectChange = async (
    memberId: string,
    patch: UpdateTripMemberPatch,
    catalogTarget?: CatalogDialogTarget,
  ) => {
    if (catalogTarget) {
      const nextValue = (patch as Record<string, string>)[catalogTarget.field as string];
      if (nextValue === "__add_new__") {
        setCatalogDialog({ open: true, target: catalogTarget });
        return;
      }
    }

    updateMemberLocal(memberId, patch);
    await persistUpdate(memberId, patch);

    // Keep a visible follow-up marker in the related Lead when passenger setup is saved as draft.
    if (typeof patch.isDraft === "boolean") {
      const member = members.find((item) => item.id === memberId);
      if (member) {
        const leads = await repo.listLeads();
        const relatedLead = leads.find(
          (lead) =>
            lead.quoteTripMemberId === memberId ||
            (member.quoteCode && lead.quoteCode === member.quoteCode),
        );

        if (relatedLead) {
          const currentNotes = relatedLead.notes ?? "";
          const hasPendingTag = currentNotes.includes(LEAD_PENDING_TAG);

          let nextNotes = currentNotes;
          if (patch.isDraft && !hasPendingTag) {
            nextNotes = currentNotes.trim().length
              ? `${currentNotes.trim()}\n${LEAD_PENDING_TAG}`
              : LEAD_PENDING_TAG;
          }

          if (!patch.isDraft && hasPendingTag) {
            nextNotes = currentNotes
              .replaceAll(LEAD_PENDING_TAG, "")
              .split("\n")
              .map((line) => line.trim())
              .filter((line) => line.length > 0)
              .join("\n");
          }

          if (nextNotes !== currentNotes) {
            await repo.updateLead(relatedLead.id, { notes: nextNotes });
          }
        }
      }
    }
  };

  const handleDetailsSave = async () => {
    if (!detailsDialog.member) {
      return;
    }

    await persistUpdate(detailsDialog.member.id, { details: detailsDraft });
    setDetailsDialog({ open: false, member: null });
  };

  const isBlockLocked = (memberId: string, block: string) =>
    blockLocks[memberId]?.[block] ?? false;

  const setBlockLock = (memberId: string, block: string, locked: boolean) => {
    setBlockLocks((prev) => ({
      ...prev,
      [memberId]: {
        ...(prev[memberId] ?? {}),
        [block]: locked,
      },
    }));
  };

  const saveBlock = async (memberId: string, block: string, patch: UpdateTripMemberPatch = {}) => {
    await persistUpdate(memberId, patch);
    setBlockLock(memberId, block, true);
  };

  const updateCompanions = (member: TripMember, nextCompanions: TripMember["companions"]) => {
    const hasMinorCompanions = nextCompanions.some((companion) => companion.isMinor);
    const nextHasCompanions = nextCompanions.length > 0;
    const nextDocuments = hasMinorCompanions
      ? member.documents
      : member.documents.filter((doc) => doc.type !== "MINOR_PERMIT");
    schedulePricingUpdate(
      member,
      {
        companions: nextCompanions,
        hasCompanions: nextHasCompanions,
        hasMinorCompanions,
        hasParentalAuthority: hasMinorCompanions ? member.hasParentalAuthority : null,
        documents: nextDocuments,
        docFlags: {
          ...member.docFlags,
          minorPermit: hasMinorCompanions ? member.docFlags.minorPermit : false,
        },
      },
      `${member.id}:companions`,
    );
  };

  const calculatePackageTotals = (member: TripMember, patch: Partial<TripMember> = {}) => {
    const next = { ...member, ...patch };
    const seats = Math.max(1, (next.companions ?? []).length + 1);
    const basePrice = next.packageBasePrice ?? 0;
    const baseTotal = basePrice * seats;
    const reservationBase = next.reservationMinPerPerson ?? 0;
    const reservationPerPerson = reservationBase;
    const reservationTotal = reservationPerPerson * seats;
    const balanceTotal = Math.max(0, baseTotal - reservationTotal);
    const months = Math.max(0, next.paymentPlanMonths ?? 0);
    const installmentAmount = months > 0 ? balanceTotal / months : balanceTotal;
    return {
      seats,
      baseTotal,
      total: baseTotal,
      reservationPerPerson,
      reservationTotal,
      balanceTotal,
      installmentAmount,
    };
  };

  const schedulePricingUpdate = (
    member: TripMember,
    patch: UpdateTripMemberPatch,
    key: string,
  ) => {
    const totals = calculatePackageTotals(member, patch as Partial<TripMember>);
    scheduleUpdate(
      member.id,
      {
        ...patch,
        seats: totals.seats,
        packageFinalPrice: totals.baseTotal,
        reservationFinalPerPerson: totals.reservationPerPerson,
        paymentBalanceTotal: totals.balanceTotal,
        paymentInstallmentAmount: totals.installmentAmount,
      },
      key,
    );
  };

  const openModificationDialog = (member: TripMember) => {
    setModDialog({ open: true, member });
    setModStep("STEP1");
    setModExpandedCompanionIndex(0);
    setModExpandedInsuranceIndex(0);
    setModExpandedInsuranceTitular(true);
    setModDraft({
      ...member,
      companions: member.companions.map((companion) => ({ ...companion })),
      documents: member.documents.map((doc) => ({ ...doc })),
      docFlags: { ...member.docFlags },
    });
  };

  const closeModificationDialog = () => {
    setModDialog({ open: false, member: null });
    setModDraft(null);
  };

  const openSentSummaryDialog = (member: TripMember) => {
    setSentSummaryDialog({ open: true, member });
    setSentSummaryStep("GENERAL");
  };

  const updateDraft = (patch: UpdateTripMemberPatch) => {
    setModDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const handleDraftSelectChange = (
    patch: UpdateTripMemberPatch,
    catalogTarget?: CatalogDialogTarget,
  ) => {
    if (catalogTarget) {
      const nextValue = (patch as Record<string, string>)[catalogTarget.field as string];
      if (nextValue === "__add_new__") {
        setCatalogDialog({ open: true, target: catalogTarget });
        return;
      }
    }
    updateDraft(patch);
  };

  const updateCompanionsDraft = (nextCompanions: TripMember["companions"]) => {
    setModDraft((prev) => {
      if (!prev) {
        return prev;
      }
      const hasMinorCompanions = nextCompanions.some((companion) => companion.isMinor);
      const nextHasCompanions = nextCompanions.length > 0;
      const nextDocuments = hasMinorCompanions
        ? prev.documents
        : prev.documents.filter((doc) => doc.type !== "MINOR_PERMIT");
      return {
        ...prev,
        companions: nextCompanions,
        hasCompanions: nextHasCompanions,
        hasMinorCompanions,
        hasParentalAuthority: hasMinorCompanions ? prev.hasParentalAuthority : null,
        documents: nextDocuments,
        docFlags: {
          ...prev.docFlags,
          minorPermit: hasMinorCompanions ? prev.docFlags.minorPermit : false,
        },
      };
    });
  };

  const buildModificationPayload = (
    draft: TripMember,
    step: ContractModificationStep,
  ): UpdateTripMemberPatch => {
    switch (step) {
      case "STEP1":
        return {
          address: draft.address,
          maritalStatus: draft.maritalStatus,
          nationalityId: draft.nationalityId,
          profession: draft.profession,
        };
      case "STEP2":
        return {
          wantsInsurance: draft.wantsInsurance,
          insuranceId: draft.insuranceId,
          hasOwnInsurance: draft.hasOwnInsurance,
          emergencyContactName: draft.emergencyContactName,
          emergencyContactPhone: draft.emergencyContactPhone,
          specialSituations: draft.specialSituations,
          companions: draft.companions,
        };
      case "STEP3":
        return {
          hasCompanions: draft.hasCompanions,
          companions: draft.companions,
          hasMinorCompanions: draft.hasMinorCompanions,
          hasParentalAuthority: draft.hasParentalAuthority,
        };
      case "STEP4":
        return {
          documents: draft.documents,
          docFlags: draft.docFlags,
        };
      default:
        return {};
    }
  };

  const getModificationStepLabel = (step: ContractModificationStep) => {
    switch (step) {
      case "STEP1":
        return "Paso 1 · Datos del viaje";
      case "STEP2":
        return "Paso 2 · Acompanantes";
      case "STEP3":
        return "Paso 3 · Seguro y emergencia";
      case "STEP4":
        return "Paso 4 · Documentos";
      default:
        return step;
    }
  };

  const getStepToneClass = (step: ContractModificationStep) => {
    switch (step) {
      case "STEP1":
        return "text-emerald-700";
      case "STEP2":
        return "text-cyan-700";
      case "STEP3":
        return "text-amber-600";
      case "STEP4":
        return "text-violet-700";
      default:
        return "text-slate-700";
    }
  };

  const getModificationStatusLabel = (status: ContractModificationStatus) =>
    status === ContractModificationStatus.PENDING ? "Pendiente" : "Listo";

  const handleSubmitModification = async () => {
    if (!modDialog.member || !modDraft || isSavingModification) {
      return;
    }
    setIsSavingModification(true);
    try {
      const created = await repo.createContractModification({
        tripId,
        memberId: modDialog.member.id,
        step: modStep,
        payload: buildModificationPayload(modDraft, modStep),
        requestedByUserId: currentUser.id,
        assignedToUserId: currentUser.id,
        processedByUserId: null,
        processedAt: null,
        status: ContractModificationStatus.PENDING,
      });
      setModRequests((prev) => [created, ...prev]);
      closeModificationDialog();
    } finally {
      setIsSavingModification(false);
    }
  };

  const openUpsellDialog = (member: TripMember) => {
    const titularName = member.fullName?.trim() || "Titular";
    setUpsellDialog({ open: true, member });
    setUpsellNotes("");
    setUpsellLines([
      { id: `${member.id}-upsell-seat`, type: "SEAT", label: "Asientos adicionales", ownerName: titularName, quantity: null, unitPrice: null },
      { id: `${member.id}-upsell-luggage`, type: "LUGGAGE", label: "", ownerName: titularName, quantity: null, unitPrice: null },
      { id: `${member.id}-upsell-tour`, type: "TOUR", label: "", ownerName: titularName, quantity: null, unitPrice: null },
      { id: `${member.id}-upsell-insurance`, type: "INSURANCE", label: "Seguros", ownerName: titularName, quantity: null, unitPrice: null },
      { id: `${member.id}-upsell-flight`, type: "FLIGHT", label: "", ownerName: titularName, quantity: null, unitPrice: null },
    ]);
  };

  const getUpsellDefaultLabel = (type: UpsellType) => {
    switch (type) {
      case "SEAT":
        return "Asientos adicionales";
      case "INSURANCE":
        return "Seguros";
      default:
        return "";
    }
  };

  const addUpsellLine = (type: UpsellType, label = "") => {
    const titularName = upsellDialog.member?.fullName?.trim() || "Titular";
    setUpsellLines((prev) => [
      ...prev,
      {
        id: `upsell-${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type,
        label,
        ownerName: titularName,
        quantity: null,
        unitPrice: null,
      },
    ]);
  };

  const addUpsellLineByType = (type: UpsellType) => {
    addUpsellLine(type, getUpsellDefaultLabel(type));
  };

  const removeUpsellLine = (lineId: string) => {
    setUpsellLines((prev) => prev.filter((line) => line.id !== lineId));
  };

  const closeUpsellDialog = () => {
    setUpsellDialog({ open: false, member: null });
    setUpsellLines([]);
    setUpsellNotes("");
  };

  const upsellSubtotal = upsellLines.reduce(
    (sum, line) => sum + Math.max(0, line.quantity ?? 0) * Math.max(0, line.unitPrice ?? 0),
    0,
  );

  const upsellOwnerOptions = useMemo(() => {
    const titularName = upsellDialog.member?.fullName?.trim() || "Titular";
    const companionNames = (upsellDialog.member?.companions ?? []).map(
      (companion, idx) => companion.fullName?.trim() || `Acompanante ${idx + 1}`,
    );

    return [titularName, ...companionNames].filter(
      (name, idx, arr) => name.length > 0 && arr.indexOf(name) === idx,
    );
  }, [upsellDialog.member]);

  const handleSubmitUpsell = async () => {
    if (!upsellDialog.member || isSavingUpsell) {
      return;
    }
    const normalizedLines = upsellLines
      .map((line) => ({
        ...line,
        ownerName: line.ownerName?.trim() || "Titular",
        quantity: Math.max(0, line.quantity ?? 0),
        unitPrice: Math.max(0, line.unitPrice ?? 0),
      }))
      .filter(
        (line) =>
          line.quantity > 0 &&
          line.unitPrice > 0 &&
          line.label.trim().length > 0 &&
          line.ownerName.trim().length > 0,
      );

    if (normalizedLines.length === 0) {
      return;
    }

    setIsSavingUpsell(true);
    try {
      const leads = await repo.listLeads();
      const relatedLead = leads.find(
        (lead) =>
          lead.quoteTripMemberId === upsellDialog.member?.id ||
          (upsellDialog.member?.quoteCode && lead.quoteCode === upsellDialog.member.quoteCode),
      );
      await repo.createUpsellOrder({
        tripId,
        tripMemberId: upsellDialog.member.id,
        leadId: relatedLead?.id ?? null,
        clientId: upsellDialog.member.clientId,
        quoteCode: upsellDialog.member.quoteCode ?? null,
        status: UpsellOrderStatus.SENT_TO_PURCHASES,
        totalAmount: normalizedLines.reduce(
          (sum, line) => sum + line.quantity * line.unitPrice,
          0,
        ),
        notes: upsellNotes,
        lines: normalizedLines.map((line) => ({
          id: line.id,
          type: line.type,
          label: line.label,
          ownerName: line.ownerName,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          totalPrice: line.quantity * line.unitPrice,
        })),
        createdByUserId: currentUser.id,
      });
      closeUpsellDialog();
    } finally {
      setIsSavingUpsell(false);
    }
  };

  const updateModification = async (
    requestId: string,
    patch: UpdateContractModificationPatch,
  ) => {
    setModRequests((prev) =>
      prev.map((request) => (request.id === requestId ? { ...request, ...patch } : request)),
    );
    const updated = await repo.updateContractModification(requestId, patch);
    if (updated) {
      setModRequests((prev) =>
        prev.map((request) => (request.id === requestId ? updated : request)),
      );
    }
  };

  const toggleExpanded = (memberId: string) => {
    setExpandedRows((prev) => ({ ...prev, [memberId]: !prev[memberId] }));
  };

  const formatDate = (value: string) => {
    if (!value) {
      return "-";
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return parsed.toLocaleString();
  };

  const isFilled = (value: string | number | string[]) => {
    if (typeof value === "number") {
      return value > 0;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return value.trim().length > 0;
  };

  const isInsuranceBlockComplete = (person: {
    wantsInsurance: boolean | null;
    insuranceId: string;
    hasOwnInsurance: boolean | null;
    emergencyContactName: string;
    emergencyContactPhone: string;
    specialSituations: string;
  }) =>
    person.wantsInsurance !== null &&
    (person.wantsInsurance !== true || isFilled(person.insuranceId)) &&
    (person.wantsInsurance !== false || person.hasOwnInsurance !== null) &&
    isFilled(person.emergencyContactName) &&
    isFilled(person.emergencyContactPhone) &&
    isFilled(person.specialSituations);

const requiresMinorPermit = (member: TripMember) =>
  member.hasMinorCompanions && member.hasParentalAuthority === false;

  const getOwnerValue = (memberId: string, type: DocumentType) =>
    docOwners[memberId]?.[type] ?? "Titular";

  const getConceptValue = (memberId: string, type: DocumentType) =>
    docConcepts[memberId]?.[type]?.concept ?? "RESERVA";

  const getConceptOtherValue = (memberId: string, type: DocumentType) =>
    docConcepts[memberId]?.[type]?.conceptOther ?? "";

  const getContractsStatusLabel = (member: TripMember) => {
    if (member.contractsStatus !== ContractsStatus.SENT) {
      return member.isDraft ? "Borrador" : "Pendiente";
    }

    const sentByName = member.contractsSentByUserId
      ? userById.get(member.contractsSentByUserId)?.name
      : null;
    const sentAt = member.contractsSentAt ? formatDate(member.contractsSentAt) : null;
    const detail = [sentByName, sentAt].filter(Boolean).join(" · ");
    return detail ? `Enviado · ${detail}` : "Enviado";
  };

  const setOwnerValue = (memberId: string, type: DocumentType, value: string) => {
    setDocOwners((prev) => ({
      ...prev,
      [memberId]: {
        ...(prev[memberId] ?? {}),
        [type]: value,
      },
    }));
  };

  const setConceptValue = (memberId: string, type: DocumentType, value: string) => {
    setDocConcepts((prev) => ({
      ...prev,
      [memberId]: {
        ...(prev[memberId] ?? {}),
        [type]: {
          concept: value,
          conceptOther: prev[memberId]?.[type]?.conceptOther ?? "",
        },
      },
    }));
  };

  const setConceptOtherValue = (memberId: string, type: DocumentType, value: string) => {
    setDocConcepts((prev) => ({
      ...prev,
      [memberId]: {
        ...(prev[memberId] ?? {}),
        [type]: {
          concept: prev[memberId]?.[type]?.concept ?? "RESERVA",
          conceptOther: value,
        },
      },
    }));
  };

  const formatDocConcept = (doc: DocumentUpload) => {
    if (!doc.concept) {
      return "";
    }
    if (doc.concept === "OTHER") {
      return doc.conceptOther ? `Otros: ${doc.conceptOther}` : "Otros";
    }
    return doc.concept;
  };

  const paymentConceptOptions = [
    { value: "RESERVA", label: "Reserva" },
    { value: "ABONO", label: "Abono" },
    { value: "SEGURO", label: "Seguros" },
    { value: "ASIENTOS", label: "Asientos adicionales" },
    { value: "EQUIPAJE", label: "Equipaje" },
    { value: "TOURS", label: "Tours extra" },
    { value: "OTHER", label: "Otros" },
  ];

  const addDocuments = (
    member: TripMember,
    type: DocumentType,
    ownerName: string,
    files: FileList | null,
    meta?: { concept?: string; conceptOther?: string },
  ) => {
    if (!files || files.length === 0) {
      return member.documents;
    }
    const timestamp = Date.now();
    const nextDocs = Array.from(files).map((file, index) => ({
      id: `${member.id}-${type}-${timestamp}-${index}`,
      type,
      fileName: file.name,
      ownerName,
      concept: meta?.concept ?? "",
      conceptOther: meta?.conceptOther ?? "",
    }));
    return [...member.documents, ...nextDocs];
  };

  const removeDocument = (member: TripMember, docId: string) =>
    member.documents.filter((doc) => doc.id !== docId);

  const getDocsByType = (member: TripMember, type: DocumentType) =>
    member.documents.filter((doc) => doc.type === type);

  const buildProgress = (checks: Array<{ label: string; ok: boolean }>) => {
    const filled = checks.filter((item) => item.ok).length;
    const total = checks.length;
    const percent = total > 0 ? Math.round((filled / total) * 100) : 0;
    const missing = checks.filter((item) => !item.ok).map((item) => item.label);
    return { filled, total, percent, missing };
  };

  const getStepProgress = (member: TripMember) => {
    const packageName = member.packageName || tripName;
    const step1Checks = [
      { label: "Nombre completo", ok: isFilled(member.fullName) },
      { label: "Identificacion", ok: isFilled(member.identification) },
      { label: "Tipo ID", ok: isFilled(member.identificationTypeId) },
      { label: "Telefono", ok: isFilled(member.phone) },
      { label: "Correo", ok: isFilled(member.email) },
      { label: "Destino contratado", ok: isFilled(packageName) },
      { label: "Direccion exacta", ok: isFilled(member.address) },
      { label: "Estado civil", ok: isFilled(member.maritalStatus) },
      { label: "Nacionalidad", ok: isFilled(member.nationalityId) },
      { label: "Profesion u ocupacion", ok: isFilled(member.profession) },
    ];
    const step2Checks = [
      { label: "Acompanantes", ok: member.hasCompanions !== null },
      { label: "Acomodacion", ok: isFilled(member.accommodationType) },
      {
        label: "Lista de acompanantes",
        ok: member.hasCompanions !== true || member.companions.length > 0,
      },
      {
        label: "Datos acompanantes",
        ok:
          member.hasCompanions !== true ||
          member.companions.every(
            (companion) =>
              isFilled(companion.fullName) &&
              isFilled(companion.identificationTypeId) &&
              isFilled(companion.identification) &&
              isFilled(companion.email) &&
              isFilled(companion.phone) &&
              isFilled(companion.address) &&
              isFilled(companion.maritalStatus) &&
              isFilled(companion.nationalityId) &&
              isFilled(companion.profession),
          ),
      },
      {
        label: "Patria potestad",
        ok: !member.hasMinorCompanions || member.hasParentalAuthority !== null,
      },
    ];
    const step3Checks = [
      { label: "Seguro y emergencia titular", ok: isInsuranceBlockComplete(member) },
      {
        label: "Seguro y emergencia acompanantes",
        ok:
          member.hasCompanions !== true ||
          member.companions.every((companion) => isInsuranceBlockComplete(companion)),
      },
    ];
    const step4Checks = [
      { label: "Precio paquete", ok: (member.packageBasePrice ?? 0) >= 0 },
      { label: "Reserva minima", ok: (member.reservationMinPerPerson ?? 0) >= 0 },
      { label: "Plazo cuotas", ok: (member.paymentPlanMonths ?? 0) > 0 },
    ];
    const step5Required = [
      { key: "idCard", label: "Documento: Cedula", enabled: true, type: "ID_CARD" as DocumentType },
      { key: "passport", label: "Documento: Pasaporte", enabled: true, type: "PASSPORT" as DocumentType },
      {
        key: "insurance",
        label: "Documento: Seguro propio",
        enabled:
          member.hasOwnInsurance === true ||
          member.companions.some((companion) => companion.hasOwnInsurance === true),
        type: "INSURANCE" as DocumentType,
      },
      {
        key: "paymentProof",
        label: "Documento: Pagos",
        enabled: true,
        type: "PAYMENT_PROOF" as DocumentType,
      },
    ];
    const step5Checks = step5Required
      .filter((doc) => doc.enabled)
      .map((doc) => ({
        label: doc.label,
        ok:
          member.docFlags[doc.key as keyof typeof member.docFlags] &&
          getDocsByType(member, doc.type).length > 0,
      }));

    const step1 = buildProgress(step1Checks);
    const step2 = buildProgress(step2Checks);
    const step3 = buildProgress(step3Checks);
    const step4 = buildProgress(step4Checks);
    const step5 = buildProgress(step5Checks);
    const overall = buildProgress([
      ...step1Checks,
      ...step2Checks,
      ...step3Checks,
      ...step4Checks,
      ...step5Checks,
    ]);

    return { step1, step2, step3, step4, step5, overall };
  };

  const filteredMembers = useMemo(() => {
    const searchLower = filters.search.trim().toLowerCase();
    return members.filter((member) => {
      if (filters.pendingOnly && !isPending(member)) {
        return false;
      }

      if (filters.assignedToId && member.assignedToUserId !== filters.assignedToId) {
        return false;
      }

      if (searchLower) {
        const haystack = `${member.fullName} ${member.reservationCode}`.toLowerCase();
        if (!haystack.includes(searchLower)) {
          return false;
        }
      }

      return true;
    });
  }, [members, filters]);

  const agentActiveMembers = useMemo(
    () => filteredMembers.filter((member) => member.contractsStatus !== ContractsStatus.SENT),
    [filteredMembers],
  );

  const agentSentMembers = useMemo(
    () => filteredMembers.filter((member) => member.contractsStatus === ContractsStatus.SENT),
    [filteredMembers],
  );

  const tripModRequests = useMemo(
    () => modRequests.filter((request) => request.tripId === tripId),
    [modRequests, tripId],
  );

  const catalogOptions = useMemo(() => {
    const withAdd = (items: CatalogItem[]) =>
      isAdmin ? [...items, { id: "__add_new__", name: "+ Agregar nuevo...", active: true }] : items;

    return {
      airlines: withAdd(catalogs.airlines),
      lodgingTypes: withAdd(catalogs.lodgingTypes),
      accommodations: withAdd(catalogs.accommodations),
      insurances: withAdd(catalogs.insurances),
      nationalities: withAdd(catalogs.nationalities),
      identificationTypes: withAdd(catalogs.identificationTypes),
    };
  }, [catalogs, isAdmin]);

  const totalSeats = useMemo(
    () => members.reduce((sum, member) => sum + (member.seats || 0), 0),
    [members],
  );
  const remainingSeats = Math.max(0, maxSeats - totalSeats);
  const progressPercent = maxSeats > 0 ? Math.min(100, Math.round((totalSeats / maxSeats) * 100)) : 0;
  const isClosed = remainingSeats === 0;

  const renderTable = isAgent ? (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            agentTab === "active"
              ? "bg-slate-900 text-white"
              : "border border-slate-200 text-slate-600 hover:border-slate-300"
          }`}
          onClick={() => setAgentTab("active")}
        >
          En proceso ({agentActiveMembers.length})
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            agentTab === "sent"
              ? "bg-slate-900 text-white"
              : "border border-slate-200 text-slate-600 hover:border-slate-300"
          }`}
          onClick={() => setAgentTab("sent")}
        >
          Enviados ({agentSentMembers.length})
        </button>
      </div>

      {agentTab === "active" ? (
        <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-[1200px] w-full border-collapse text-xs">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Identificacion</th>
                <th className="px-3 py-2">Tipo ID</th>
                <th className="px-3 py-2">Telefono</th>
                <th className="px-3 py-2">Correo</th>
                <th className="px-3 py-2 text-center">Reserva</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {agentActiveMembers.length === 0 ? (
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-6 text-center text-sm text-slate-500" colSpan={7}>
                    Sin pendientes
                  </td>
                </tr>
              ) : (
                agentActiveMembers.map((member) => {
                  const progress = getStepProgress(member);
                  const missingItems = progress.overall.missing;
                  const canSend = missingItems.length === 0;
                  const expanded = expandedRows[member.id] ?? false;
                  const canExpand = member.wantsReservation;
                  const destinationLabel = member.packageName || tripName;
                  const step1Locked = isBlockLocked(member.id, "step1");
                  const step2Locked = isBlockLocked(member.id, "step2");
                  const step3Locked = isBlockLocked(member.id, "step3");
                  const step4Locked = isBlockLocked(member.id, "step4");
                  const step5Locked = isBlockLocked(member.id, "step5");
                  const lockedClass = "pointer-events-none opacity-60";
                  const pricing = calculatePackageTotals(member);

                  return (
                    <Fragment key={member.id}>
                      <tr className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-900">{member.fullName}</td>
                        <td className="px-3 py-2">
                          <input
                            className={inputClassName}
                            value={member.identification}
                            onChange={(event) =>
                              scheduleUpdate(
                                member.id,
                                { identification: event.target.value },
                                `${member.id}:identification`,
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            className={selectClassName}
                            value={member.identificationTypeId}
                            onChange={(event) =>
                              handleSelectChange(
                                member.id,
                                { identificationTypeId: event.target.value },
                                {
                                  catalogName: "identificationTypes",
                                  memberId: member.id,
                                  field: "identificationTypeId",
                                },
                              )
                            }
                          >
                            {catalogOptions.identificationTypes.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className={inputClassName}
                            value={member.phone}
                            onChange={(event) =>
                              scheduleUpdate(
                                member.id,
                                { phone: event.target.value },
                                `${member.id}:phone`,
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className={inputClassName}
                            value={member.email}
                            onChange={(event) =>
                              scheduleUpdate(
                                member.id,
                                { email: event.target.value },
                                `${member.id}:email`,
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300"
                            checked={member.wantsReservation}
                            onChange={(event) => {
                              const nextValue = event.target.checked;
                              if (!nextValue) {
                                setExpandedRows((prev) => ({ ...prev, [member.id]: false }));
                              }
                              scheduleUpdate(
                                member.id,
                                { wantsReservation: nextValue },
                                `${member.id}:wantsReservation`,
                              );
                            }}
                          />
                        </td>
                        <td className="px-3 py-2">
                          {canExpand ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleExpanded(member.id)}
                            >
                              {expanded ? "Ocultar" : "Ver"}
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                      {expanded && canExpand ? (
                        <tr className="border-t border-slate-100 bg-slate-50">
                          <td colSpan={isAdmin ? 10 : 9} className="px-3 py-4">
                            <div className="space-y-4">
                        <div className="rounded-md border border-slate-200 bg-white p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] text-white">1</span>
                              <span className="text-emerald-700">Paso 1 · Datos del viaje</span>
                            </div>
                            {step1Locked ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setBlockLock(member.id, "step1", false)}
                              >
                                Editar
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => void saveBlock(member.id, "step1", { packageName: tripName })}
                              >
                                Guardar
                              </Button>
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                            <span>Completitud</span>
                            <span className={progress.step1.percent === 100 ? "text-emerald-600" : ""}>
                              {progress.step1.percent}%
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
                            <div
                              className={`h-1.5 rounded-full ${
                                progress.step1.percent === 100 ? "bg-emerald-500" : "bg-amber-400"
                              }`}
                              style={{ width: `${progress.step1.percent}%` }}
                            />
                          </div>
                          <div className={`mt-3 grid gap-3 md:grid-cols-3 ${step1Locked ? lockedClass : ""}`}>
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-slate-600">Destino contratado</div>
                              <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                                {destinationLabel}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-slate-600">Tipo de hospedaje</div>
                              <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                                {member.packageLodgingType === "HOTEL"
                                  ? "Hotel"
                                  : member.packageLodgingType === "HOSTEL"
                                    ? "Hostel"
                                    : member.packageLodgingType === "AIRBNB"
                                      ? "Airbnb"
                                      : "-"}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-slate-600">Precio base paquete</div>
                              <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                                USD {(member.packageBasePrice ?? 0).toFixed(2)}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-slate-600">Reserva minima por persona</div>
                              <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                                USD {(member.reservationMinPerPerson ?? 0).toFixed(2)}
                              </div>
                            </div>
                            <div className="space-y-1 md:col-span-2">
                              <div className="text-xs font-semibold text-slate-600">Direccion exacta</div>
                              <input
                                className={inputClassName}
                                value={member.address}
                                disabled={step1Locked}
                                onChange={(event) =>
                                  scheduleUpdate(
                                    member.id,
                                    { address: event.target.value },
                                    `${member.id}:address`,
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-slate-600">Estado civil</div>
                              <select
                                className={selectClassName}
                                value={member.maritalStatus}
                                disabled={step1Locked}
                                onChange={(event) =>
                                  handleSelectChange(member.id, {
                                    maritalStatus: event.target.value as MaritalStatus | "",
                                  })
                                }
                              >
                                <option value="">Selecciona</option>
                                {maritalOptions.map((item) => (
                                  <option key={item.value} value={item.value}>
                                    {item.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-slate-600">Nacionalidad</div>
                              <select
                                className={selectClassName}
                                value={member.nationalityId}
                                disabled={step1Locked}
                                onChange={(event) =>
                                  handleSelectChange(
                                    member.id,
                                    { nationalityId: event.target.value },
                                    {
                                      catalogName: "nationalities",
                                      memberId: member.id,
                                      field: "nationalityId",
                                    },
                                  )
                                }
                              >
                                <option value="">Selecciona</option>
                                {catalogOptions.nationalities.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-slate-600">Profesion u ocupacion</div>
                              <input
                                className={inputClassName}
                                value={member.profession}
                                disabled={step1Locked}
                                onChange={(event) =>
                                  scheduleUpdate(
                                    member.id,
                                    { profession: event.target.value },
                                    `${member.id}:profession`,
                                  )
                                }
                              />
                            </div>
                          </div>
                        </div>

                        <div className="rounded-md border border-slate-200 bg-white p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] text-white">2</span>
                              <span className="text-cyan-700">Paso 2 · Acompanantes y acomodacion</span>
                            </div>
                            {step2Locked ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setBlockLock(member.id, "step2", false)}
                              >
                                Editar
                              </Button>
                            ) : (
                              <Button size="sm" onClick={() => void saveBlock(member.id, "step2")}>
                                Guardar
                              </Button>
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                            <span>Completitud</span>
                            <span className={progress.step2.percent === 100 ? "text-emerald-600" : ""}>
                              {progress.step2.percent}%
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
                            <div
                              className={`h-1.5 rounded-full ${
                                progress.step2.percent === 100 ? "bg-emerald-500" : "bg-amber-400"
                              }`}
                              style={{ width: `${progress.step2.percent}%` }}
                            />
                          </div>
                          <div className={`mt-3 space-y-3 ${step2Locked ? lockedClass : ""}`}>
                            <div className="grid gap-3 md:grid-cols-3">
                              <div className="space-y-1">
                                <div className="text-xs font-semibold text-slate-600">Acompanantes</div>
                                <select
                                  className={selectClassName}
                                  value={
                                    member.hasCompanions === null
                                      ? ""
                                      : member.hasCompanions
                                        ? "true"
                                        : "false"
                                  }
                                  disabled={step2Locked}
                                  onChange={(event) => {
                                    const hasCompanions = event.target.value === "true";
                                    if (event.target.value === "") {
                                      scheduleUpdate(
                                        member.id,
                                        {
                                          hasCompanions: null,
                                          companions: [],
                                          hasMinorCompanions: false,
                                          hasParentalAuthority: null,
                                          docFlags: { ...member.docFlags, minorPermit: false },
                                          documents: member.documents.filter(
                                            (doc) => doc.type !== "MINOR_PERMIT",
                                          ),
                                        },
                                        `${member.id}:hasCompanions`,
                                      );
                                      setExpandedCompanionByMember((prev) => {
                                        const { [member.id]: _, ...rest } = prev;
                                        return rest;
                                      });
                                      return;
                                    }
                                    if (!hasCompanions) {
                                      scheduleUpdate(
                                        member.id,
                                        {
                                          hasCompanions: false,
                                          companions: [],
                                          hasMinorCompanions: false,
                                          hasParentalAuthority: null,
                                          docFlags: { ...member.docFlags, minorPermit: false },
                                          documents: member.documents.filter(
                                            (doc) => doc.type !== "MINOR_PERMIT",
                                          ),
                                        },
                                        `${member.id}:hasCompanions`,
                                      );
                                      setExpandedCompanionByMember((prev) => {
                                        const { [member.id]: _, ...rest } = prev;
                                        return rest;
                                      });
                                      return;
                                    }
                                    scheduleUpdate(
                                      member.id,
                                      { hasCompanions: true },
                                      `${member.id}:hasCompanions`,
                                    );
                                    setExpandedCompanionByMember((prev) => ({
                                      ...prev,
                                      [member.id]: 0,
                                    }));
                                  }}
                                >
                                  <option value="">Selecciona</option>
                                  <option value="true">Si</option>
                                  <option value="false">No</option>
                                </select>
                              </div>
                            </div>

                            {member.hasCompanions ? (
                              <div className="space-y-2">
                                {member.companions.map((companion, index) => {
                                  const companionExpandedIndex =
                                    expandedCompanionByMember[member.id] === undefined
                                      ? 0
                                      : expandedCompanionByMember[member.id];
                                  const isExpanded = companionExpandedIndex === index;
                                  return (
                                    <div
                                      key={companion.id}
                                      className="space-y-3 rounded-md border border-slate-200 bg-white p-3"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="text-xs font-semibold text-slate-700">
                                          <span className="inline-flex items-center rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-900">
                                            Acompanante {index + 1}
                                          </span>
                                          {companion.fullName ? ` · ${companion.fullName}` : ""}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Button
                                            size="sm"
                                            className="h-6 bg-blue-500 px-2 text-[11px] text-white hover:bg-blue-600"
                                            onClick={() => {
                                              setExpandedCompanionByMember((prev) => ({
                                                ...prev,
                                                [member.id]: isExpanded ? null : index,
                                              }));
                                            }}
                                          >
                                            {isExpanded ? "Listo" : "Editar"}
                                          </Button>
                                          {!step2Locked ? (
                                            <Button
                                              size="sm"
                                              className="h-6 bg-red-500 px-2 text-[11px] text-white hover:bg-red-600"
                                              onClick={() => {
                                                const next = member.companions.filter((_, i) => i !== index);
                                                updateCompanions(member, next);
                                                setExpandedCompanionByMember((prev) => {
                                                  const current =
                                                    prev[member.id] === undefined ? 0 : prev[member.id];
                                                  if (next.length === 0) {
                                                    const { [member.id]: _, ...rest } = prev;
                                                    return rest;
                                                  }
                                                  const safeIndex =
                                                    current === null
                                                      ? 0
                                                      : current > index
                                                        ? current - 1
                                                        : Math.min(current, next.length - 1);
                                                  return { ...prev, [member.id]: safeIndex };
                                                });
                                              }}
                                            >
                                              Eliminar
                                            </Button>
                                          ) : null}
                                        </div>
                                      </div>
                                      {isExpanded ? (
                                        <div className="grid gap-3 md:grid-cols-2">
                                          <div className="space-y-1">
                                            <div className="text-xs font-semibold text-slate-600">
                                              Nombre completo
                                            </div>
                                            <input
                                              className={inputClassName}
                                              value={companion.fullName}
                                              disabled={step2Locked}
                                              onChange={(event) => {
                                                const next = [...member.companions];
                                                next[index] = { ...companion, fullName: event.target.value };
                                                updateCompanions(member, next);
                                              }}
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <div className="text-xs font-semibold text-slate-600">Identificacion</div>
                                            <input
                                              className={inputClassName}
                                              value={companion.identification}
                                              disabled={step2Locked}
                                              onChange={(event) => {
                                                const next = [...member.companions];
                                                next[index] = {
                                                  ...companion,
                                                  identification: event.target.value,
                                                };
                                                updateCompanions(member, next);
                                              }}
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <div className="text-xs font-semibold text-slate-600">Tipo ID</div>
                                            <select
                                              className={selectClassName}
                                              value={companion.identificationTypeId}
                                              disabled={step2Locked}
                                              onChange={(event) => {
                                                const next = [...member.companions];
                                                next[index] = {
                                                  ...companion,
                                                  identificationTypeId: event.target.value,
                                                };
                                                updateCompanions(member, next);
                                              }}
                                            >
                                              <option value="">Selecciona</option>
                                              {catalogOptions.identificationTypes.map((item) => (
                                                <option key={item.id} value={item.id}>
                                                  {item.name}
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                          <div className="space-y-1">
                                            <div className="text-xs font-semibold text-slate-600">Correo</div>
                                            <input
                                              className={inputClassName}
                                              value={companion.email}
                                              disabled={step2Locked}
                                              onChange={(event) => {
                                                const next = [...member.companions];
                                                next[index] = { ...companion, email: event.target.value };
                                                updateCompanions(member, next);
                                              }}
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <div className="text-xs font-semibold text-slate-600">Telefono</div>
                                            <input
                                              className={inputClassName}
                                              value={companion.phone}
                                              disabled={step2Locked}
                                              onChange={(event) => {
                                                const next = [...member.companions];
                                                next[index] = { ...companion, phone: event.target.value };
                                                updateCompanions(member, next);
                                              }}
                                            />
                                          </div>
                                          <div className="space-y-1 md:col-span-2">
                                            <div className="text-xs font-semibold text-slate-600">Direccion exacta</div>
                                            <input
                                              className={inputClassName}
                                              value={companion.address}
                                              disabled={step2Locked}
                                              onChange={(event) => {
                                                const next = [...member.companions];
                                                next[index] = { ...companion, address: event.target.value };
                                                updateCompanions(member, next);
                                              }}
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <div className="text-xs font-semibold text-slate-600">Estado civil</div>
                                            <select
                                              className={selectClassName}
                                              value={companion.maritalStatus}
                                              disabled={step2Locked}
                                              onChange={(event) => {
                                                const next = [...member.companions];
                                                next[index] = {
                                                  ...companion,
                                                  maritalStatus: event.target.value as MaritalStatus | "",
                                                };
                                                updateCompanions(member, next);
                                              }}
                                            >
                                              <option value="">Selecciona</option>
                                              {maritalOptions.map((item) => (
                                                <option key={item.value} value={item.value}>
                                                  {item.label}
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                          <div className="space-y-1">
                                            <div className="text-xs font-semibold text-slate-600">Nacionalidad</div>
                                            <select
                                              className={selectClassName}
                                              value={companion.nationalityId}
                                              disabled={step2Locked}
                                              onChange={(event) => {
                                                const next = [...member.companions];
                                                next[index] = { ...companion, nationalityId: event.target.value };
                                                updateCompanions(member, next);
                                              }}
                                            >
                                              <option value="">Selecciona</option>
                                              {catalogOptions.nationalities.map((item) => (
                                                <option key={item.id} value={item.id}>
                                                  {item.name}
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                          <div className="space-y-1 md:col-span-2">
                                            <div className="text-xs font-semibold text-slate-600">
                                              Profesion u ocupacion
                                            </div>
                                            <input
                                              className={inputClassName}
                                              value={companion.profession}
                                              disabled={step2Locked}
                                              onChange={(event) => {
                                                const next = [...member.companions];
                                                next[index] = { ...companion, profession: event.target.value };
                                                updateCompanions(member, next);
                                              }}
                                            />
                                          </div>
                                        </div>
                                      ) : null}
                                      <div className="flex items-center justify-end" />
                                    </div>
                                  );
                                })}
                                {!step2Locked ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      const next = [
                                        ...member.companions,
                                        {
                                          id: `${member.id}-companion-${Date.now()}`,
                                          fullName: "",
                                          identificationTypeId: "",
                                          identification: "",
                                          email: "",
                                          phone: "",
                                          address: "",
                                          maritalStatus: "" as MaritalStatus | "",
                                          nationalityId: "",
                                          profession: "",
                                          isMinor: false,
                                          wantsInsurance: null,
                                          insuranceId: "",
                                          hasOwnInsurance: null,
                                          emergencyContactName: "",
                                          emergencyContactPhone: "",
                                          specialSituations: "",
                                        },
                                      ];
                                      updateCompanions(member, next);
                                      setExpandedCompanionByMember((prev) => ({
                                        ...prev,
                                        [member.id]: next.length - 1,
                                      }));
                                    }}
                                  >
                                    Agregar acompanante
                                  </Button>
                                ) : null}
                              </div>
                            ) : null}

                            {member.hasCompanions ? (
                              <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs text-slate-600">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-slate-300"
                                    checked={member.companions.some((companion) => companion.isMinor)}
                                    disabled={step2Locked || member.companions.length === 0}
                                    onChange={(event) => {
                                      if (member.companions.length === 0) {
                                        return;
                                      }
                                      if (!event.target.checked) {
                                        const next = member.companions.map((companion) => ({
                                          ...companion,
                                          isMinor: false,
                                        }));
                                        updateCompanions(member, next);
                                        return;
                                      }
                                      const hasAny = member.companions.some((companion) => companion.isMinor);
                                      if (hasAny) {
                                        return;
                                      }
                                      const next = member.companions.map((companion, idx) => ({
                                        ...companion,
                                        isMinor: idx === 0,
                                      }));
                                      updateCompanions(member, next);
                                    }}
                                  />
                                  Hay menores de edad
                                </label>
                                {member.companions.some((companion) => companion.isMinor) ? (
                                  <div className="grid gap-2 md:grid-cols-2">
                                    {member.companions.map((companion, idx) => (
                                      <label
                                        key={companion.id}
                                        className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                                      >
                                        <input
                                          type="checkbox"
                                          className="h-4 w-4 rounded border-slate-300"
                                          checked={companion.isMinor}
                                          disabled={step2Locked}
                                          onChange={(event) => {
                                            const next = [...member.companions];
                                            next[idx] = {
                                              ...companion,
                                              isMinor: event.target.checked,
                                            };
                                            updateCompanions(member, next);
                                          }}
                                        />
                                        {companion.fullName || `Acompanante ${idx + 1}`}
                                      </label>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}

                            {member.hasMinorCompanions ? (
                              <div className="grid gap-3 md:grid-cols-3">
                                <div className="space-y-1">
                                  <div className="text-xs font-semibold text-slate-600">Patria potestad</div>
                                  <select
                                    className={selectClassName}
                                    value={
                                      member.hasParentalAuthority === null
                                        ? ""
                                        : member.hasParentalAuthority
                                          ? "true"
                                          : "false"
                                    }
                                    disabled={step2Locked}
                                    onChange={(event) => {
                                      if (event.target.value === "") {
                                        scheduleUpdate(
                                          member.id,
                                          {
                                            hasParentalAuthority: null,
                                            docFlags: {
                                              ...member.docFlags,
                                              minorPermit: false,
                                            },
                                            documents: member.documents.filter(
                                              (doc) => doc.type !== "MINOR_PERMIT",
                                            ),
                                          },
                                          `${member.id}:hasParentalAuthority`,
                                        );
                                        return;
                                      }
                                      const hasParentalAuthority = event.target.value === "true";
                                      scheduleUpdate(
                                        member.id,
                                        {
                                          hasParentalAuthority,
                                          docFlags: {
                                            ...member.docFlags,
                                            minorPermit: hasParentalAuthority
                                              ? false
                                              : member.docFlags.minorPermit,
                                          },
                                          documents: hasParentalAuthority
                                            ? member.documents.filter((doc) => doc.type !== "MINOR_PERMIT")
                                            : member.documents,
                                        },
                                        `${member.id}:hasParentalAuthority`,
                                      );
                                    }}
                                  >
                                    <option value="">Selecciona</option>
                                    <option value="true">Si</option>
                                    <option value="false">No</option>
                                  </select>
                                </div>
                              </div>
                            ) : null}

                            <div className="grid gap-3 md:grid-cols-3">
                              <div className="space-y-1">
                                <div className="text-xs font-semibold text-slate-600">Acomodacion</div>
                                <select
                                  className={selectClassName}
                                  value={member.accommodationType}
                                  disabled={step2Locked}
                                  onChange={(event) =>
                                    scheduleUpdate(
                                      member.id,
                                      { accommodationType: event.target.value as TripMember["accommodationType"] },
                                      `${member.id}:accommodationType`,
                                    )
                                  }
                                >
                                  <option value="">Selecciona</option>
                                  <option value="TWIN">Twin</option>
                                  <option value="INDIVIDUAL">Individual</option>
                                  <option value="MATRIMONIAL">Matrimonial</option>
                                  <option value="TRIPLE">Triple</option>
                                  <option value="CUADRUPLE">Cuadruple</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-md border border-slate-200 bg-white p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] text-white">3</span>
                              <span className="text-amber-600">Paso 3 · Seguro y emergencia</span>
                            </div>
                            {step3Locked ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setBlockLock(member.id, "step3", false)}
                              >
                                Editar
                              </Button>
                            ) : (
                              <Button size="sm" onClick={() => void saveBlock(member.id, "step3")}>
                                Guardar
                              </Button>
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                            <span>Completitud</span>
                            <span className={progress.step3.percent === 100 ? "text-emerald-600" : ""}>
                              {progress.step3.percent}%
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
                            <div
                              className={`h-1.5 rounded-full ${
                                progress.step3.percent === 100 ? "bg-emerald-500" : "bg-amber-400"
                              }`}
                              style={{ width: `${progress.step3.percent}%` }}
                            />
                          </div>
                          <div className={`mt-3 space-y-3 ${step3Locked ? lockedClass : ""}`}>
                            <div className="rounded-md border border-slate-200 bg-white p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-xs font-semibold text-slate-700">Titular</div>
                                <Button
                                  size="sm"
                                  className="h-6 bg-blue-500 px-2 text-[11px] text-white hover:bg-blue-600"
                                  onClick={() => {
                                    setExpandedInsuranceTitularByMember((prev) => ({
                                      ...prev,
                                      [member.id]: !((prev[member.id] ?? true) as boolean),
                                    }));
                                  }}
                                >
                                  {(expandedInsuranceTitularByMember[member.id] ?? true)
                                    ? "Listo"
                                    : "Editar"}
                                </Button>
                              </div>
                              {(expandedInsuranceTitularByMember[member.id] ?? true) ? (
                                <div className="mt-2 grid gap-3 md:grid-cols-3">
                                <div className="space-y-1">
                                  <div className="text-xs font-semibold text-slate-600">Desea seguro</div>
                                  <select
                                    className={selectClassName}
                                    value={
                                      member.wantsInsurance === null
                                        ? ""
                                        : member.wantsInsurance
                                          ? "YES"
                                          : "NO"
                                    }
                                    disabled={step3Locked}
                                    onChange={(event) => {
                                      const nextValue = event.target.value;
                                      const wantsInsurance = nextValue === "" ? null : nextValue === "YES";
                                      const nextDocs = wantsInsurance === false
                                        ? member.documents
                                        : member.documents.filter((doc) => doc.type !== "INSURANCE");
                                      scheduleUpdate(
                                        member.id,
                                        {
                                          wantsInsurance,
                                          hasOwnInsurance: wantsInsurance === false ? null : null,
                                          documents: nextDocs,
                                          docFlags: {
                                            ...member.docFlags,
                                            insurance: false,
                                          },
                                        },
                                        `${member.id}:wantsInsurance`,
                                      );
                                    }}
                                  >
                                    <option value="">Selecciona</option>
                                    <option value="YES">Si</option>
                                    <option value="NO">No</option>
                                  </select>
                                </div>
                                {member.wantsInsurance === true ? (
                                  <div className="space-y-1">
                                    <div className="text-xs font-semibold text-slate-600">Tipo de seguro</div>
                                    <select
                                      className={selectClassName}
                                      value={member.insuranceId}
                                      disabled={step3Locked}
                                      onChange={(event) =>
                                        handleSelectChange(
                                          member.id,
                                          { insuranceId: event.target.value },
                                          {
                                            catalogName: "insurances",
                                            memberId: member.id,
                                            field: "insuranceId",
                                          },
                                        )
                                      }
                                    >
                                      <option value="">Selecciona</option>
                                      {catalogOptions.insurances.map((item) => (
                                        <option key={item.id} value={item.id}>
                                          {item.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                ) : null}
                                {member.wantsInsurance === false ? (
                                  <>
                                    <div className="space-y-1">
                                      <div className="text-xs font-semibold text-slate-600">Tiene seguro propio</div>
                                      <select
                                        className={selectClassName}
                                        value={
                                          member.hasOwnInsurance === null
                                            ? ""
                                            : member.hasOwnInsurance
                                              ? "YES"
                                              : "NO"
                                        }
                                        disabled={step3Locked}
                                        onChange={(event) => {
                                          const nextValue = event.target.value;
                                          const hasOwnInsurance = nextValue === "" ? null : nextValue === "YES";
                                          const nextDocs = hasOwnInsurance
                                            ? member.documents
                                            : member.documents.filter((doc) => doc.type !== "INSURANCE");
                                          scheduleUpdate(
                                            member.id,
                                            {
                                              hasOwnInsurance,
                                              documents: nextDocs,
                                            },
                                            `${member.id}:hasOwnInsurance`,
                                          );
                                        }}
                                      >
                                        <option value="">Selecciona</option>
                                        <option value="YES">Si</option>
                                        <option value="NO">No</option>
                                      </select>
                                    </div>
                                    {member.hasOwnInsurance === false ? (
                                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 md:col-span-2">
                                        El cliente renuncia al seguro
                                      </div>
                                    ) : null}
                                  </>
                                ) : null}
                                <div className="space-y-1">
                                  <div className="text-xs font-semibold text-slate-600">Contacto de emergencia</div>
                                  <input
                                    className={inputClassName}
                                    value={member.emergencyContactName}
                                    disabled={step3Locked}
                                    onChange={(event) =>
                                      scheduleUpdate(
                                        member.id,
                                        { emergencyContactName: event.target.value },
                                        `${member.id}:emergencyContactName`,
                                      )
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <div className="text-xs font-semibold text-slate-600">Telefono emergencia</div>
                                  <input
                                    className={inputClassName}
                                    value={member.emergencyContactPhone}
                                    disabled={step3Locked}
                                    onChange={(event) =>
                                      scheduleUpdate(
                                        member.id,
                                        { emergencyContactPhone: event.target.value },
                                        `${member.id}:emergencyContactPhone`,
                                      )
                                    }
                                  />
                                </div>
                                <div className="space-y-1 md:col-span-3">
                                  <div className="text-xs font-semibold text-slate-600">Situaciones especiales</div>
                                  <textarea
                                    className="min-h-[60px] w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
                                    value={member.specialSituations}
                                    disabled={step3Locked}
                                    onChange={(event) =>
                                      scheduleUpdate(
                                        member.id,
                                        { specialSituations: event.target.value },
                                        `${member.id}:specialSituations`,
                                      )
                                    }
                                  />
                                </div>
                              </div>
                              ) : null}
                            </div>

                            {member.companions.map((companion, index) => {
                              const expandedIndex =
                                expandedInsuranceByMember[member.id] === undefined
                                  ? 0
                                  : expandedInsuranceByMember[member.id];
                              const isExpanded = expandedIndex === index;
                              return (
                                <div key={companion.id} className="rounded-md border border-slate-200 bg-white p-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="text-xs font-semibold text-slate-700">
                                      Acompanante {index + 1}
                                      {companion.fullName ? ` · ${companion.fullName}` : ""}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        className="h-6 bg-blue-500 px-2 text-[11px] text-white hover:bg-blue-600"
                                        onClick={() => {
                                          setExpandedInsuranceByMember((prev) => ({
                                            ...prev,
                                            [member.id]: isExpanded ? null : index,
                                          }));
                                        }}
                                      >
                                        {isExpanded ? "Listo" : "Editar"}
                                      </Button>
                                      {!step3Locked ? (
                                        <Button
                                          size="sm"
                                          className="h-6 bg-red-500 px-2 text-[11px] text-white hover:bg-red-600"
                                          onClick={() => {
                                            const next = member.companions.filter((_, i) => i !== index);
                                            updateCompanions(member, next);
                                            setExpandedInsuranceByMember((prev) => {
                                              const current =
                                                prev[member.id] === undefined ? 0 : prev[member.id];
                                              if (next.length === 0) {
                                                const { [member.id]: _, ...rest } = prev;
                                                return rest;
                                              }
                                              const safeIndex =
                                                current === null
                                                  ? 0
                                                  : current > index
                                                    ? current - 1
                                                    : Math.min(current, next.length - 1);
                                              return { ...prev, [member.id]: safeIndex };
                                            });
                                          }}
                                        >
                                          Eliminar
                                        </Button>
                                      ) : null}
                                    </div>
                                  </div>
                                  {isExpanded ? (
                                    <div className="mt-2 grid gap-3 md:grid-cols-3">
                                      <div className="space-y-1">
                                        <div className="text-xs font-semibold text-slate-600">Desea seguro</div>
                                        <select
                                          className={selectClassName}
                                          value={
                                            companion.wantsInsurance === null
                                              ? ""
                                              : companion.wantsInsurance
                                                ? "YES"
                                                : "NO"
                                          }
                                          disabled={step3Locked}
                                          onChange={(event) => {
                                            const nextValue = event.target.value;
                                            const wantsInsurance = nextValue === "" ? null : nextValue === "YES";
                                            const next = [...member.companions];
                                            next[index] = {
                                              ...companion,
                                              wantsInsurance,
                                              hasOwnInsurance: wantsInsurance === false ? null : null,
                                            };
                                            updateCompanions(member, next);
                                          }}
                                        >
                                          <option value="">Selecciona</option>
                                          <option value="YES">Si</option>
                                          <option value="NO">No</option>
                                        </select>
                                      </div>
                                      {companion.wantsInsurance === true ? (
                                        <div className="space-y-1">
                                          <div className="text-xs font-semibold text-slate-600">Tipo de seguro</div>
                                          <select
                                            className={selectClassName}
                                            value={companion.insuranceId}
                                            disabled={step3Locked}
                                            onChange={(event) => {
                                              const next = [...member.companions];
                                              next[index] = {
                                                ...companion,
                                                insuranceId: event.target.value,
                                              };
                                              updateCompanions(member, next);
                                            }}
                                          >
                                            <option value="">Selecciona</option>
                                            {catalogOptions.insurances.map((item) => (
                                              <option key={item.id} value={item.id}>
                                                {item.name}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      ) : null}
                                      {companion.wantsInsurance === false ? (
                                        <>
                                          <div className="space-y-1">
                                            <div className="text-xs font-semibold text-slate-600">Tiene seguro propio</div>
                                            <select
                                              className={selectClassName}
                                              value={
                                                companion.hasOwnInsurance === null
                                                  ? ""
                                                  : companion.hasOwnInsurance
                                                    ? "YES"
                                                    : "NO"
                                              }
                                              disabled={step3Locked}
                                              onChange={(event) => {
                                                const nextValue = event.target.value;
                                                const hasOwnInsurance = nextValue === "" ? null : nextValue === "YES";
                                                const next = [...member.companions];
                                                next[index] = {
                                                  ...companion,
                                                  hasOwnInsurance,
                                                };
                                                updateCompanions(member, next);
                                              }}
                                            >
                                              <option value="">Selecciona</option>
                                              <option value="YES">Si</option>
                                              <option value="NO">No</option>
                                            </select>
                                          </div>
                                          {companion.hasOwnInsurance === false ? (
                                            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 md:col-span-2">
                                              El cliente renuncia al seguro
                                            </div>
                                          ) : null}
                                        </>
                                      ) : null}
                                      <div className="space-y-1">
                                        <div className="text-xs font-semibold text-slate-600">Contacto de emergencia</div>
                                        <input
                                          className={inputClassName}
                                          value={companion.emergencyContactName}
                                          disabled={step3Locked}
                                          onChange={(event) => {
                                            const next = [...member.companions];
                                            next[index] = {
                                              ...companion,
                                              emergencyContactName: event.target.value,
                                            };
                                            updateCompanions(member, next);
                                          }}
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <div className="text-xs font-semibold text-slate-600">Telefono emergencia</div>
                                        <input
                                          className={inputClassName}
                                          value={companion.emergencyContactPhone}
                                          disabled={step3Locked}
                                          onChange={(event) => {
                                            const next = [...member.companions];
                                            next[index] = {
                                              ...companion,
                                              emergencyContactPhone: event.target.value,
                                            };
                                            updateCompanions(member, next);
                                          }}
                                        />
                                      </div>
                                      <div className="space-y-1 md:col-span-3">
                                        <div className="text-xs font-semibold text-slate-600">Situaciones especiales</div>
                                        <textarea
                                          className="min-h-[60px] w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
                                          value={companion.specialSituations}
                                          disabled={step3Locked}
                                          onChange={(event) => {
                                            const next = [...member.companions];
                                            next[index] = {
                                              ...companion,
                                              specialSituations: event.target.value,
                                            };
                                            updateCompanions(member, next);
                                          }}
                                        />
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="rounded-md border border-slate-200 bg-white p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] text-white">4</span>
                              <span className="text-sky-700">Paso 4 · Datos numericos</span>
                            </div>
                            {step4Locked ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setBlockLock(member.id, "step4", false)}
                              >
                                Editar
                              </Button>
                            ) : (
                              <Button size="sm" onClick={() => void saveBlock(member.id, "step4")}>
                                Guardar
                              </Button>
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                            <span>Completitud</span>
                            <span className={progress.step4.percent === 100 ? "text-emerald-600" : ""}>
                              {progress.step4.percent}%
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
                            <div
                              className={`h-1.5 rounded-full ${
                                progress.step4.percent === 100 ? "bg-emerald-500" : "bg-amber-400"
                              }`}
                              style={{ width: `${progress.step4.percent}%` }}
                            />
                          </div>
                          <div className={`mt-3 space-y-4 ${step4Locked ? lockedClass : ""}`}>
                            <div className="grid gap-3 md:grid-cols-1">
                              <div className="space-y-1">
                                <div className="text-xs font-semibold text-slate-600">Plazo para cuotas (meses)</div>
                                <input
                                  className={inputClassName}
                                  type="number"
                                  min={1}
                                  value={member.paymentPlanMonths === 0 ? "" : member.paymentPlanMonths ?? ""}
                                  disabled={step4Locked}
                                  onChange={(event) =>
                                    schedulePricingUpdate(
                                      member,
                                      {
                                        paymentPlanMonths:
                                          event.target.value === "" ? null : Number(event.target.value),
                                      },
                                      `${member.id}:paymentPlanMonths`,
                                    )
                                  }
                                />
                              </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-3">
                              <div className="space-y-1">
                                <div className="text-xs font-semibold text-slate-600">Precio paquete base (USD)</div>
                                <input
                                  className={inputClassName}
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={member.packageBasePrice === 0 ? "" : member.packageBasePrice ?? ""}
                                  disabled={step4Locked}
                                  onChange={(event) =>
                                    schedulePricingUpdate(
                                      member,
                                      {
                                        packageBasePrice:
                                          event.target.value === "" ? null : Number(event.target.value),
                                      },
                                      `${member.id}:packageBasePrice`,
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs font-semibold text-slate-600">Reserva minima por persona</div>
                                <input
                                  className={inputClassName}
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={
                                    member.reservationMinPerPerson === 0
                                      ? ""
                                      : member.reservationMinPerPerson ?? ""
                                  }
                                  disabled={step4Locked}
                                  onChange={(event) =>
                                    schedulePricingUpdate(
                                      member,
                                      {
                                        reservationMinPerPerson:
                                          event.target.value === "" ? null : Number(event.target.value),
                                      },
                                      `${member.id}:reservationMinPerPerson`,
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs font-semibold text-slate-600">Saldo total (USD)</div>
                                <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                                  USD {pricing.balanceTotal.toFixed(2)}
                                </div>
                              </div>
                            </div>

                            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                              <div className="grid gap-2 md:grid-cols-4">
                                <div>
                                  <div className="text-[11px]">Total paquete</div>
                                  <div className="text-sm font-semibold text-slate-900">
                                    USD {pricing.baseTotal.toFixed(2)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[11px]">Reserva por persona</div>
                                  <div className="text-sm font-semibold text-slate-900">
                                    USD {pricing.reservationPerPerson.toFixed(2)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[11px]">Reserva total</div>
                                  <div className="text-sm font-semibold text-slate-900">
                                    USD {pricing.reservationTotal.toFixed(2)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[11px]">Cuota mensual sobre saldo</div>
                                  <div className="text-sm font-semibold text-slate-900">
                                    USD {pricing.installmentAmount.toFixed(2)}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Los adicionales (upsells) no se suman al paquete ni al saldo y se gestionan como anexo independiente en enviados.
                            </p>
                          </div>
                        </div>

                        <div className="rounded-md border border-slate-200 bg-white p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] text-white">5</span>
                              <span className="text-violet-700">Paso 5 · Documentos</span>
                            </div>
                            {step5Locked ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setBlockLock(member.id, "step5", false)}
                              >
                                Editar
                              </Button>
                            ) : (
                              <Button size="sm" onClick={() => void saveBlock(member.id, "step5")}>
                                Guardar
                              </Button>
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                            <span>Completitud</span>
                            <span className={progress.step5.percent === 100 ? "text-emerald-600" : ""}>
                              {progress.step5.percent}%
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
                            <div
                              className={`h-1.5 rounded-full ${
                                progress.step5.percent === 100 ? "bg-emerald-500" : "bg-amber-400"
                              }`}
                              style={{ width: `${progress.step5.percent}%` }}
                            />
                          </div>
                          <div className={`mt-3 space-y-3 ${step5Locked ? lockedClass : ""}`}>
                            <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                              {(
                                [
                                  { key: "idCard", label: "Cedula", type: "ID_CARD" as DocumentType, enabled: true },
                                  { key: "passport", label: "Pasaporte", type: "PASSPORT" as DocumentType, enabled: true },
                                  {
                                    key: "insurance",
                                    label: "Seguro propio",
                                    type: "INSURANCE" as DocumentType,
                                    enabled:
                                      member.hasOwnInsurance === true ||
                                      member.companions.some((companion) => companion.hasOwnInsurance === true),
                                  },
                                  {
                                    key: "paymentProof",
                                    label: "Pagos",
                                    type: "PAYMENT_PROOF" as DocumentType,
                                    enabled: true,
                                  },
                                ]
                              ).map((item) => (
                                <label key={item.key} className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-slate-300"
                                    checked={member.docFlags[item.key as keyof typeof member.docFlags]}
                                    disabled={step5Locked || !item.enabled}
                                    onChange={(event) => {
                                      const checked = event.target.checked;
                                      const nextDocs = checked
                                        ? member.documents
                                        : member.documents.filter((doc) => doc.type !== item.type);
                                      scheduleUpdate(
                                        member.id,
                                        {
                                          docFlags: {
                                            ...member.docFlags,
                                            [item.key]: checked,
                                          },
                                          documents: nextDocs,
                                        },
                                        `${member.id}:docFlags:${item.key}`,
                                      );
                                    }}
                                  />
                                  <span
                                    className={
                                      !item.enabled
                                        ? "text-slate-300"
                                        : getDocsByType(member, item.type).length > 0
                                          ? "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700"
                                          : "rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700"
                                    }
                                  >
                                    {item.label}
                                  </span>
                                </label>
                              ))}
                            </div>

                            {(
                              [
                                { key: "idCard", label: "Cedula", type: "ID_CARD" as DocumentType },
                                { key: "passport", label: "Pasaporte", type: "PASSPORT" as DocumentType },
                                { key: "insurance", label: "Seguro propio", type: "INSURANCE" as DocumentType },
                                { key: "paymentProof", label: "Pagos", type: "PAYMENT_PROOF" as DocumentType },
                              ]
                            ).map((item) => {
                              const enabled = member.docFlags[item.key as keyof typeof member.docFlags];
                              if (!enabled) {
                                return null;
                              }
                              const ownerOptions = [
                                "Titular",
                                ...member.companions
                                  .map((companion) => companion.fullName)
                                  .filter((name) => name.trim().length > 0),
                              ];
                              const docs = getDocsByType(member, item.type);
                              return (
                                <div key={item.key} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                                  <div className="text-xs font-semibold text-slate-700">{item.label}</div>
                                  <div className="mt-2 grid gap-2 md:grid-cols-3">
                                    <div className="space-y-1">
                                      <div className="text-[11px] text-slate-500">Pertenece a</div>
                                      <select
                                        className={selectClassName}
                                        value={getOwnerValue(member.id, item.type)}
                                        disabled={step5Locked}
                                        onChange={(event) =>
                                          setOwnerValue(member.id, item.type, event.target.value)
                                        }
                                      >
                                        {ownerOptions.map((option) => (
                                          <option key={option} value={option}>
                                            {option}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    {item.key === "paymentProof" ? (
                                      <div className="space-y-1">
                                        <div className="text-[11px] text-slate-500">Concepto</div>
                                        <select
                                          className={selectClassName}
                                          value={getConceptValue(member.id, item.type)}
                                          disabled={step5Locked}
                                          onChange={(event) =>
                                            setConceptValue(member.id, item.type, event.target.value)
                                          }
                                        >
                                          {paymentConceptOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                              {option.label}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    ) : null}
                                    {item.key === "paymentProof" &&
                                    getConceptValue(member.id, item.type) === "OTHER" ? (
                                      <div className="space-y-1 md:col-span-2">
                                        <div className="text-[11px] text-slate-500">Detalle concepto</div>
                                        <input
                                          className={inputClassName}
                                          value={getConceptOtherValue(member.id, item.type)}
                                          disabled={step5Locked}
                                          onChange={(event) =>
                                            setConceptOtherValue(member.id, item.type, event.target.value)
                                          }
                                        />
                                      </div>
                                    ) : null}
                                    <div className="space-y-1 md:col-span-2">
                                      <div className="text-[11px] text-slate-500">Adjuntar documentos</div>
                                      <input
                                        className={inputClassName}
                                        type="file"
                                        multiple
                                        disabled={step5Locked}
                                        onChange={(event) => {
                                          const nextDocs = addDocuments(
                                            member,
                                            item.type,
                                            getOwnerValue(member.id, item.type),
                                            event.target.files,
                                            item.key === "paymentProof"
                                              ? {
                                                  concept: getConceptValue(member.id, item.type),
                                                  conceptOther: getConceptOtherValue(member.id, item.type),
                                                }
                                              : undefined,
                                          );
                                          if (nextDocs.length !== member.documents.length) {
                                            scheduleUpdate(
                                              member.id,
                                              { documents: nextDocs },
                                              `${member.id}:documents:${item.key}`,
                                            );
                                          }
                                        }}
                                      />
                                    </div>
                                  </div>
                                  {docs.length > 0 ? (
                                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600">
                                      {docs.map((doc) => (
                                        <span key={doc.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-0.5">
                                          {doc.fileName} · {doc.ownerName}
                                          {formatDocConcept(doc) ? ` · ${formatDocConcept(doc)}` : ""}
                                          {!step5Locked ? (
                                            <button
                                              type="button"
                                              className="text-slate-500 hover:text-slate-900"
                                              onClick={() =>
                                                scheduleUpdate(
                                                  member.id,
                                                  { documents: removeDocument(member, doc.id) },
                                                  `${member.id}:documents:remove:${doc.id}`,
                                                )
                                              }
                                            >
                                              x
                                            </button>
                                          ) : null}
                                        </span>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="rounded-md border border-slate-200 bg-white p-3">
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] text-white">6</span>
                            <span>Paso 6 · Enviar a contratos</span>
                          </div>
                          <div className="mt-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="text-slate-600">
                                {progress.overall.filled} / {progress.overall.total} completos
                              </div>
                              <div className="text-slate-500">
                                Estado: {getContractsStatusLabel(member)}
                              </div>
                            </div>
                            {missingItems.length > 0 ? (
                              <div className="mt-2 text-[11px] text-slate-500">
                                Faltan: {missingItems.join(", ")}
                              </div>
                            ) : null}
                            <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                              <div
                                className="h-2 rounded-full bg-emerald-500"
                                style={{ width: `${progress.overall.percent}%` }}
                              />
                            </div>
                            <div className="mt-3 flex flex-wrap justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  void handleSelectChange(member.id, {
                                    isDraft: true,
                                  }).then(() => {
                                    setExpandedRows((prev) => ({ ...prev, [member.id]: false }));
                                  })
                                }
                              >
                                Guardar borrador
                              </Button>
                              <Button
                                size="sm"
                                disabled={!canSend}
                                className={
                                  !canSend
                                    ? "cursor-not-allowed bg-slate-200 text-slate-400 hover:bg-slate-200"
                                    : ""
                                }
                                onClick={() =>
                                  void handleSelectChange(member.id, {
                                    contractsStatus: ContractsStatus.SENT,
                                    contractsSentByUserId: currentUser.id,
                                    contractsSentAt: new Date().toISOString(),
                                    billingStatus: BillingStatus.SENT,
                                    billingSentByUserId: currentUser.id,
                                    billingSentAt: new Date().toISOString(),
                                    billingStatusUpdatedAt: new Date().toISOString(),
                                    isDraft: false,
                                  })
                                }
                              >
                                Enviar a contratos
                              </Button>
                            </div>
                            {!canSend ? (
                              <div className="mt-2 text-[11px] text-rose-600">
                                No se puede enviar hasta completar todos los pasos.
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-[900px] w-full border-collapse text-xs">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2">Fecha envio</th>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Identificacion</th>
                  <th className="px-3 py-2">Correo</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {agentSentMembers.length === 0 ? (
                  <tr className="border-t border-slate-100">
                    <td className="px-3 py-6 text-center text-sm text-slate-500" colSpan={6}>
                      Sin enviados
                    </td>
                  </tr>
                ) : (
                  agentSentMembers.map((member) => (
                    <tr key={member.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-600">
                        {member.contractsSentAt ? formatDate(member.contractsSentAt) : "-"}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="font-medium text-cyan-700 hover:underline"
                          onClick={() => openSentSummaryDialog(member)}
                        >
                          {member.fullName}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{member.identification}</td>
                      <td className="px-3 py-2 text-slate-600">{member.email}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {getContractsStatusLabel(member)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openModificationDialog(member)}
                          >
                            Solicitar modificacion
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openUpsellDialog(member)}
                          >
                            Adicionales
                          </Button>
                          {canManageClients && member.clientId ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => router.push(`/clients?clientId=${member.clientId}`)}
                            >
                              Ver cliente
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
              Solicitudes de modificacion enviadas
            </div>
            <table className="min-w-[900px] w-full border-collapse text-xs">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Pasajero</th>
                  <th className="px-3 py-2">Paso</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Enviado por</th>
                  <th className="px-3 py-2">Procesado por</th>
                  <th className="px-3 py-2">Procesado el</th>
                  {isAdmin ? <th className="px-3 py-2">Asignado a</th> : null}
                </tr>
              </thead>
              <tbody>
                {tripModRequests.length === 0 ? (
                  <tr className="border-t border-slate-100">
                    <td
                      className="px-3 py-6 text-center text-sm text-slate-500"
                      colSpan={isAdmin ? 8 : 7}
                    >
                      Sin solicitudes
                    </td>
                  </tr>
                ) : (
                  tripModRequests.map((request) => {
                    const member = members.find((item) => item.id === request.memberId);
                    return (
                      <tr key={request.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-600">{formatDate(request.createdAt)}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {member?.fullName ?? "-"}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {getModificationStepLabel(request.step)}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {getModificationStatusLabel(request.status)}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {userById.get(request.requestedByUserId)?.name ?? "-"}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {userById.get(request.processedByUserId ?? "")?.name ?? "-"}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {request.processedAt ? formatDate(request.processedAt) : "-"}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {isSupervisor ? (
                            <select
                              className={selectClassName}
                              value={request.assignedToUserId ?? ""}
                              onChange={(event) =>
                                void updateModification(request.id, {
                                  assignedToUserId: event.target.value,
                                })
                              }
                            >
                              <option value="">Sin asignar</option>
                              {agentUsers.map((user) => (
                                <option key={user.id} value={user.id}>
                                  {user.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            userById.get(request.assignedToUserId ?? "")?.name ?? "-"
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  ) : (
    <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-[1200px] w-full border-collapse text-xs">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-3 py-2">Nombre</th>
            <th className="px-3 py-2">Identificacion</th>
            <th className="px-3 py-2">Tipo ID</th>
            <th className="px-3 py-2">Telefono</th>
            <th className="px-3 py-2">Reserva</th>
            <th className="px-3 py-2">Asientos</th>
            <th className="px-3 py-2">Equipaje</th>
            <th className="px-3 py-2">Aerolinea</th>
            <th className="px-3 py-2">Hospedaje</th>
            <th className="px-3 py-2">Acomodacion</th>
            <th className="px-3 py-2">Seguro</th>
            <th className="px-3 py-2">Nacionalidad</th>
            <th className="px-3 py-2">Contrato</th>
            <th className="px-3 py-2">Docs</th>
            <th className="px-3 py-2">Permiso menor</th>
            <th className="px-3 py-2">Pasaporte</th>
            <th className="px-3 py-2">Itinerario</th>
            <th className="px-3 py-2">Ingresado por</th>
            <th className="px-3 py-2">Asignado a</th>
            <th className="px-3 py-2">Detalles</th>
          </tr>
        </thead>
        <tbody>
          {filteredMembers.map((member) => {
            const rowPending = isPending(member);
            return (
              <tr
                key={member.id}
                ref={(node) => {
                  rowRefs.current[member.id] = node;
                }}
                className={`border-t border-slate-100 ${
                  rowPending ? "bg-amber-50" : ""
                } ${
                  focusedMemberId === member.id ? "outline outline-2 outline-slate-900" : ""
                }`}
              >
                <td className="px-3 py-2 font-medium text-slate-900">{member.fullName}</td>
                <td className="px-3 py-2">
                  <input
                    className={inputClassName}
                    value={member.identification}
                    onChange={(event) =>
                      scheduleUpdate(
                        member.id,
                        { identification: event.target.value },
                        `${member.id}:identification`,
                      )
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    className={selectClassName}
                    value={member.identificationTypeId}
                    onChange={(event) =>
                      handleSelectChange(
                        member.id,
                        { identificationTypeId: event.target.value },
                        {
                          catalogName: "identificationTypes",
                          memberId: member.id,
                          field: "identificationTypeId",
                        },
                      )
                    }
                  >
                    {catalogOptions.identificationTypes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    className={inputClassName}
                    value={member.phone}
                    onChange={(event) =>
                      scheduleUpdate(
                        member.id,
                        { phone: event.target.value },
                        `${member.id}:phone`,
                      )
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                    {member.reservationCode}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <input
                    className={inputClassName}
                    type="number"
                    min={0}
                    value={member.seats}
                    onChange={(event) =>
                      scheduleUpdate(
                        member.id,
                        { seats: Number(event.target.value || 0) },
                        `${member.id}:seats`,
                      )
                    }
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={member.luggage}
                    onChange={(event) =>
                      scheduleUpdate(
                        member.id,
                        { luggage: event.target.checked },
                        `${member.id}:luggage`,
                      )
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    className={selectClassName}
                    value={member.airlineId}
                    onChange={(event) =>
                      handleSelectChange(
                        member.id,
                        { airlineId: event.target.value },
                        { catalogName: "airlines", memberId: member.id, field: "airlineId" },
                      )
                    }
                  >
                    {catalogOptions.airlines.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    className={selectClassName}
                    value={member.lodgingTypeId}
                    onChange={(event) =>
                      handleSelectChange(
                        member.id,
                        { lodgingTypeId: event.target.value },
                        {
                          catalogName: "lodgingTypes",
                          memberId: member.id,
                          field: "lodgingTypeId",
                        },
                      )
                    }
                  >
                    {catalogOptions.lodgingTypes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    className={selectClassName}
                    value={member.accommodationId}
                    onChange={(event) =>
                      handleSelectChange(
                        member.id,
                        { accommodationId: event.target.value },
                        {
                          catalogName: "accommodations",
                          memberId: member.id,
                          field: "accommodationId",
                        },
                      )
                    }
                  >
                    {catalogOptions.accommodations.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    className={selectClassName}
                    value={member.insuranceId}
                    onChange={(event) =>
                      handleSelectChange(
                        member.id,
                        { insuranceId: event.target.value },
                        {
                          catalogName: "insurances",
                          memberId: member.id,
                          field: "insuranceId",
                        },
                      )
                    }
                  >
                    {catalogOptions.insurances.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    className={selectClassName}
                    value={member.nationalityId}
                    onChange={(event) =>
                      handleSelectChange(
                        member.id,
                        { nationalityId: event.target.value },
                        {
                          catalogName: "nationalities",
                          memberId: member.id,
                          field: "nationalityId",
                        },
                      )
                    }
                  >
                    {catalogOptions.nationalities.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    className={selectClassName}
                    value={member.contractStatus}
                    onChange={(event) =>
                      handleSelectChange(member.id, {
                        contractStatus: event.target.value as ContractStatus,
                      })
                    }
                  >
                    {statusOptions.contractStatus.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    className={selectClassName}
                    value={member.docsStatus}
                    onChange={(event) =>
                      handleSelectChange(member.id, {
                        docsStatus: event.target.value as DocsStatus,
                      })
                    }
                  >
                    {statusOptions.docsStatus.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  {requiresMinorPermit(member) ? (
                    <div className="space-y-2">
                      <div
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          getDocsByType(member, "MINOR_PERMIT").length > 0
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {getDocsByType(member, "MINOR_PERMIT").length > 0
                          ? `Cargado (${getDocsByType(member, "MINOR_PERMIT").length})`
                          : "Pendiente"}
                      </div>
                      <input
                        className={inputClassName}
                        type="file"
                        multiple
                        onChange={(event) => {
                          const nextDocs = addDocuments(
                            member,
                            "MINOR_PERMIT",
                            "Acompanante menor",
                            event.target.files,
                          );
                          if (nextDocs.length !== member.documents.length) {
                            scheduleUpdate(
                              member.id,
                              {
                                documents: nextDocs,
                                docFlags: {
                                  ...member.docFlags,
                                  minorPermit: getDocsByType(
                                    { ...member, documents: nextDocs },
                                    "MINOR_PERMIT",
                                  ).length > 0,
                                },
                              },
                              `${member.id}:documents:minorPermit`,
                            );
                          }
                        }}
                      />
                      {getDocsByType(member, "MINOR_PERMIT").length > 0 ? (
                        <div className="flex flex-wrap gap-1 text-[11px] text-slate-600">
                          {getDocsByType(member, "MINOR_PERMIT").map((doc) => (
                            <span
                              key={doc.id}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5"
                            >
                              {doc.fileName}
                              <button
                                type="button"
                                className="text-slate-500 hover:text-slate-900"
                                onClick={() => {
                                  const nextDocs = removeDocument(member, doc.id);
                                  scheduleUpdate(
                                    member.id,
                                    {
                                      documents: nextDocs,
                                      docFlags: {
                                        ...member.docFlags,
                                        minorPermit: getDocsByType(
                                          { ...member, documents: nextDocs },
                                          "MINOR_PERMIT",
                                        ).length > 0,
                                      },
                                    },
                                    `${member.id}:documents:minorPermit:remove:${doc.id}`,
                                  );
                                }}
                              >
                                x
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-slate-400">No aplica</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <select
                    className={selectClassName}
                    value={member.passportStatus}
                    onChange={(event) =>
                      handleSelectChange(member.id, {
                        passportStatus: event.target.value as PassportStatus,
                      })
                    }
                  >
                    {statusOptions.passportStatus.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    className={selectClassName}
                    value={member.itineraryStatus}
                    onChange={(event) =>
                      handleSelectChange(member.id, {
                        itineraryStatus: event.target.value as ItineraryStatus,
                      })
                    }
                  >
                    {statusOptions.itineraryStatus.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {userById.get(member.enteredByUserId)?.name ?? "-"}
                </td>
                {isAdmin ? (
                  <td className="px-3 py-2">
                    <select
                      className={selectClassName}
                      value={member.assignedToUserId}
                      onChange={(event) =>
                        handleSelectChange(member.id, {
                          assignedToUserId: event.target.value,
                        })
                      }
                    >
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </td>
                ) : null}
                <td className="px-3 py-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDetailsDraft(member.details ?? "");
                      setDetailsDialog({ open: true, member });
                    }}
                  >
                    {member.details ? "Editar" : "Agregar"}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderModificationStep = (draft: TripMember) => {
    const destinationLabel = `${tripName} · ${tripDateFrom} - ${tripDateTo}`;

    if (modStep === "STEP1") {
      return (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-600">Destino contratado</div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                {destinationLabel}
              </div>
            </div>
            <div className="space-y-1 md:col-span-2">
              <div className="text-xs font-semibold text-slate-600">Direccion exacta</div>
              <input
                className={inputClassName}
                value={draft.address}
                onChange={(event) => updateDraft({ address: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-600">Estado civil</div>
              <select
                className={selectClassName}
                value={draft.maritalStatus}
                onChange={(event) =>
                  handleDraftSelectChange({
                    maritalStatus: event.target.value as MaritalStatus | "",
                  })
                }
              >
                <option value="">Selecciona</option>
                {maritalOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-600">Nacionalidad</div>
              <select
                className={selectClassName}
                value={draft.nationalityId}
                onChange={(event) =>
                  handleDraftSelectChange(
                    { nationalityId: event.target.value },
                    {
                      catalogName: "nationalities",
                      field: "nationalityId",
                    },
                  )
                }
              >
                <option value="">Selecciona</option>
                {catalogOptions.nationalities.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-600">Profesion u ocupacion</div>
              <input
                className={inputClassName}
                value={draft.profession}
                onChange={(event) => updateDraft({ profession: event.target.value })}
              />
            </div>
          </div>
        </div>
      );
    }

    if (modStep === "STEP3") {
      return (
        <div className="space-y-3">
          <div className="rounded-md border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-slate-700">Titular</div>
              <Button
                size="sm"
                className="h-6 bg-blue-500 px-2 text-[11px] text-white hover:bg-blue-600"
                onClick={() => setModExpandedInsuranceTitular((prev) => !prev)}
              >
                {modExpandedInsuranceTitular ? "Listo" : "Editar"}
              </Button>
            </div>
            {modExpandedInsuranceTitular ? (
              <div className="mt-2 grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-600">Desea seguro</div>
                  <select
                    className={selectClassName}
                    value={
                      draft.wantsInsurance === null
                        ? ""
                        : draft.wantsInsurance
                          ? "YES"
                          : "NO"
                    }
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      const wantsInsurance = nextValue === "" ? null : nextValue === "YES";
                      const nextDocs = wantsInsurance === false
                        ? draft.documents
                        : draft.documents.filter((doc) => doc.type !== "INSURANCE");
                      updateDraft({
                        wantsInsurance,
                        hasOwnInsurance: wantsInsurance === false ? null : null,
                        documents: nextDocs,
                        docFlags: {
                          ...draft.docFlags,
                          insurance: false,
                        },
                      });
                    }}
                  >
                    <option value="">Selecciona</option>
                    <option value="YES">Si</option>
                    <option value="NO">No</option>
                  </select>
                </div>
                {draft.wantsInsurance === true ? (
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-600">Tipo de seguro</div>
                    <select
                      className={selectClassName}
                      value={draft.insuranceId}
                      onChange={(event) =>
                        handleDraftSelectChange(
                          { insuranceId: event.target.value },
                          {
                            catalogName: "insurances",
                            field: "insuranceId",
                          },
                        )
                      }
                    >
                      <option value="">Selecciona</option>
                      {catalogOptions.insurances.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {draft.wantsInsurance === false ? (
                  <>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-600">Tiene seguro propio</div>
                      <select
                        className={selectClassName}
                        value={
                          draft.hasOwnInsurance === null
                            ? ""
                            : draft.hasOwnInsurance
                              ? "YES"
                              : "NO"
                        }
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          const hasOwnInsurance = nextValue === "" ? null : nextValue === "YES";
                          const nextDocs = hasOwnInsurance
                            ? draft.documents
                            : draft.documents.filter((doc) => doc.type !== "INSURANCE");
                                      updateDraft({
                                        hasOwnInsurance,
                                        documents: nextDocs,
                                      });
                        }}
                      >
                        <option value="">Selecciona</option>
                        <option value="YES">Si</option>
                        <option value="NO">No</option>
                      </select>
                    </div>
                    {draft.hasOwnInsurance === false ? (
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 md:col-span-2">
                        El cliente renuncia al seguro
                      </div>
                    ) : null}
                  </>
                ) : null}
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-600">Contacto de emergencia</div>
                  <input
                    className={inputClassName}
                    value={draft.emergencyContactName}
                    onChange={(event) => updateDraft({ emergencyContactName: event.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-600">Telefono emergencia</div>
                  <input
                    className={inputClassName}
                    value={draft.emergencyContactPhone}
                    onChange={(event) => updateDraft({ emergencyContactPhone: event.target.value })}
                  />
                </div>
                <div className="space-y-1 md:col-span-3">
                  <div className="text-xs font-semibold text-slate-600">Situaciones especiales</div>
                  <textarea
                    className="min-h-[60px] w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
                    value={draft.specialSituations}
                    onChange={(event) => updateDraft({ specialSituations: event.target.value })}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {draft.companions.map((companion, index) => {
            const isExpanded = modExpandedInsuranceIndex === index;
            return (
              <div key={companion.id} className="rounded-md border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-700">
                    Acompanante {index + 1}
                    {companion.fullName ? ` · ${companion.fullName}` : ""}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="h-6 bg-blue-500 px-2 text-[11px] text-white hover:bg-blue-600"
                      onClick={() => {
                        setModExpandedInsuranceIndex((prev) => (prev === index ? null : index));
                      }}
                    >
                      {isExpanded ? "Listo" : "Editar"}
                    </Button>
                    <Button
                      size="sm"
                      className="h-6 bg-red-500 px-2 text-[11px] text-white hover:bg-red-600"
                      onClick={() => {
                        const next = draft.companions.filter((_, i) => i !== index);
                        updateCompanionsDraft(next);
                        if (next.length === 0) {
                          setModExpandedInsuranceIndex(0);
                          return;
                        }
                        setModExpandedInsuranceIndex((prev) =>
                          prev === null
                            ? 0
                            : prev > index
                              ? prev - 1
                              : Math.min(prev, next.length - 1),
                        );
                      }}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
                {isExpanded ? (
                  <div className="mt-2 grid gap-3 md:grid-cols-3">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-600">Desea seguro</div>
                      <select
                        className={selectClassName}
                        value={
                          companion.wantsInsurance === null
                            ? ""
                            : companion.wantsInsurance
                              ? "YES"
                              : "NO"
                        }
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          const wantsInsurance = nextValue === "" ? null : nextValue === "YES";
                          const next = [...draft.companions];
                          next[index] = {
                            ...companion,
                            wantsInsurance,
                            hasOwnInsurance: wantsInsurance === false ? null : null,
                          };
                          updateCompanionsDraft(next);
                        }}
                      >
                        <option value="">Selecciona</option>
                        <option value="YES">Si</option>
                        <option value="NO">No</option>
                      </select>
                    </div>
                    {companion.wantsInsurance === true ? (
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-slate-600">Tipo de seguro</div>
                        <select
                          className={selectClassName}
                          value={companion.insuranceId}
                          onChange={(event) => {
                            const next = [...draft.companions];
                            next[index] = {
                              ...companion,
                              insuranceId: event.target.value,
                            };
                            updateCompanionsDraft(next);
                          }}
                        >
                          <option value="">Selecciona</option>
                          {catalogOptions.insurances.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    {companion.wantsInsurance === false ? (
                      <>
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-slate-600">Tiene seguro propio</div>
                          <select
                            className={selectClassName}
                            value={
                              companion.hasOwnInsurance === null
                                ? ""
                                : companion.hasOwnInsurance
                                  ? "YES"
                                  : "NO"
                            }
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              const hasOwnInsurance = nextValue === "" ? null : nextValue === "YES";
                              const next = [...draft.companions];
                              next[index] = {
                                ...companion,
                                hasOwnInsurance,
                              };
                              updateCompanionsDraft(next);
                            }}
                          >
                            <option value="">Selecciona</option>
                            <option value="YES">Si</option>
                            <option value="NO">No</option>
                          </select>
                        </div>
                        {companion.hasOwnInsurance === false ? (
                          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 md:col-span-2">
                            El cliente renuncia al seguro
                          </div>
                        ) : null}
                      </>
                    ) : null}
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-600">Contacto de emergencia</div>
                      <input
                        className={inputClassName}
                        value={companion.emergencyContactName}
                        onChange={(event) => {
                          const next = [...draft.companions];
                          next[index] = {
                            ...companion,
                            emergencyContactName: event.target.value,
                          };
                          updateCompanionsDraft(next);
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-600">Telefono emergencia</div>
                      <input
                        className={inputClassName}
                        value={companion.emergencyContactPhone}
                        onChange={(event) => {
                          const next = [...draft.companions];
                          next[index] = {
                            ...companion,
                            emergencyContactPhone: event.target.value,
                          };
                          updateCompanionsDraft(next);
                        }}
                      />
                    </div>
                    <div className="space-y-1 md:col-span-3">
                      <div className="text-xs font-semibold text-slate-600">Situaciones especiales</div>
                      <textarea
                        className="min-h-[60px] w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
                        value={companion.specialSituations}
                        onChange={(event) => {
                          const next = [...draft.companions];
                          next[index] = {
                            ...companion,
                            specialSituations: event.target.value,
                          };
                          updateCompanionsDraft(next);
                        }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      );
    }

    if (modStep === "STEP2") {
      return (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-600">Acompanantes</div>
              <select
                className={selectClassName}
                value={
                  draft.hasCompanions === null
                    ? ""
                    : draft.hasCompanions
                      ? "true"
                      : "false"
                }
                onChange={(event) => {
                  const hasCompanions = event.target.value === "true";
                  if (event.target.value === "") {
                    updateDraft({
                      hasCompanions: null,
                      companions: [],
                      hasMinorCompanions: false,
                      hasParentalAuthority: null,
                      docFlags: { ...draft.docFlags, minorPermit: false },
                      documents: draft.documents.filter((doc) => doc.type !== "MINOR_PERMIT"),
                    });
                    setModExpandedCompanionIndex(0);
                    return;
                  }
                  if (!hasCompanions) {
                    updateDraft({
                      hasCompanions: false,
                      companions: [],
                      hasMinorCompanions: false,
                      hasParentalAuthority: null,
                      docFlags: { ...draft.docFlags, minorPermit: false },
                      documents: draft.documents.filter((doc) => doc.type !== "MINOR_PERMIT"),
                    });
                    setModExpandedCompanionIndex(0);
                    return;
                  }
                  updateDraft({ hasCompanions: true });
                  setModExpandedCompanionIndex(0);
                }}
              >
                <option value="">Selecciona</option>
                <option value="true">Si</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>

          {draft.hasCompanions ? (
            <div className="space-y-2">
              {draft.companions.map((companion, index) => {
                const isExpanded = modExpandedCompanionIndex === index;
                return (
                  <div
                    key={companion.id}
                    className="space-y-3 rounded-md border border-slate-200 bg-white p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-slate-700">
                        <span className="inline-flex items-center rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-900">
                          Acompanante {index + 1}
                        </span>
                        {companion.fullName ? ` · ${companion.fullName}` : ""}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="h-6 bg-blue-500 px-2 text-[11px] text-white hover:bg-blue-600"
                          onClick={() => {
                            setModExpandedCompanionIndex((prev) => (prev === index ? null : index));
                          }}
                        >
                          {isExpanded ? "Listo" : "Editar"}
                        </Button>
                        <Button
                          size="sm"
                          className="h-6 bg-red-500 px-2 text-[11px] text-white hover:bg-red-600"
                          onClick={() => {
                            const next = draft.companions.filter((_, i) => i !== index);
                            updateCompanionsDraft(next);
                            if (next.length === 0) {
                              setModExpandedCompanionIndex(0);
                              return;
                            }
                            setModExpandedCompanionIndex((prev) =>
                              prev === null
                                ? 0
                                : prev > index
                                  ? prev - 1
                                  : Math.min(prev, next.length - 1),
                            );
                          }}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </div>
                    {isExpanded ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-slate-600">Nombre completo</div>
                          <input
                            className={inputClassName}
                            value={companion.fullName}
                            onChange={(event) => {
                              const next = [...draft.companions];
                              next[index] = { ...companion, fullName: event.target.value };
                              updateCompanionsDraft(next);
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-slate-600">Identificacion</div>
                          <input
                            className={inputClassName}
                            value={companion.identification}
                            onChange={(event) => {
                              const next = [...draft.companions];
                              next[index] = { ...companion, identification: event.target.value };
                              updateCompanionsDraft(next);
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-slate-600">Tipo ID</div>
                          <select
                            className={selectClassName}
                            value={companion.identificationTypeId}
                            onChange={(event) => {
                              const next = [...draft.companions];
                              next[index] = { ...companion, identificationTypeId: event.target.value };
                              updateCompanionsDraft(next);
                            }}
                          >
                            <option value="">Selecciona</option>
                            {catalogOptions.identificationTypes.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-slate-600">Correo</div>
                          <input
                            className={inputClassName}
                            value={companion.email}
                            onChange={(event) => {
                              const next = [...draft.companions];
                              next[index] = { ...companion, email: event.target.value };
                              updateCompanionsDraft(next);
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-slate-600">Telefono</div>
                          <input
                            className={inputClassName}
                            value={companion.phone}
                            onChange={(event) => {
                              const next = [...draft.companions];
                              next[index] = { ...companion, phone: event.target.value };
                              updateCompanionsDraft(next);
                            }}
                          />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <div className="text-xs font-semibold text-slate-600">Direccion exacta</div>
                          <input
                            className={inputClassName}
                            value={companion.address}
                            onChange={(event) => {
                              const next = [...draft.companions];
                              next[index] = { ...companion, address: event.target.value };
                              updateCompanionsDraft(next);
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-slate-600">Estado civil</div>
                          <select
                            className={selectClassName}
                            value={companion.maritalStatus}
                            onChange={(event) => {
                              const next = [...draft.companions];
                              next[index] = {
                                ...companion,
                                maritalStatus: event.target.value as MaritalStatus | "",
                              };
                              updateCompanionsDraft(next);
                            }}
                          >
                            <option value="">Selecciona</option>
                            {maritalOptions.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-slate-600">Nacionalidad</div>
                          <select
                            className={selectClassName}
                            value={companion.nationalityId}
                            onChange={(event) => {
                              const next = [...draft.companions];
                              next[index] = { ...companion, nationalityId: event.target.value };
                              updateCompanionsDraft(next);
                            }}
                          >
                            <option value="">Selecciona</option>
                            {catalogOptions.nationalities.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <div className="text-xs font-semibold text-slate-600">Profesion u ocupacion</div>
                          <input
                            className={inputClassName}
                            value={companion.profession}
                            onChange={(event) => {
                              const next = [...draft.companions];
                              next[index] = { ...companion, profession: event.target.value };
                              updateCompanionsDraft(next);
                            }}
                          />
                        </div>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-end" />
                  </div>
                );
              })}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const next = [
                    ...draft.companions,
                    {
                      id: `${draft.id}-companion-${Date.now()}`,
                      fullName: "",
                      identificationTypeId: "",
                      identification: "",
                      email: "",
                      phone: "",
                      address: "",
                      maritalStatus: "" as MaritalStatus | "",
                      nationalityId: "",
                      profession: "",
                      isMinor: false,
                      wantsInsurance: null,
                      insuranceId: "",
                      hasOwnInsurance: null,
                      emergencyContactName: "",
                      emergencyContactPhone: "",
                      specialSituations: "",
                    },
                  ];
                  updateCompanionsDraft(next);
                  setModExpandedCompanionIndex(next.length - 1);
                }}
              >
                Agregar acompanante
              </Button>
            </div>
          ) : null}

          {draft.hasCompanions ? (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={draft.companions.some((companion) => companion.isMinor)}
                  disabled={draft.companions.length === 0}
                  onChange={(event) => {
                    if (draft.companions.length === 0) {
                      return;
                    }
                    if (!event.target.checked) {
                      const next = draft.companions.map((companion) => ({
                        ...companion,
                        isMinor: false,
                      }));
                      updateCompanionsDraft(next);
                      return;
                    }
                    const hasAny = draft.companions.some((companion) => companion.isMinor);
                    if (hasAny) {
                      return;
                    }
                    const next = draft.companions.map((companion, idx) => ({
                      ...companion,
                      isMinor: idx === 0,
                    }));
                    updateCompanionsDraft(next);
                  }}
                />
                Hay menores de edad
              </label>
              {draft.companions.some((companion) => companion.isMinor) ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {draft.companions.map((companion, idx) => (
                    <label
                      key={companion.id}
                      className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                        checked={companion.isMinor}
                        onChange={(event) => {
                          const next = [...draft.companions];
                          next[idx] = {
                            ...companion,
                            isMinor: event.target.checked,
                          };
                          updateCompanionsDraft(next);
                        }}
                      />
                      {companion.fullName || `Acompanante ${idx + 1}`}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {draft.hasMinorCompanions ? (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-600">Patria potestad</div>
                <select
                  className={selectClassName}
                  value={
                    draft.hasParentalAuthority === null
                      ? ""
                      : draft.hasParentalAuthority
                        ? "true"
                        : "false"
                  }
                  onChange={(event) => {
                    if (event.target.value === "") {
                      updateDraft({
                        hasParentalAuthority: null,
                        docFlags: {
                          ...draft.docFlags,
                          minorPermit: false,
                        },
                        documents: draft.documents.filter((doc) => doc.type !== "MINOR_PERMIT"),
                      });
                      return;
                    }
                    const hasParentalAuthority = event.target.value === "true";
                    updateDraft({
                      hasParentalAuthority,
                      docFlags: {
                        ...draft.docFlags,
                        minorPermit: hasParentalAuthority ? false : draft.docFlags.minorPermit,
                      },
                      documents: hasParentalAuthority
                        ? draft.documents.filter((doc) => doc.type !== "MINOR_PERMIT")
                        : draft.documents,
                    });
                  }}
                >
                  <option value="">Selecciona</option>
                  <option value="true">Si</option>
                  <option value="false">No</option>
                </select>
              </div>
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-4 text-xs text-slate-600">
          {(
            [
              { key: "idCard", label: "Cedula", type: "ID_CARD" as DocumentType, enabled: true },
              { key: "passport", label: "Pasaporte", type: "PASSPORT" as DocumentType, enabled: true },
              {
                key: "paymentProof",
                label: "Pagos",
                type: "PAYMENT_PROOF" as DocumentType,
                enabled: true,
              },
              {
                key: "insurance",
                label: "Seguro propio",
                type: "INSURANCE" as DocumentType,
                enabled:
                  draft.hasOwnInsurance === true ||
                  draft.companions.some((companion) => companion.hasOwnInsurance === true),
              },
            ]
          ).map((item) => (
            <label key={item.key} className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={draft.docFlags[item.key as keyof typeof draft.docFlags]}
                disabled={!item.enabled}
                onChange={(event) => {
                  const checked = event.target.checked;
                  const nextDocs = checked
                    ? draft.documents
                    : draft.documents.filter((doc) => doc.type !== item.type);
                  updateDraft({
                    docFlags: {
                      ...draft.docFlags,
                      [item.key]: checked,
                    },
                    documents: nextDocs,
                  });
                }}
              />
              <span
                className={
                  !item.enabled
                    ? "text-slate-300"
                    : getDocsByType(draft, item.type).length > 0
                      ? "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700"
                      : "rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700"
                }
              >
                {item.label}
              </span>
            </label>
          ))}
        </div>

        {(
          [
            { key: "idCard", label: "Cedula", type: "ID_CARD" as DocumentType },
            { key: "passport", label: "Pasaporte", type: "PASSPORT" as DocumentType },
            { key: "paymentProof", label: "Pagos", type: "PAYMENT_PROOF" as DocumentType },
            { key: "insurance", label: "Seguro propio", type: "INSURANCE" as DocumentType },
          ]
        ).map((item) => {
          const enabled = draft.docFlags[item.key as keyof typeof draft.docFlags];
          if (!enabled) {
            return null;
          }
          const ownerOptions = [
            "Titular",
            ...draft.companions
              .map((companion) => companion.fullName)
              .filter((name) => name.trim().length > 0),
          ];
          const docs = getDocsByType(draft, item.type);
          return (
            <div key={item.key} className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-700">{item.label}</div>
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                <div className="space-y-1">
                  <div className="text-[11px] text-slate-500">Pertenece a</div>
                  <select
                    className={selectClassName}
                    value={getOwnerValue(draft.id, item.type)}
                    onChange={(event) => setOwnerValue(draft.id, item.type, event.target.value)}
                  >
                    {ownerOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                {item.key === "paymentProof" ? (
                  <div className="space-y-1">
                    <div className="text-[11px] text-slate-500">Concepto</div>
                    <select
                      className={selectClassName}
                      value={getConceptValue(draft.id, item.type)}
                      onChange={(event) =>
                        setConceptValue(draft.id, item.type, event.target.value)
                      }
                    >
                      {paymentConceptOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {item.key === "paymentProof" &&
                getConceptValue(draft.id, item.type) === "OTHER" ? (
                  <div className="space-y-1 md:col-span-2">
                    <div className="text-[11px] text-slate-500">Detalle concepto</div>
                    <input
                      className={inputClassName}
                      value={getConceptOtherValue(draft.id, item.type)}
                      onChange={(event) =>
                        setConceptOtherValue(draft.id, item.type, event.target.value)
                      }
                    />
                  </div>
                ) : null}
                <div className="space-y-1 md:col-span-2">
                  <div className="text-[11px] text-slate-500">Adjuntar documentos</div>
                  <input
                    className={inputClassName}
                    type="file"
                    multiple
                    onChange={(event) => {
                      const nextDocs = addDocuments(
                        draft,
                        item.type,
                        getOwnerValue(draft.id, item.type),
                        event.target.files,
                        item.key === "paymentProof"
                          ? {
                              concept: getConceptValue(draft.id, item.type),
                              conceptOther: getConceptOtherValue(draft.id, item.type),
                            }
                          : undefined,
                      );
                      if (nextDocs.length !== draft.documents.length) {
                        updateDraft({ documents: nextDocs });
                      }
                    }}
                  />
                </div>
              </div>
              {docs.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600">
                  {docs.map((doc) => (
                    <span
                      key={doc.id}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-0.5"
                    >
                      {doc.fileName} · {doc.ownerName}
                      {formatDocConcept(doc) ? ` · ${formatDocConcept(doc)}` : ""}
                      <button
                        type="button"
                        className="text-slate-500 hover:text-slate-900"
                        onClick={() =>
                          updateDraft({ documents: removeDocument(draft, doc.id) })
                        }
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  const summaryMember = sentSummaryDialog.member;
  const summaryPricing = summaryMember ? calculatePackageTotals(summaryMember) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TripMemberFilters users={users} filters={filters} onChange={setFilters} />
        <AddTripMemberDialog
          tripId={tripId}
          tripName={tripName}
          tripLodgingType={tripLodgingType}
          tripPackageBasePrice={tripPackageBasePrice}
          tripReservationMinPerPerson={tripReservationMinPerPerson}
          repo={repo}
          users={users}
          currentUser={currentUser}
          catalogs={catalogs}
          maxSeatsRemaining={remainingSeats}
          isTripClosed={isClosed}
          onMemberCreated={async () => loadMembers()}
          onCatalogAdded={(catalogName: CatalogName, item: CatalogItem) => {
            setCatalogs((prev) => ({ ...prev, [catalogName]: [...prev[catalogName], item] }));
          }}
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="font-medium text-slate-900">Capacidad del viaje</div>
          <div className={`font-semibold ${isClosed ? "text-rose-600" : "text-slate-900"}`}>
            {totalSeats} / {maxSeats} ocupados
          </div>
        </div>
        <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
          <div
            className={`h-2 rounded-full ${isClosed ? "bg-rose-500" : "bg-emerald-500"}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {isClosed ? (
          <p className="mt-2 text-xs font-semibold text-rose-600">
            Viaje cerrado: no permite mas pasajeros.
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            Cupos disponibles: {remainingSeats}
          </p>
        )}
      </div>

      {renderTable}

      {isAgent ? (
        <Dialog open={modDialog.open} onOpenChange={(open) => (!open ? closeModificationDialog() : null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Solicitud de modificacion</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="text-slate-600">
                  Pasajero: <span className="font-semibold text-slate-900">{modDialog.member?.fullName ?? "-"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600">Paso a modificar</span>
                  <select
                    className={selectClassName}
                    value={modStep}
                    onChange={(event) => setModStep(event.target.value as ContractModificationStep)}
                  >
                    <option value="STEP1">Paso 1 · Datos del viaje</option>
                    <option value="STEP2">Paso 2 · Acompanantes</option>
                    <option value="STEP3">Paso 3 · Seguro y emergencia</option>
                    <option value="STEP4">Paso 4 · Documentos</option>
                  </select>
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3">
                <div className={`mb-3 text-sm font-semibold ${getStepToneClass(modStep)}`}>
                  {getModificationStepLabel(modStep)}
                </div>
                {modDraft ? renderModificationStep(modDraft) : null}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeModificationDialog}>
                  Cancelar
                </Button>
                <Button onClick={() => void handleSubmitModification()} disabled={isSavingModification || !modDraft}>
                  {isSavingModification ? "Enviando..." : "Enviar solicitud"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {isAgent ? (
        <Dialog
          open={upsellDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              closeUpsellDialog();
            }
          }}
        >
          <DialogContent className="max-h-[92vh] w-[98vw] max-w-[1400px] overflow-y-auto p-5 sm:p-6">
            <DialogHeader>
              <DialogTitle>Anexo de adicionales</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-xs text-slate-600">
                Pasajero: <span className="font-semibold text-slate-900">{upsellDialog.member?.fullName ?? "-"}</span>
              </div>
              <div className="rounded-md border border-slate-200">
                <div className="overflow-x-auto">
                <table className="w-full min-w-[1150px] border-collapse text-xs">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Detalle</th>
                      <th className="px-3 py-2">Corresponde a</th>
                      <th className="px-3 py-2">Cantidad</th>
                      <th className="px-3 py-2">Unitario</th>
                      <th className="px-3 py-2">Total</th>
                      <th className="px-3 py-2">Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upsellLines.map((line, index) => {
                      const lineTotal = Math.max(0, line.quantity ?? 0) * Math.max(0, line.unitPrice ?? 0);
                      return (
                        <tr key={line.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-slate-600">{line.type}</td>
                          <td className="px-3 py-2">
                            {line.type === "LUGGAGE" ? (
                              <select
                                className={selectClassName}
                                value={line.label}
                                onChange={(event) =>
                                  setUpsellLines((prev) =>
                                    prev.map((item, idx) =>
                                      idx === index ? { ...item, label: event.target.value } : item,
                                    ),
                                  )
                                }
                              >
                                <option value="">Selecciona</option>
                                <option value="Carry On">Carry On</option>
                                <option value="Documentado">Documentado</option>
                              </select>
                            ) : line.type === "FLIGHT" ? (
                              <select
                                className={selectClassName}
                                value={line.label}
                                onChange={(event) =>
                                  setUpsellLines((prev) =>
                                    prev.map((item, idx) =>
                                      idx === index ? { ...item, label: event.target.value } : item,
                                    ),
                                  )
                                }
                              >
                                <option value="">Selecciona</option>
                                <option value="Vuelos internos">Vuelos internos</option>
                                <option value="Vuelos internacionales">Vuelos internacionales</option>
                              </select>
                            ) : (
                              <input
                                className={inputClassName}
                                value={line.label}
                                onChange={(event) =>
                                  setUpsellLines((prev) =>
                                    prev.map((item, idx) =>
                                      idx === index ? { ...item, label: event.target.value } : item,
                                    ),
                                  )
                                }
                              />
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <select
                              className={selectClassName}
                              value={line.ownerName}
                              onChange={(event) =>
                                setUpsellLines((prev) =>
                                  prev.map((item, idx) =>
                                    idx === index ? { ...item, ownerName: event.target.value } : item,
                                  ),
                                )
                              }
                            >
                              {upsellOwnerOptions.map((name) => (
                                <option key={name} value={name}>
                                  {name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className={inputClassName}
                              type="number"
                              min={0}
                              value={line.quantity ?? ""}
                              onChange={(event) =>
                                setUpsellLines((prev) =>
                                  prev.map((item, idx) =>
                                    idx === index
                                      ? {
                                          ...item,
                                          quantity: event.target.value === "" ? null : Number(event.target.value),
                                        }
                                      : item,
                                  ),
                                )
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className={inputClassName}
                              type="number"
                              min={0}
                              step="0.01"
                              value={line.unitPrice ?? ""}
                              onChange={(event) =>
                                setUpsellLines((prev) =>
                                  prev.map((item, idx) =>
                                    idx === index
                                      ? {
                                          ...item,
                                          unitPrice: event.target.value === "" ? null : Number(event.target.value),
                                        }
                                      : item,
                                  ),
                                )
                              }
                            />
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-900">USD {lineTotal.toFixed(2)}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Button size="sm" variant="outline" onClick={() => addUpsellLineByType(line.type)}>
                                Agregar
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => removeUpsellLine(line.id)}>
                                Quitar
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-600">Notas</div>
                  <textarea
                    className="min-h-[74px] w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
                    value={upsellNotes}
                    onChange={(event) => setUpsellNotes(event.target.value)}
                  />
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-600">Total anexo</div>
                  <div className="text-lg font-semibold text-slate-900">USD {upsellSubtotal.toFixed(2)}</div>
                  <div className="mt-2 text-[11px] text-slate-500">
                    Este monto es independiente del paquete, reserva y saldo.
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeUpsellDialog}>
                  Cancelar
                </Button>
                <Button onClick={() => void handleSubmitUpsell()} disabled={isSavingUpsell || upsellSubtotal <= 0}>
                  {isSavingUpsell ? "Enviando..." : "Enviar a compras"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {isAgent ? (
        <Dialog
          open={sentSummaryDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              setSentSummaryStep("GENERAL");
            }
            setSentSummaryDialog((prev) => ({ open, member: open ? prev.member : null }));
          }}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Resumen enviado a contratos</DialogTitle>
            </DialogHeader>
            {summaryMember ? (
              <div className="space-y-4 text-xs text-slate-600">
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "GENERAL", label: "Datos" },
                    { id: "STEP1", label: "Paso 1" },
                    { id: "STEP2", label: "Paso 2" },
                    { id: "STEP3", label: "Paso 3" },
                    { id: "STEP4", label: "Paso 4" },
                    { id: "STEP5", label: "Paso 5" },
                  ].map((step) => (
                    <Button
                      key={step.id}
                      size="sm"
                      variant={sentSummaryStep === step.id ? "default" : "outline"}
                      onClick={() => setSentSummaryStep(step.id as typeof sentSummaryStep)}
                    >
                      {step.label}
                    </Button>
                  ))}
                </div>

                {sentSummaryStep === "GENERAL" ? (
                  <div className="rounded-md border border-slate-200 bg-white p-3">
                    <div className="text-xs font-semibold text-slate-600">Datos generales</div>
                    <div className="mt-2 grid gap-2 md:grid-cols-3">
                      <div>
                        <div className="text-[11px] text-slate-500">Pasajero</div>
                        <div className="font-semibold text-slate-900">
                          {summaryMember.fullName}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Identificacion</div>
                        <div>{summaryMember.identification || "-"}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Viaje</div>
                        <div>
                          {tripName} · {tripDateFrom} - {tripDateTo}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Correo</div>
                        <div>{summaryMember.email || "-"}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Telefono</div>
                        <div>{summaryMember.phone || "-"}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Enviado</div>
                        <div>
                          {summaryMember.contractsSentAt
                            ? formatDate(summaryMember.contractsSentAt)
                            : "-"}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {sentSummaryStep === "STEP1" ? (
                  <div className="rounded-md border border-slate-200 bg-white p-3">
                    <div className="text-xs font-semibold text-slate-600">Paso 1 · Datos del viaje</div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <div>
                        <div className="text-[11px] text-slate-500">Direccion exacta</div>
                        <div>{summaryMember.address || "-"}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Estado civil</div>
                        <div>
                          {maritalOptions.find(
                            (item) => item.value === summaryMember.maritalStatus,
                          )?.label ?? "-"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Nacionalidad</div>
                        <div>
                          {catalogOptions.nationalities.find(
                            (item) => item.id === summaryMember.nationalityId,
                          )?.name ?? "-"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Profesion u ocupacion</div>
                        <div>{summaryMember.profession || "-"}</div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {sentSummaryStep === "STEP3" ? (
                  <div className="rounded-md border border-slate-200 bg-white p-3">
                    <div className="text-xs font-semibold text-slate-600">Paso 3 · Seguro y emergencia</div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <div>
                        <div className="text-[11px] text-slate-500">Desea seguro</div>
                        <div>
                          {summaryMember.wantsInsurance === null
                            ? "-"
                            : summaryMember.wantsInsurance
                              ? "Si"
                              : "No"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Tipo de seguro</div>
                        <div>
                          {catalogOptions.insurances.find(
                            (item) => item.id === summaryMember.insuranceId,
                          )?.name ?? "-"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Seguro propio</div>
                        <div>
                          {summaryMember.hasOwnInsurance === null
                            ? "-"
                            : summaryMember.hasOwnInsurance
                              ? "Si"
                              : "No"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Contacto emergencia</div>
                        <div>{summaryMember.emergencyContactName || "-"}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Telefono emergencia</div>
                        <div>{summaryMember.emergencyContactPhone || "-"}</div>
                      </div>
                      <div className="md:col-span-2">
                        <div className="text-[11px] text-slate-500">Situaciones especiales</div>
                        <div>{summaryMember.specialSituations || "-"}</div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {sentSummaryStep === "STEP2" ? (
                  <div className="rounded-md border border-slate-200 bg-white p-3">
                    <div className="text-xs font-semibold text-slate-600">Paso 2 · Acompanantes</div>
                    <div className="mt-2 space-y-2">
                      <div>
                        <div className="text-[11px] text-slate-500">Acompanantes</div>
                        <div>
                          {summaryMember.hasCompanions === null
                            ? "-"
                            : summaryMember.hasCompanions
                              ? "Si"
                              : "No"}
                        </div>
                      </div>
                      {summaryMember.companions.length > 0 ? (
                        <div className="space-y-1">
                          {summaryMember.companions.map((companion) => (
                            <div key={companion.id} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
                              {companion.fullName || "(Sin nombre)"}
                              {companion.identification ? ` · ${companion.identification}` : ""}
                              {companion.isMinor ? " · Menor" : ""}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div>-</div>
                      )}
                      {summaryMember.hasMinorCompanions ? (
                        <div>
                          <div className="text-[11px] text-slate-500">Patria potestad</div>
                          <div>
                            {summaryMember.hasParentalAuthority === null
                              ? "-"
                              : summaryMember.hasParentalAuthority
                                ? "Si"
                                : "No"}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {sentSummaryStep === "STEP4" ? (
                  <div className="rounded-md border border-slate-200 bg-white p-3">
                    <div className="text-xs font-semibold text-slate-600">Paso 4 · Pago base y acomodo</div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <div>
                        <div className="text-[11px] text-slate-500">Acomodacion</div>
                        <div>{summaryMember.accommodationType || "-"}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Asientos</div>
                        <div>{summaryMember.seats || "-"}</div>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                      <div>
                        <div className="text-[11px] text-slate-500">Precio base paquete</div>
                        <div>USD {(summaryMember.packageBasePrice ?? 0).toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Reserva minima</div>
                        <div>USD {(summaryMember.reservationMinPerPerson ?? 0).toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Plazo cuotas</div>
                        <div>{summaryMember.paymentPlanMonths ?? "-"} meses</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Saldo total</div>
                        <div>USD {(summaryMember.paymentBalanceTotal ?? 0).toFixed(2)}</div>
                      </div>
                    </div>
                    {summaryPricing ? (
                      <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-2 py-2">
                        <div className="grid gap-2 md:grid-cols-4">
                          <div>
                            <div className="text-[11px] text-slate-500">Total paquete</div>
                            <div className="font-semibold text-slate-900">
                              USD {summaryPricing.baseTotal.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] text-slate-500">Reserva por persona</div>
                            <div className="font-semibold text-slate-900">
                              USD {summaryPricing.reservationPerPerson.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] text-slate-500">Reserva total</div>
                            <div className="font-semibold text-slate-900">
                              USD {summaryPricing.reservationTotal.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] text-slate-500">Cuota mensual saldo</div>
                            <div className="font-semibold text-slate-900">
                              USD {summaryPricing.installmentAmount.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-3 text-[11px] text-slate-500">
                      Los upsells se gestionan por separado como anexo enviado a Compras y Facturacion.
                    </div>
                  </div>
                ) : null}

                {sentSummaryStep === "STEP5" ? (
                  <div className="rounded-md border border-slate-200 bg-white p-3">
                    <div className="text-xs font-semibold text-slate-600">Paso 5 · Documentos</div>
                    <div className="mt-2 space-y-2">
                      {[
                        { label: "Cedula", type: "ID_CARD" as DocumentType },
                        { label: "Pasaporte", type: "PASSPORT" as DocumentType },
                        { label: "Permiso menor", type: "MINOR_PERMIT" as DocumentType },
                        { label: "Seguro propio", type: "INSURANCE" as DocumentType },
                        { label: "Pagos", type: "PAYMENT_PROOF" as DocumentType },
                      ].map((item) => {
                        const docs = getDocsByType(summaryMember, item.type);
                        if (docs.length === 0) {
                          return null;
                        }
                        return (
                          <div key={item.type} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
                            <div className="text-[11px] text-slate-500">{item.label}</div>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {docs.map((doc) => (
                                <span key={doc.id} className="rounded-full border border-slate-200 bg-white px-2 py-0.5">
                                  {doc.fileName} · {doc.ownerName}
                                  {formatDocConcept(doc) ? ` · ${formatDocConcept(doc)}` : ""}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}


                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => setSentSummaryDialog({ open: false, member: null })}>
                    Cerrar
                  </Button>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}

      {!isAgent ? (
        <Dialog
          open={detailsDialog.open}
          onOpenChange={(open: boolean) =>
            setDetailsDialog((prev) => ({ open, member: open ? prev.member : null }))
          }
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detalles del pasajero</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <textarea
                className="min-h-[140px] w-full rounded-md border border-slate-300 p-3 text-sm"
                value={detailsDraft}
                onChange={(event) => setDetailsDraft(event.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDetailsDialog({ open: false, member: null })}>
                  Cancelar
                </Button>
                <Button onClick={() => void handleDetailsSave()}>Guardar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {!isAgent ? (
        <AddCatalogItemDialog
          open={catalogDialog.open}
          onOpenChange={(open: boolean) =>
            setCatalogDialog((prev) => ({ open, target: open ? prev.target : null }))
          }
          catalogName={catalogDialog.target?.catalogName ?? null}
          repo={repo}
          onCreated={(item: CatalogItem) => {
            const target = catalogDialog.target;
            if (!target) {
              return;
            }

            setCatalogs((prev) => ({
              ...prev,
              [target.catalogName]: [...prev[target.catalogName], item],
            }));

            if (target.memberId && target.field) {
              void persistUpdate(
                target.memberId,
                { [target.field]: item.id } as UpdateTripMemberPatch,
              );
            }
          }}
        />
      ) : null}
    </div>
  );
};
