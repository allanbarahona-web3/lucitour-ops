"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  DocumentType,
  TripMember,
  UpdateTripMemberPatch,
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
  repo,
  users,
  currentUser,
  maxSeats,
}: TripMembersTableProps) => {
  const searchParams = useSearchParams();
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
  const [agentTab, setAgentTab] = useState<"active" | "sent">("active");
  const [modRequests, setModRequests] = useState<ContractModificationRequest[]>([]);
  const [modDialog, setModDialog] = useState<{ open: boolean; member: TripMember | null }>({
    open: false,
    member: null,
  });
  const [sentSummaryDialog, setSentSummaryDialog] = useState<{
    open: boolean;
    member: TripMember | null;
  }>({ open: false, member: null });
  const [modStep, setModStep] = useState<ContractModificationStep>("STEP1");
  const [modDraft, setModDraft] = useState<TripMember | null>(null);
  const [isSavingModification, setIsSavingModification] = useState(false);

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const [focusedMemberId, setFocusedMemberId] = useState<string | null>(null);

  const isAdmin = currentUser.role === Role.ADMIN;
  const isAgent = currentUser.role === Role.AGENT || currentUser.role === Role.SUPERVISOR;
  const isSupervisor = currentUser.role === Role.SUPERVISOR;

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
    setMembers(data);
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
    scheduleUpdate(
      member.id,
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

  const openModificationDialog = (member: TripMember) => {
    setModDialog({ open: true, member });
    setModStep("STEP1");
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
        return "Paso 2 · Seguro y emergencia";
      case "STEP3":
        return "Paso 3 · Acompanantes";
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
        return "text-amber-600";
      case "STEP3":
        return "text-cyan-700";
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

  const getOwnerValue = (memberId: string, type: DocumentType) =>
    docOwners[memberId]?.[type] ?? "Titular";

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

  const addDocuments = (
    member: TripMember,
    type: DocumentType,
    ownerName: string,
    files: FileList | null,
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
      { label: "Desea seguro", ok: member.wantsInsurance !== null },
      {
        label: "Tipo de seguro",
        ok: member.wantsInsurance !== true || isFilled(member.insuranceId),
      },
      {
        label: "Tiene seguro propio",
        ok: member.wantsInsurance !== false || member.hasOwnInsurance !== null,
      },
      { label: "Contacto emergencia", ok: isFilled(member.emergencyContactName) },
      { label: "Telefono emergencia", ok: isFilled(member.emergencyContactPhone) },
      { label: "Situaciones especiales", ok: isFilled(member.specialSituations) },
    ];
    const step3Checks = [
      { label: "Acompanantes", ok: member.hasCompanions !== null },
      {
        label: "Lista de acompanantes",
        ok: member.hasCompanions !== true || member.companions.length > 0,
      },
      {
        label: "Patria potestad",
        ok: !member.hasMinorCompanions || member.hasParentalAuthority !== null,
      },
    ];
    const step4Required = [
      { key: "idCard", label: "Documento: Cedula", enabled: true, type: "ID_CARD" as DocumentType },
      { key: "passport", label: "Documento: Pasaporte", enabled: true, type: "PASSPORT" as DocumentType },
      {
        key: "minorPermit",
        label: "Documento: Permiso menor",
        enabled: member.hasMinorCompanions && member.hasParentalAuthority === false,
        type: "MINOR_PERMIT" as DocumentType,
      },
      {
        key: "insurance",
        label: "Documento: Seguro propio",
        enabled: member.hasOwnInsurance === true,
        type: "INSURANCE" as DocumentType,
      },
    ];
    const step4Checks = step4Required
      .filter((doc) => doc.enabled)
      .map((doc) => ({
        label: doc.label,
        ok:
          member.docFlags[doc.key as keyof typeof member.docFlags] &&
          getDocsByType(member, doc.type).length > 0,
      }));
    const step5Checks = [
      {
        label: "Comprobante pago inicial",
        ok:
          member.docFlags.paymentProof &&
          getDocsByType(member, "PAYMENT_PROOF").length > 0,
      },
    ];

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
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Agente</th>
                {isAdmin ? <th className="px-3 py-2">Asignado a</th> : null}
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Identificacion</th>
                <th className="px-3 py-2">Tipo ID</th>
                <th className="px-3 py-2">Telefono</th>
                <th className="px-3 py-2">Correo</th>
                <th className="px-3 py-2">Reservar</th>
                <th className="px-3 py-2">Detalles</th>
              </tr>
            </thead>
            <tbody>
              {agentActiveMembers.length === 0 ? (
                <tr className="border-t border-slate-100">
                  <td
                    className="px-3 py-6 text-center text-sm text-slate-500"
                    colSpan={isAdmin ? 10 : 9}
                  >
                    Sin pendientes
                  </td>
                </tr>
              ) : (
                agentActiveMembers.map((member) => {
            const expanded = expandedRows[member.id];
            const canExpand = member.wantsReservation;
            const progress = getStepProgress(member);
            const missingItems = progress.overall.missing;
            const canSend = progress.overall.percent === 100 && member.contractsStatus !== ContractsStatus.SENT;
            const step1Locked = isBlockLocked(member.id, "step1");
            const step2Locked = isBlockLocked(member.id, "step2");
            const step3Locked = isBlockLocked(member.id, "step3");
            const step4Locked = isBlockLocked(member.id, "step4");
            const step5Locked = isBlockLocked(member.id, "step5");
            const destinationLabel = `${tripName} · ${tripDateFrom} - ${tripDateTo}`;
            const lockedClass = "pointer-events-none opacity-70";
            return (
              <Fragment key={member.id}>
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-600">{formatDate(member.createdAt)}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {userById.get(member.enteredByUserId)?.name ?? "-"}
                  </td>
                  {isAdmin ? (
                    <td className="px-3 py-2 text-slate-600">
                      <select
                        className={selectClassName}
                        value={member.assignedToUserId}
                        onChange={(event) =>
                          handleSelectChange(member.id, {
                            assignedToUserId: event.target.value,
                          })
                        }
                      >
                        {agentUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  ) : null}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        className={inputClassName}
                        value={member.fullName}
                        onChange={(event) =>
                          scheduleUpdate(
                            member.id,
                            { fullName: event.target.value },
                            `${member.id}:fullName`,
                          )
                        }
                      />
                      {member.isDraft ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          Pendiente
                        </span>
                      ) : null}
                    </div>
                  </td>
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
                              <span className="text-amber-600">Paso 2 · Seguro y emergencia</span>
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
                          <div className={`mt-3 grid gap-3 md:grid-cols-3 ${step2Locked ? lockedClass : ""}`}>
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
                                disabled={step2Locked}
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
                                  disabled={step2Locked}
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
                                    disabled={step2Locked}
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
                                          docFlags: {
                                            ...member.docFlags,
                                            insurance: hasOwnInsurance ? member.docFlags.insurance : false,
                                          },
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
                                disabled={step2Locked}
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
                                disabled={step2Locked}
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
                                disabled={step2Locked}
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
                        </div>

                        <div className="rounded-md border border-slate-200 bg-white p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] text-white">3</span>
                              <span className="text-cyan-700">Paso 3 · Acompanantes</span>
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
                                  disabled={step3Locked}
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
                                      return;
                                    }
                                    scheduleUpdate(
                                      member.id,
                                      { hasCompanions: true },
                                      `${member.id}:hasCompanions`,
                                    );
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
                                {member.companions.map((companion, index) => (
                                  <div key={companion.id} className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 md:grid-cols-4">
                                    <div className="space-y-1 md:col-span-2">
                                      <div className="text-xs font-semibold text-slate-600">Nombre completo</div>
                                      <input
                                        className={inputClassName}
                                        value={companion.fullName}
                                        disabled={step3Locked}
                                        onChange={(event) => {
                                          const next = [...member.companions];
                                          next[index] = { ...companion, fullName: event.target.value };
                                          updateCompanions(member, next);
                                        }}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <div className="text-xs font-semibold text-slate-600">Identificacion (si aplica)</div>
                                      <input
                                        className={inputClassName}
                                        value={companion.identification}
                                        disabled={step3Locked}
                                        onChange={(event) => {
                                          const next = [...member.companions];
                                          next[index] = { ...companion, identification: event.target.value };
                                          updateCompanions(member, next);
                                        }}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                      <label className="flex items-center gap-2 text-xs text-slate-600">
                                        <input
                                          type="checkbox"
                                          className="h-4 w-4 rounded border-slate-300"
                                          checked={companion.isMinor}
                                          disabled={step3Locked}
                                          onChange={(event) => {
                                            const next = [...member.companions];
                                            next[index] = { ...companion, isMinor: event.target.checked };
                                            updateCompanions(member, next);
                                          }}
                                        />
                                        Menor de edad
                                      </label>
                                      {!step3Locked ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            const next = member.companions.filter((_, i) => i !== index);
                                            updateCompanions(member, next);
                                          }}
                                        >
                                          Eliminar
                                        </Button>
                                      ) : null}
                                    </div>
                                  </div>
                                ))}
                                {!step3Locked ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      const next = [
                                        ...member.companions,
                                        {
                                          id: `${member.id}-companion-${Date.now()}`,
                                          fullName: "",
                                          identification: "",
                                          isMinor: false,
                                        },
                                      ];
                                      updateCompanions(member, next);
                                    }}
                                  >
                                    Agregar acompanante
                                  </Button>
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
                                    disabled={step3Locked}
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
                          </div>
                        </div>

                        <div className="rounded-md border border-slate-200 bg-white p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] text-white">4</span>
                              <span className="text-violet-700">Paso 4 · Documentos</span>
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
                          <div className={`mt-3 space-y-3 ${step4Locked ? lockedClass : ""}`}>
                            <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                              {(
                                [
                                  { key: "idCard", label: "Cedula", type: "ID_CARD" as DocumentType, enabled: true },
                                  { key: "passport", label: "Pasaporte", type: "PASSPORT" as DocumentType, enabled: true },
                                  {
                                    key: "minorPermit",
                                    label: "Permiso menor",
                                    type: "MINOR_PERMIT" as DocumentType,
                                    enabled: member.hasMinorCompanions && member.hasParentalAuthority === false,
                                  },
                                  {
                                    key: "insurance",
                                    label: "Seguro propio",
                                    type: "INSURANCE" as DocumentType,
                                    enabled: member.hasOwnInsurance === true,
                                  },
                                ]
                              ).map((item) => (
                                <label key={item.key} className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-slate-300"
                                    checked={member.docFlags[item.key as keyof typeof member.docFlags]}
                                    disabled={step4Locked || !item.enabled}
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
                                  <span className={!item.enabled ? "text-slate-300" : ""}>{item.label}</span>
                                </label>
                              ))}
                            </div>

                            {(
                              [
                                { key: "idCard", label: "Cedula", type: "ID_CARD" as DocumentType },
                                { key: "passport", label: "Pasaporte", type: "PASSPORT" as DocumentType },
                                { key: "minorPermit", label: "Permiso menor", type: "MINOR_PERMIT" as DocumentType },
                                { key: "insurance", label: "Seguro propio", type: "INSURANCE" as DocumentType },
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
                                        disabled={step4Locked}
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
                                    <div className="space-y-1 md:col-span-2">
                                      <div className="text-[11px] text-slate-500">Adjuntar documentos</div>
                                      <input
                                        className={inputClassName}
                                        type="file"
                                        multiple
                                        disabled={step4Locked}
                                        onChange={(event) => {
                                          const nextDocs = addDocuments(
                                            member,
                                            item.type,
                                            getOwnerValue(member.id, item.type),
                                            event.target.files,
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
                                          {!step4Locked ? (
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
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] text-white">5</span>
                              <span className="text-emerald-700">Paso 5 · Pago inicial</span>
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
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-slate-600">
                                Comprobante de pago inicial
                              </div>
                              <input
                                className={inputClassName}
                                type="file"
                                multiple
                                disabled={step5Locked}
                                onChange={(event) => {
                                  const nextDocs = addDocuments(
                                    member,
                                    "PAYMENT_PROOF",
                                    "Pago inicial",
                                    event.target.files,
                                  );
                                  const hasPaymentProof = nextDocs.some(
                                    (doc) => doc.type === "PAYMENT_PROOF",
                                  );
                                  if (nextDocs.length !== member.documents.length) {
                                    scheduleUpdate(
                                      member.id,
                                      {
                                        documents: nextDocs,
                                        docFlags: {
                                          ...member.docFlags,
                                          paymentProof: hasPaymentProof,
                                        },
                                      },
                                      `${member.id}:documents:paymentProof`,
                                    );
                                  }
                                }}
                              />
                            </div>
                            {getDocsByType(member, "PAYMENT_PROOF").length > 0 ? (
                              <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
                                {getDocsByType(member, "PAYMENT_PROOF").map((doc) => (
                                  <span
                                    key={doc.id}
                                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-0.5"
                                  >
                                    {doc.fileName}
                                    {!step5Locked ? (
                                      <button
                                        type="button"
                                        className="text-slate-500 hover:text-slate-900"
                                        onClick={() => {
                                          const nextDocs = removeDocument(member, doc.id);
                                          const hasPaymentProof = nextDocs.some(
                                            (entry) => entry.type === "PAYMENT_PROOF",
                                          );
                                          scheduleUpdate(
                                            member.id,
                                            {
                                              documents: nextDocs,
                                              docFlags: {
                                                ...member.docFlags,
                                                paymentProof: hasPaymentProof,
                                              },
                                            },
                                            `${member.id}:documents:remove:${doc.id}`,
                                          );
                                        }}
                                      >
                                        x
                                      </button>
                                    ) : null}
                                  </span>
                                ))}
                              </div>
                            ) : null}
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
                        <Button size="sm" variant="outline" onClick={() => openModificationDialog(member)}>
                          Solicitar modificacion
                        </Button>
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

    if (modStep === "STEP2") {
      return (
        <div className="grid gap-3 md:grid-cols-3">
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
                      docFlags: {
                        ...draft.docFlags,
                        insurance: hasOwnInsurance ? draft.docFlags.insurance : false,
                      },
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
      );
    }

    if (modStep === "STEP3") {
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
                    return;
                  }
                  updateDraft({ hasCompanions: true });
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
              {draft.companions.map((companion, index) => (
                <div
                  key={companion.id}
                  className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 md:grid-cols-4"
                >
                  <div className="space-y-1 md:col-span-2">
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
                    <div className="text-xs font-semibold text-slate-600">Identificacion (si aplica)</div>
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
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                        checked={companion.isMinor}
                        onChange={(event) => {
                          const next = [...draft.companions];
                          next[index] = { ...companion, isMinor: event.target.checked };
                          updateCompanionsDraft(next);
                        }}
                      />
                      Menor de edad
                    </label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const next = draft.companions.filter((_, i) => i !== index);
                        updateCompanionsDraft(next);
                      }}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const next = [
                    ...draft.companions,
                    {
                      id: `${draft.id}-companion-${Date.now()}`,
                      fullName: "",
                      identification: "",
                      isMinor: false,
                    },
                  ];
                  updateCompanionsDraft(next);
                }}
              >
                Agregar acompanante
              </Button>
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
                label: "Pago inicial",
                type: "PAYMENT_PROOF" as DocumentType,
                enabled: true,
              },
              {
                key: "minorPermit",
                label: "Permiso menor",
                type: "MINOR_PERMIT" as DocumentType,
                enabled: draft.hasMinorCompanions && draft.hasParentalAuthority === false,
              },
              {
                key: "insurance",
                label: "Seguro propio",
                type: "INSURANCE" as DocumentType,
                enabled: draft.hasOwnInsurance === true,
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
              <span className={!item.enabled ? "text-slate-300" : ""}>{item.label}</span>
            </label>
          ))}
        </div>

        {(
          [
            { key: "idCard", label: "Cedula", type: "ID_CARD" as DocumentType },
            { key: "passport", label: "Pasaporte", type: "PASSPORT" as DocumentType },
            { key: "paymentProof", label: "Pago inicial", type: "PAYMENT_PROOF" as DocumentType },
            { key: "minorPermit", label: "Permiso menor", type: "MINOR_PERMIT" as DocumentType },
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TripMemberFilters users={users} filters={filters} onChange={setFilters} />
        <AddTripMemberDialog
          tripId={tripId}
          tripName={tripName}
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
                    <option value="STEP1">Paso 1</option>
                    <option value="STEP2">Paso 2</option>
                    <option value="STEP3">Paso 3</option>
                    <option value="STEP4">Paso 4</option>
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
          open={sentSummaryDialog.open}
          onOpenChange={(open) =>
            setSentSummaryDialog((prev) => ({ open, member: open ? prev.member : null }))
          }
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Resumen enviado a contratos</DialogTitle>
            </DialogHeader>
            {summaryMember ? (
              <div className="space-y-4 text-xs text-slate-600">
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

                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <div className="text-xs font-semibold text-slate-600">Paso 2 · Seguro y emergencia</div>
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

                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <div className="text-xs font-semibold text-slate-600">Paso 3 · Acompanantes</div>
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

                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <div className="text-xs font-semibold text-slate-600">Paso 4 · Documentos</div>
                  <div className="mt-2 space-y-2">
                    {[
                      { label: "Cedula", type: "ID_CARD" as DocumentType },
                      { label: "Pasaporte", type: "PASSPORT" as DocumentType },
                      { label: "Permiso menor", type: "MINOR_PERMIT" as DocumentType },
                      { label: "Seguro propio", type: "INSURANCE" as DocumentType },
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
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <div className="text-xs font-semibold text-slate-600">Paso 5 · Pago inicial</div>
                  <div className="mt-2 space-y-2">
                    {getDocsByType(summaryMember, "PAYMENT_PROOF").length === 0 ? (
                      <div className="text-xs text-slate-500">Sin comprobantes</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {getDocsByType(summaryMember, "PAYMENT_PROOF").map((doc) => (
                          <span
                            key={doc.id}
                            className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px]"
                          >
                            {doc.fileName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

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
