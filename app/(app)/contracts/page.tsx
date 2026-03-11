"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getOpsRepo } from "@/lib/data/opsRepo";
import { identificationTypes, insurances } from "@/lib/data/catalogs";
import { useSession } from "@/lib/auth/sessionContext";
import { ContractsWorkflowStatus, Role, type DocumentType, type Trip, type TripMember } from "@/lib/types/ops";
import { mapTripMemberToContractDraft } from "@/lib/contracts/contractMapper";
import { renderContractGeneralPreview } from "@/lib/contracts/renderContractTemplate";
import { renderInsuranceAnnexPreview } from "@/lib/contracts/renderInsuranceAnnexTemplate";

type ItineraryItem = { date: string; activity: string };
type LucitoursSigner = "none" | "edwin" | "erick" | "both";
type AnnexStatusByMember = Record<string, { sentAt: string | null; signedAt: string | null }>;
type DocumentsOwnerFilter = "ALL" | string;
type WorkQueueFilter = "ALL" | "PENDING_SIGNATURE" | "ORANGE" | "RED";

const normalizeOwnerName = (value: string) => value.trim().toLowerCase();

const isTitularOwnerName = (ownerName: string, titularFullName: string) => {
  const normalizedOwner = normalizeOwnerName(ownerName);
  const normalizedTitular = normalizeOwnerName(titularFullName);
  return (
    normalizedOwner === normalizedTitular ||
    normalizedOwner === "titular" ||
    normalizedOwner === "cliente titular"
  );
};

const matchesOwnerFilter = (
  ownerName: string,
  selectedOwner: DocumentsOwnerFilter,
  titularFullName: string,
) => {
  if (selectedOwner === "ALL") {
    return true;
  }
  if (selectedOwner === titularFullName) {
    return isTitularOwnerName(ownerName, titularFullName);
  }
  return normalizeOwnerName(ownerName) === normalizeOwnerName(selectedOwner);
};

const ANNEX_CUTOFF_HOURS = 48;

const isClauseHeading = (line: string) =>
  /^(CLAUSULAS|PRIMERO:|SEGUNDO:|TERCERO:|CUARTO:|QUINTO:|SEXTO:|SETIMO:|OCTAVO:|NOVENO:|DECIMO:|DECIMO PRIMERO:|DECIMO SEGUNDO:|DECIMO TERCERO:|DECIMO CUARTO:|DECIMO QUINTO:|DECIMO SEXTO:|DECIMO SETIMO:|DECIMO OCTAVO:|DECIMO NOVENO:|VIGESIMO:|VIGESIMO PRIMERO:|VIGESIMO SEGUNDO:|FIRMAS)$/.test(
    line.trim(),
  );

const OUTBOUND_ACTIVITY = "Vuelo de ida al destino.";
const RETURN_ACTIVITY = "Vuelo de vuelta al pais de origen.";
const DOC_TYPE_LABEL: Record<DocumentType, string> = {
  ID_CARD: "Cedula / identificacion",
  PASSPORT: "Pasaporte",
  MINOR_PERMIT: "Permiso de menor",
  INSURANCE: "Respaldo de seguro",
  PAYMENT_PROOF: "Comprobante de pago",
};

const buildFixedItinerary = (trip?: Trip, middleItems: ItineraryItem[] = []): ItineraryItem[] => {
  const safeMiddle = middleItems.filter(
    (item) => item.activity !== OUTBOUND_ACTIVITY && item.activity !== RETURN_ACTIVITY,
  );
  return [
    { date: trip?.dateFrom ?? "", activity: OUTBOUND_ACTIVITY },
    ...safeMiddle,
    { date: trip?.dateTo ?? "", activity: RETURN_ACTIVITY },
  ];
};

const extractMiddleItinerary = (items: ItineraryItem[]): ItineraryItem[] => {
  if (items.length <= 2) {
    return [];
  }
  return items.slice(1, -1);
};

const buildInsuranceAnnexNumber = (contractNumber: string) => {
  const sanitized = (contractNumber || "SIN-CONTRATO").replace(/\s+/g, "-").toUpperCase();
  return `ANX-SEG-${sanitized}`;
};

const getDaysSince = (isoDate?: string | null) => {
  if (!isoDate) {
    return null;
  }
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const diffMs = Date.now() - parsed.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
};

const getPendingReminder = (member: TripMember) => {
  if (member.contractsWorkflowStatus !== ContractsWorkflowStatus.SENT_TO_SIGN) {
    return null;
  }

  const days = getDaysSince(member.contractsStatusUpdatedAt);
  if (days === null) {
    return {
      label: "Pendiente firma cliente",
      className: "bg-amber-100 text-amber-700",
      severity: "orange" as const,
    };
  }

  if (days >= 4) {
    return {
      label: `Seguimiento urgente (${days}d)`,
      className: "bg-rose-100 text-rose-700",
      severity: "red" as const,
    };
  }

  if (days >= 2) {
    return {
      label: `Pendiente firma (${days}d)`,
      className: "bg-amber-100 text-amber-700",
      severity: "orange" as const,
    };
  }

  return {
    label: `En espera cliente (${days}d)`,
    className: "bg-sky-100 text-sky-700",
    severity: "blue" as const,
  };
};

export default function ContractsPage() {
  const repo = useMemo(() => getOpsRepo(), []);
  const { user, users } = useSession();
  const [items, setItems] = useState<TripMember[]>([]);
  const [tripMap, setTripMap] = useState<Record<string, Trip>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [itineraryByMember, setItineraryByMember] = useState<Record<string, ItineraryItem[]>>({});
  const [luggageTextByMember, setLuggageTextByMember] = useState<Record<string, string>>({});
  const [signerByMember, setSignerByMember] = useState<Record<string, LucitoursSigner>>({});
  const [previewDialog, setPreviewDialog] = useState<{ open: boolean; memberId: string | null }>({
    open: false,
    memberId: null,
  });
  const [documentsDialog, setDocumentsDialog] = useState<{ open: boolean; memberId: string | null }>({
    open: false,
    memberId: null,
  });
  const [documentsOwnerFilter, setDocumentsOwnerFilter] = useState<DocumentsOwnerFilter>("ALL");
  const [annexDialog, setAnnexDialog] = useState<{ open: boolean; memberId: string | null }>({
    open: false,
    memberId: null,
  });
  const [itineraryDialog, setItineraryDialog] = useState<{ open: boolean; member: TripMember | null }>({
    open: false,
    member: null,
  });
  const [luggageDialog, setLuggageDialog] = useState<{ open: boolean; member: TripMember | null }>({
    open: false,
    member: null,
  });
  const [itineraryDraft, setItineraryDraft] = useState<ItineraryItem[]>([]);
  const [luggageDraft, setLuggageDraft] = useState("");
  const [annexStatusByMember, setAnnexStatusByMember] = useState<AnnexStatusByMember>({});
  const [workQueueFilter, setWorkQueueFilter] = useState<WorkQueueFilter>("ALL");
  const [workQueueQuery, setWorkQueueQuery] = useState("");
  const canViewClient = user.role === Role.ADMIN || user.role === Role.CONTRACTS;

  const insuranceById = useMemo(() => {
    const map = new Map<string, string>();
    insurances.forEach((item) => map.set(item.id, item.name));
    return map;
  }, []);

  const identificationById = useMemo(() => {
    const map = new Map<string, string>();
    identificationTypes.forEach((item) => map.set(item.id, item.name));
    return map;
  }, []);

  const toContractIdTypeLabel = (identificationTypeId: string) => {
    const raw = (identificationById.get(identificationTypeId) || "").toLowerCase();
    if (raw.includes("pasaporte")) {
      return "Pasaporte";
    }
    if (raw.includes("dimex")) {
      return "DIMEX";
    }
    return "Cedula";
  };

  const userById = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((user) => map.set(user.id, user.name));
    return map;
  }, [users]);

  const loadQueue = async () => {
    setIsLoading(true);
    const [queueMembers, trips] = await Promise.all([
      repo.listContractsQueue(),
      repo.listTrips(),
    ]);

    const nextTripMap = trips.reduce<Record<string, Trip>>((acc, trip) => {
      acc[trip.id] = trip;
      return acc;
    }, {});

    setTripMap(nextTripMap);
    setItems(queueMembers);
    setIsLoading(false);
  };

  useEffect(() => {
    void loadQueue();
    const interval = setInterval(() => {
      void loadQueue();
    }, 15000);
    return () => clearInterval(interval);
  }, [repo]);

  const statusOptions = [
    { value: ContractsWorkflowStatus.IN_PROGRESS, label: "En progreso" },
    { value: ContractsWorkflowStatus.INFO_PENDING, label: "Info pendiente" },
    { value: ContractsWorkflowStatus.SENT_TO_SIGN, label: "Enviado a firmar" },
    { value: ContractsWorkflowStatus.APPROVED, label: "Aprobado" },
  ];

  const getWorkflowStatusLabel = (status?: ContractsWorkflowStatus | null) => {
    if (!status) {
      return "Sin estado";
    }
    const match = statusOptions.find((option) => option.value === status);
    return match?.label ?? status;
  };

  const handleStatusChange = async (member: TripMember, status: ContractsWorkflowStatus) => {
    setBusyId(member.id);
    const now = new Date().toISOString();
    const optimistic: TripMember = {
      ...member,
      contractsWorkflowStatus: status,
      contractsTakenByUserId: member.contractsTakenByUserId ?? user.id,
      contractsTakenAt: member.contractsTakenAt ?? now,
      contractsStatusUpdatedAt: now,
      updatedAt: now,
    };

    setItems((prev) => prev.map((item) => (item.id === member.id ? optimistic : item)));

    const updated = await repo.updateTripMember(member.tripId, member.id, {
      contractsWorkflowStatus: status,
      contractsTakenByUserId: member.contractsTakenByUserId ?? user.id,
      contractsTakenAt: member.contractsTakenAt ?? now,
      contractsStatusUpdatedAt: now,
      updatedAt: now,
    });
    if (updated) {
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    }
    setBusyId(null);
  };

  const openItineraryDialog = (member: TripMember) => {
    const existing = itineraryByMember[member.id];
    const trip = tripMap[member.tripId];
    const nextDraft = existing && existing.length > 0
      ? buildFixedItinerary(trip, extractMiddleItinerary(existing))
      : buildFixedItinerary(trip, []);
    setItineraryDraft(nextDraft);
    setItineraryDialog({ open: true, member });
  };

  const closeItineraryDialog = () => {
    setItineraryDialog({ open: false, member: null });
    setItineraryDraft([]);
  };

  const openLuggageDialog = (member: TripMember) => {
    setLuggageDraft(luggageTextByMember[member.id] ?? "");
    setLuggageDialog({ open: true, member });
  };

  const closeLuggageDialog = () => {
    setLuggageDialog({ open: false, member: null });
    setLuggageDraft("");
  };

  const saveLuggageDraft = () => {
    if (!luggageDialog.member) {
      return;
    }
    setLuggageTextByMember((prev) => ({
      ...prev,
      [luggageDialog.member!.id]: luggageDraft.trim(),
    }));
    closeLuggageDialog();
  };

  const saveItineraryDraft = () => {
    if (!itineraryDialog.member) {
      return;
    }
    const trip = tripMap[itineraryDialog.member.tripId];
    const middleCleaned = extractMiddleItinerary(itineraryDraft)
      .map((item) => ({ date: item.date.trim(), activity: item.activity.trim() }))
      .filter((item) => item.date.length > 0 || item.activity.length > 0);

    const cleaned = buildFixedItinerary(trip, middleCleaned);

    setItineraryByMember((prev) => ({
      ...prev,
      [itineraryDialog.member!.id]: cleaned,
    }));
    closeItineraryDialog();
  };

  const updateItineraryLine = (index: number, patch: Partial<ItineraryItem>) => {
    setItineraryDraft((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    );
  };

  const addItineraryLine = () => {
    setItineraryDraft((prev) => {
      const next = [...prev];
      next.splice(Math.max(1, next.length - 1), 0, { date: "", activity: "" });
      return next;
    });
  };

  const removeItineraryLine = (index: number) => {
    setItineraryDraft((prev) => {
      const isFixed = index === 0 || index === prev.length - 1;
      if (isFixed) {
        return prev;
      }
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const signerFlags = (value: LucitoursSigner) => ({
    includeEdwin: value === "edwin" || value === "both",
    includeErick: value === "erick" || value === "both",
  });

  const getAnnexCutoffAt = (trip?: Trip): string => {
    if (!trip?.dateFrom) {
      return "";
    }
    const start = new Date(`${trip.dateFrom}T00:00:00`);
    if (Number.isNaN(start.getTime())) {
      return "";
    }
    const cutoff = new Date(start.getTime() - ANNEX_CUTOFF_HOURS * 60 * 60 * 1000);
    return cutoff.toISOString();
  };

  const isAnnexPastCutoff = (trip?: Trip) => {
    const cutoffAt = getAnnexCutoffAt(trip);
    return cutoffAt ? new Date().getTime() > new Date(cutoffAt).getTime() : false;
  };

  const formatIsoDate = (value: string) => {
    if (!value) {
      return "";
    }
    return value.slice(0, 10);
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) {
      return "-";
    }
    return new Date(value).toLocaleString();
  };

  const openPreviewDialog = (memberId: string) => {
    setPreviewDialog({ open: true, memberId });
  };

  const closePreviewDialog = () => {
    setPreviewDialog({ open: false, memberId: null });
  };

  const downloadPdfFromText = async (fileBaseName: string, title: string, content: string) => {
    if (!content.trim()) {
      return;
    }

    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginX = 42;
    const marginTop = 48;
    const lineHeight = 14;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(title, marginX, marginTop);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);

    const maxTextWidth = pageWidth - marginX * 2;
    const split = pdf.splitTextToSize(content, maxTextWidth) as string[];

    let y = marginTop + 24;
    split.forEach((line) => {
      if (y > pageHeight - 36) {
        pdf.addPage();
        y = marginTop;
      }
      pdf.text(line, marginX, y);
      y += lineHeight;
    });

    pdf.save(`${fileBaseName}.pdf`);
  };

  const downloadContractPreview = async (member: TripMember, content: string) => {
    const safeName = member.fullName.trim().replace(/\s+/g, "-").toLowerCase() || member.id;
    await downloadPdfFromText(
      `contrato-${safeName}`,
      `Contrato · ${member.fullName}`,
      content,
    );
  };

  const downloadAnnexPreview = async (member: TripMember, content: string) => {
    const safeName = member.fullName.trim().replace(/\s+/g, "-").toLowerCase() || member.id;
    await downloadPdfFromText(
      `anexo-seguro-${safeName}`,
      `Anexo de seguro · ${member.fullName}`,
      content,
    );
  };

  const openDocumentsDialog = (memberId: string) => {
    setDocumentsOwnerFilter("ALL");
    setDocumentsDialog({ open: true, memberId });
  };

  const closeDocumentsDialog = () => {
    setDocumentsOwnerFilter("ALL");
    setDocumentsDialog({ open: false, memberId: null });
  };

  const openAnnexDialog = (memberId: string) => {
    setAnnexDialog({ open: true, memberId });
  };

  const closeAnnexDialog = () => {
    setAnnexDialog({ open: false, memberId: null });
  };

  const sendAnnexToSign = (member: TripMember, trip?: Trip) => {
    if (isAnnexPastCutoff(trip)) {
      return;
    }
    setAnnexStatusByMember((prev) => ({
      ...prev,
      [member.id]: {
        sentAt: prev[member.id]?.sentAt ?? new Date().toISOString(),
        signedAt: prev[member.id]?.signedAt ?? null,
      },
    }));
  };

  const markAnnexSigned = (member: TripMember, trip?: Trip) => {
    if (isAnnexPastCutoff(trip)) {
      return;
    }
    setAnnexStatusByMember((prev) => {
      const sentAt = prev[member.id]?.sentAt ?? new Date().toISOString();
      return {
        ...prev,
        [member.id]: {
          sentAt,
          signedAt: new Date().toISOString(),
        },
      };
    });
  };

  const previewMember = previewDialog.memberId
    ? items.find((item) => item.id === previewDialog.memberId) ?? null
    : null;
  const previewTrip = previewMember ? tripMap[previewMember.tripId] : undefined;
  const previewDraft = previewMember
    ? mapTripMemberToContractDraft(previewMember, previewTrip, {
        itineraryItems: itineraryByMember[previewMember.id],
        requireManualItinerary: true,
        allowedLuggageText: luggageTextByMember[previewMember.id],
        lucitoursSignatories: signerFlags(signerByMember[previewMember.id] ?? "none"),
      })
    : null;
  const previewContractText = previewDraft ? renderContractGeneralPreview(previewDraft.payload) : "";

  const annexMember = annexDialog.memberId
    ? items.find((item) => item.id === annexDialog.memberId) ?? null
    : null;
  const documentsMember = documentsDialog.memberId
    ? items.find((item) => item.id === documentsDialog.memberId) ?? null
    : null;
  const annexTrip = annexMember ? tripMap[annexMember.tripId] : undefined;
  const annexDraft = annexMember
    ? mapTripMemberToContractDraft(annexMember, annexTrip, {
        itineraryItems: itineraryByMember[annexMember.id],
        requireManualItinerary: true,
        allowedLuggageText: luggageTextByMember[annexMember.id],
        lucitoursSignatories: signerFlags(signerByMember[annexMember.id] ?? "none"),
      })
    : null;

  const annexPreviewText = annexMember && annexDraft
    ? renderInsuranceAnnexPreview({
        contractNumber: annexDraft.payload.contract.number,
        annexNumber: buildInsuranceAnnexNumber(annexDraft.payload.contract.number),
        clientFullName: annexMember.fullName,
        clientIdType: toContractIdTypeLabel(annexMember.identificationTypeId),
        clientIdNumber: annexMember.identification,
        tripDestination: annexDraft.payload.trip.destinationCountry,
        tripStartDate: annexDraft.payload.trip.startDate,
        tripEndDate: annexDraft.payload.trip.endDate,
        annexIssuedAt: formatIsoDate(new Date().toISOString()),
        annexSentAt: annexStatusByMember[annexMember.id]?.sentAt
          ? formatDateTime(annexStatusByMember[annexMember.id]?.sentAt)
          : "",
        annexCutoffAt: formatIsoDate(getAnnexCutoffAt(annexTrip)),
        includeEdwin: annexDraft.payload.lucitours.signatories.includeEdwin,
        includeErick: annexDraft.payload.lucitours.signatories.includeErick,
        lucitoursEdwinDate: annexDraft.payload.signatures.lucitoursEdwinDate,
        lucitoursErickDate: annexDraft.payload.signatures.lucitoursErickDate,
        clientDate: annexDraft.payload.signatures.clientDate,
        travelers: [
          {
            travelerName: annexMember.fullName,
            travelerRole: "Titular",
            travelerIdType: toContractIdTypeLabel(annexMember.identificationTypeId),
            travelerIdNumber: annexMember.identification,
            emergencyContactName: annexMember.emergencyContactName,
            emergencyContactPhone: annexMember.emergencyContactPhone,
            wantsInsuranceWithLucitours: annexMember.wantsInsurance,
            provider: insuranceById.get(annexMember.insuranceId) ?? "",
            hasOwnInsurance: annexMember.hasOwnInsurance,
          },
          ...annexMember.companions.map((companion) => ({
            travelerName: companion.fullName || "Acompanante",
            travelerRole: companion.isMinor ? "Acompanante menor" : "Acompanante",
            travelerIdType: toContractIdTypeLabel(
              (companion as { identificationTypeId?: string }).identificationTypeId ??
                annexMember.identificationTypeId,
            ),
            travelerIdNumber: companion.identification,
            emergencyContactName: companion.emergencyContactName,
            emergencyContactPhone: companion.emergencyContactPhone,
            wantsInsuranceWithLucitours: companion.wantsInsurance,
            provider: insuranceById.get(companion.insuranceId) ?? "",
            hasOwnInsurance: companion.hasOwnInsurance,
          })),
        ],
      })
    : "";

  const documentOwnerOptions = useMemo(() => {
    if (!documentsMember) {
      return [] as Array<{ value: DocumentsOwnerFilter; label: string }>;
    }

    const options: Array<{ value: DocumentsOwnerFilter; label: string }> = [
      { value: "ALL", label: "Todos" },
      { value: documentsMember.fullName, label: `Titular: ${documentsMember.fullName}` },
    ];

    const seen = new Set<string>([documentsMember.fullName]);

    documentsMember.companions.forEach((companion) => {
      const name = companion.fullName?.trim();
      if (!name || seen.has(name)) {
        return;
      }
      seen.add(name);
      options.push({ value: name, label: name });
    });

    documentsMember.documents.forEach((doc) => {
      const name = doc.ownerName?.trim();
      if (!name || seen.has(name)) {
        return;
      }
      if (isTitularOwnerName(name, documentsMember.fullName)) {
        return;
      }
      seen.add(name);
      options.push({ value: name, label: name });
    });

    return options;
  }, [documentsMember]);

  const filteredDocuments = useMemo(() => {
    if (!documentsMember) {
      return [];
    }
    return documentsMember.documents.filter((doc) =>
      matchesOwnerFilter(doc.ownerName, documentsOwnerFilter, documentsMember.fullName),
    );
  }, [documentsMember, documentsOwnerFilter]);

  const documentsByType = useMemo(() => {
    if (!documentsMember) {
      return {
        ids: [],
        insurance: [],
        payments: [],
        minorPermits: [],
      };
    }

    const ids = filteredDocuments.filter(
      (doc) => doc.type === "ID_CARD" || doc.type === "PASSPORT",
    );
    const insurance = filteredDocuments.filter((doc) => doc.type === "INSURANCE");
    const payments = filteredDocuments.filter((doc) => doc.type === "PAYMENT_PROOF");
    const minorPermits = filteredDocuments.filter((doc) => doc.type === "MINOR_PERMIT");

    return { ids, insurance, payments, minorPermits };
  }, [documentsMember, filteredDocuments]);

  const selectedOwnerHasOwnInsurance = useMemo(() => {
    if (!documentsMember || documentsOwnerFilter === "ALL") {
      return false;
    }
    if (documentsOwnerFilter === documentsMember.fullName) {
      return documentsMember.hasOwnInsurance === true;
    }
    const companion = documentsMember.companions.find(
      (item) => item.fullName === documentsOwnerFilter,
    );
    return companion?.hasOwnInsurance === true;
  }, [documentsMember, documentsOwnerFilter]);

  const shouldRequireOwnInsuranceProof = Boolean(
    documentsMember &&
      (documentsMember.hasOwnInsurance === true ||
        documentsMember.companions.some((companion) => companion.hasOwnInsurance === true)),
  );

  const pendingContractReminders = useMemo(() => {
    const reminders = items
      .map((member) => ({ memberId: member.id, reminder: getPendingReminder(member) }))
      .filter((entry) => entry.reminder !== null);

    const orange = reminders.filter((entry) => entry.reminder?.severity === "orange").length;
    const red = reminders.filter((entry) => entry.reminder?.severity === "red").length;

    return {
      total: reminders.length,
      orange,
      red,
    };
  }, [items]);

  const visibleItems = useMemo(() => {
    const query = workQueueQuery.trim().toLowerCase();

    return items.filter((member) => {
      const reminder = getPendingReminder(member);

      const passesFilter = (() => {
        if (workQueueFilter === "ALL") {
          return true;
        }
        if (workQueueFilter === "PENDING_SIGNATURE") {
          return member.contractsWorkflowStatus === ContractsWorkflowStatus.SENT_TO_SIGN;
        }
        if (workQueueFilter === "ORANGE") {
          return reminder?.severity === "orange";
        }
        if (workQueueFilter === "RED") {
          return reminder?.severity === "red";
        }
        return true;
      })();

      if (!passesFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        member.fullName,
        member.reservationCode,
        member.quoteCode,
        member.identification,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [items, workQueueFilter, workQueueQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Contratos</h1>
          <p className="text-sm text-slate-600">Envios listos para contratos.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadQueue()}>
          Actualizar
        </Button>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-white p-3 text-xs">
          <p className="font-semibold text-slate-700">Pendientes firma cliente</p>
          <p className="text-lg font-bold text-slate-900">{pendingContractReminders.total}</p>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs">
          <p className="font-semibold text-amber-700">Banderilla naranja (2-3 dias)</p>
          <p className="text-lg font-bold text-amber-800">{pendingContractReminders.orange}</p>
        </div>
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs">
          <p className="font-semibold text-rose-700">Banderilla roja (4+ dias)</p>
          <p className="text-lg font-bold text-rose-800">{pendingContractReminders.red}</p>
        </div>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-3">
        <div className="grid gap-2 md:grid-cols-[220px_1fr]">
          <select
            className="rounded-md border border-slate-300 px-2 py-2 text-xs"
            value={workQueueFilter}
            onChange={(event) => setWorkQueueFilter(event.target.value as WorkQueueFilter)}
          >
            <option value="ALL">Todos</option>
            <option value="PENDING_SIGNATURE">Solo pendientes firma</option>
            <option value="ORANGE">Solo banderilla naranja (2-3 dias)</option>
            <option value="RED">Solo banderilla roja (4+ dias)</option>
          </select>
          <input
            type="text"
            value={workQueueQuery}
            onChange={(event) => setWorkQueueQuery(event.target.value)}
            placeholder="Buscar por pasajero, reserva, cotizacion o identificacion"
            className="rounded-md border border-slate-300 px-3 py-2 text-xs"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-600">Cargando contratos...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">Sin envios pendientes.</p>
      ) : visibleItems.length === 0 ? (
        <p className="text-sm text-slate-600">No hay resultados para el filtro actual.</p>
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-[1100px] w-full border-collapse text-xs">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Pasajero</th>
                <th className="px-3 py-2">Viaje</th>
                <th className="px-3 py-2">Reserva</th>
                <th className="px-3 py-2">Cotizacion</th>
                <th className="px-3 py-2">Enviado por</th>
                <th className="px-3 py-2">Fecha envio</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Contrato gral</th>
                <th className="px-3 py-2">Anexo seguro</th>
                <th className="px-3 py-2">Itinerario</th>
                <th className="px-3 py-2">Firma Lucitours</th>
                <th className="px-3 py-2">Tomado por</th>
                <th className="px-3 py-2">Actualizado</th>
                <th className="px-3 py-2">Accion</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((member) => {
                const trip = tripMap[member.tripId];
                const contractReminder = getPendingReminder(member);
                const draft = mapTripMemberToContractDraft(member, trip, {
                  itineraryItems: itineraryByMember[member.id],
                  requireManualItinerary: true,
                  allowedLuggageText: luggageTextByMember[member.id],
                  lucitoursSignatories: signerFlags(signerByMember[member.id] ?? "none"),
                });
                const isReady = draft.missingFields.length === 0;
                const itineraryCount = itineraryByMember[member.id]?.length ?? 0;
                const annexState = annexStatusByMember[member.id];
                const annexTrip = tripMap[member.tripId];
                const annexPastCutoff = isAnnexPastCutoff(annexTrip);
                const annexStatusLabel = annexState?.signedAt
                  ? "Firmado"
                  : annexState?.sentAt
                    ? "Enviado"
                    : "Borrador";
                const annexStatusClass = annexState?.signedAt
                  ? "bg-emerald-100 text-emerald-700"
                  : annexState?.sentAt
                    ? "bg-sky-100 text-sky-700"
                    : "bg-slate-100 text-slate-700";
                return (
                  <tr key={member.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-900">
                      <div className="flex flex-col gap-1">
                        <span>{member.fullName}</span>
                        {contractReminder ? (
                          <span className={`inline-flex w-fit rounded-full px-2 py-1 text-[11px] font-semibold ${contractReminder.className}`}>
                            {contractReminder.label}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{trip ? trip.name : "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{member.reservationCode || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{member.quoteCode || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {member.contractsSentByUserId
                        ? userById.get(member.contractsSentByUserId) ?? "-"
                        : "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {member.contractsSentAt
                        ? new Date(member.contractsSentAt).toLocaleString()
                        : "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      <select
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                        value={member.contractsWorkflowStatus ?? ""}
                        onChange={(event) =>
                          void handleStatusChange(
                            member,
                            event.target.value as ContractsWorkflowStatus,
                          )
                        }
                        disabled={busyId === member.id}
                      >
                        <option value="">Selecciona</option>
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      <div className="flex flex-col gap-1">
                        <div
                          className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                            isReady
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                          title={
                            isReady
                              ? "Contrato general listo para generar"
                              : draft.missingFields.join(" | ")
                          }
                        >
                          {isReady ? "Listo" : `Pendiente (${draft.missingFields.length})`}
                        </div>
                        <span className="text-[11px] text-slate-500">
                          Estado firma: {getWorkflowStatusLabel(member.contractsWorkflowStatus)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${annexStatusClass}`}>
                          {annexStatusLabel}
                        </span>
                        {annexState?.sentAt ? (
                          <span className="text-[11px] text-slate-500">
                            Enviado: {formatDateTime(annexState.sentAt)}
                          </span>
                        ) : null}
                        {annexPastCutoff ? (
                          <span className="text-[11px] font-semibold text-rose-600">Corte 48h vencido</span>
                        ) : (
                          <span className="text-[11px] text-slate-500">Editable hasta 48h antes</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => openItineraryDialog(member)}
                      >
                        {itineraryCount > 0 ? `Editar (${itineraryCount})` : "Cargar"}
                      </Button>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      <select
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                        value={signerByMember[member.id] ?? "none"}
                        onChange={(event) =>
                          setSignerByMember((prev) => ({
                            ...prev,
                            [member.id]: event.target.value as LucitoursSigner,
                          }))
                        }
                      >
                        <option value="none">Seleccionar</option>
                        <option value="edwin">Edwin</option>
                        <option value="erick">Erick</option>
                        <option value="both">Ambos</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {member.contractsTakenByUserId
                        ? userById.get(member.contractsTakenByUserId) ?? "-"
                        : "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {member.contractsStatusUpdatedAt
                        ? new Date(member.contractsStatusUpdatedAt).toLocaleString()
                        : "-"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        <Link
                          href={`/trips/${member.tripId}?focus=${member.id}`}
                          className="text-xs font-semibold text-cyan-600 hover:underline"
                        >
                          Ver ficha
                        </Link>
                        {canViewClient && member.clientId ? (
                          <Link
                            href={`/clients?clientId=${member.clientId}`}
                            className="text-xs font-semibold text-cyan-600 hover:underline"
                          >
                            Ver cliente
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => openLuggageDialog(member)}
                          className="text-left text-xs font-semibold text-cyan-600 hover:underline"
                        >
                          Editar equipaje
                        </button>
                        <button
                          type="button"
                          onClick={() => openPreviewDialog(member.id)}
                          className="text-left text-xs font-semibold text-cyan-600 hover:underline"
                        >
                          Ver contrato
                        </button>
                        <button
                          type="button"
                          onClick={() => openDocumentsDialog(member.id)}
                          className="text-left text-xs font-semibold text-cyan-600 hover:underline"
                        >
                          Ver documentos
                        </button>
                        <button
                          type="button"
                          onClick={() => openAnnexDialog(member.id)}
                          className="text-left text-xs font-semibold text-cyan-600 hover:underline"
                        >
                          Ver anexo seguro
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={itineraryDialog.open} onOpenChange={(next) => (next ? null : closeItineraryDialog())}>
        <DialogContent className="max-h-[80vh] w-[98vw] max-w-[100rem] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>
              Itinerario manual {itineraryDialog.member ? `· ${itineraryDialog.member.fullName}` : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {itineraryDraft.map((item, index) => (
              (() => {
                const isFixedFlight = index === 0 || index === itineraryDraft.length - 1;
                return (
              <div key={index} className="grid grid-cols-1 gap-2 rounded-md border border-slate-200 p-3 md:grid-cols-[160px_1fr_auto]">
                <input
                  type="date"
                  value={item.date}
                  onChange={(event) => updateItineraryLine(index, { date: event.target.value })}
                  disabled={isFixedFlight}
                  className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
                <textarea
                  value={item.activity}
                  onChange={(event) => updateItineraryLine(index, { activity: event.target.value })}
                  placeholder="Actividad"
                  maxLength={500}
                  disabled={isFixedFlight}
                  className="min-h-[70px] rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
                {isFixedFlight ? (
                  <span className="text-xs font-semibold text-slate-500">Fijo</span>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeItineraryLine(index)}
                  >
                    Quitar
                  </Button>
                )}
              </div>
                );
              })()
            ))}

            <Button type="button" variant="outline" size="sm" onClick={addItineraryLine}>
              Agregar actividad
            </Button>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeItineraryDialog}>
              Cancelar
            </Button>
            <Button type="button" onClick={saveItineraryDraft}>
              Guardar itinerario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewDialog.open} onOpenChange={(next) => (next ? null : closePreviewDialog())}>
        <DialogContent className="max-h-[75vh] w-[98vw] max-w-[110rem] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>
              Contrato {previewMember ? `· ${previewMember.fullName}` : ""}
            </DialogTitle>
          </DialogHeader>

          {previewDraft ? (
            <div className="space-y-3">
              {previewDraft.missingFields.length > 0 ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                  <p className="font-semibold">Campos pendientes antes de enviar a firma:</p>
                  <ul className="mt-2 list-disc pl-4">
                    {previewDraft.missingFields.map((field) => (
                      <li key={field}>{field}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                  Contrato listo para generacion y firma.
                </div>
              )}

              <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700">
                Estado actual: <span className="font-semibold">{getWorkflowStatusLabel(previewMember?.contractsWorkflowStatus)}</span>
              </div>

              <div className="relative rounded-md border border-slate-200 bg-slate-50 p-3">
                <img
                  src="/logo/logo-lucitour.png"
                  alt="Logo Lucitours"
                  className="absolute right-3 top-3 h-10 w-auto object-contain"
                />
                <div className="pt-12 font-mono text-xs leading-5 text-slate-800">
                  {previewContractText
                    .split("\n")
                    .map((line, idx) => (
                      <div
                        key={`${idx}-${line.slice(0, 12)}`}
                        className={`whitespace-pre-wrap ${isClauseHeading(line) ? "font-bold" : ""}`}
                      >
                        {line.length > 0 ? line : "\u00A0"}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600">No se pudo generar el contrato.</p>
          )}

          <DialogFooter>
            {previewMember && previewDraft ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void downloadContractPreview(previewMember, previewContractText)}
                  disabled={
                    previewMember.contractsWorkflowStatus !== ContractsWorkflowStatus.SENT_TO_SIGN &&
                    previewMember.contractsWorkflowStatus !== ContractsWorkflowStatus.APPROVED
                  }
                  title={
                    previewMember.contractsWorkflowStatus === ContractsWorkflowStatus.SENT_TO_SIGN ||
                    previewMember.contractsWorkflowStatus === ContractsWorkflowStatus.APPROVED
                      ? "Descargar PDF del contrato"
                      : "Debes enviar el contrato a firma antes de descargar"
                  }
                >
                  Descargar contrato
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    void handleStatusChange(previewMember, ContractsWorkflowStatus.SENT_TO_SIGN)
                  }
                  disabled={
                    previewDraft.missingFields.length > 0 ||
                    previewMember.contractsWorkflowStatus === ContractsWorkflowStatus.SENT_TO_SIGN ||
                    previewMember.contractsWorkflowStatus === ContractsWorkflowStatus.APPROVED ||
                    busyId === previewMember.id
                  }
                >
                  Enviar contrato a firma
                </Button>
                <Button
                  type="button"
                  onClick={() =>
                    void handleStatusChange(previewMember, ContractsWorkflowStatus.APPROVED)
                  }
                  disabled={
                    previewMember.contractsWorkflowStatus !== ContractsWorkflowStatus.SENT_TO_SIGN ||
                    busyId === previewMember.id
                  }
                >
                  Marcar contrato firmado
                </Button>
              </>
            ) : null}
            <Button type="button" variant="outline" onClick={closePreviewDialog}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={annexDialog.open} onOpenChange={(next) => (next ? null : closeAnnexDialog())}>
        <DialogContent className="max-h-[75vh] w-[98vw] max-w-[110rem] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>
              Anexo de seguro {annexMember ? `· ${annexMember.fullName}` : ""}
            </DialogTitle>
          </DialogHeader>

          {annexMember && annexTrip ? (
            <div className="space-y-3">
              {isAnnexPastCutoff(annexTrip) ? (
                <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700">
                  La ventana de actualizacion del anexo ya vencio (48h antes del inicio del tour).
                </div>
              ) : (
                <div className="rounded-md border border-sky-300 bg-sky-50 p-3 text-xs text-sky-700">
                  Este anexo se puede actualizar y enviar a firma hasta 48 horas antes del inicio del tour.
                </div>
              )}

              <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700">
                <p>
                  Numero de anexo: <span className="font-semibold">{buildInsuranceAnnexNumber(annexDraft?.payload.contract.number || "")}</span>
                </p>
                <p>
                  Enviado a firma: <span className="font-semibold">{formatDateTime(annexStatusByMember[annexMember.id]?.sentAt)}</span>
                </p>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="font-mono text-xs leading-5 text-slate-800">
                  {annexPreviewText
                    .split("\n")
                    .map((line, idx) => (
                      <div key={`${idx}-${line.slice(0, 12)}`} className="whitespace-pre-wrap">
                        {line.length > 0 ? line : "\u00A0"}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600">No se pudo generar el anexo.</p>
          )}

          <DialogFooter>
            {annexMember && annexTrip ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void downloadAnnexPreview(annexMember, annexPreviewText)}
                  disabled={!annexStatusByMember[annexMember.id]?.sentAt}
                  title={
                    annexStatusByMember[annexMember.id]?.sentAt
                      ? "Descargar PDF del anexo"
                      : "Debes enviar el anexo a firma antes de descargar"
                  }
                >
                  Descargar PDF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => sendAnnexToSign(annexMember, annexTrip)}
                  disabled={
                    isAnnexPastCutoff(annexTrip) ||
                    Boolean(annexStatusByMember[annexMember.id]?.sentAt)
                  }
                >
                  Enviar a firma
                </Button>
                <Button
                  type="button"
                  onClick={() => markAnnexSigned(annexMember, annexTrip)}
                  disabled={
                    isAnnexPastCutoff(annexTrip) ||
                    !annexStatusByMember[annexMember.id]?.sentAt ||
                    Boolean(annexStatusByMember[annexMember.id]?.signedAt)
                  }
                >
                  Marcar firmado
                </Button>
              </>
            ) : null}
            <Button type="button" variant="outline" onClick={closeAnnexDialog}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={documentsDialog.open} onOpenChange={(next) => (next ? null : closeDocumentsDialog())}>
        <DialogContent className="max-h-[75vh] w-[96vw] max-w-5xl overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>
              Documentos recibidos {documentsMember ? `· ${documentsMember.fullName}` : ""}
            </DialogTitle>
          </DialogHeader>

          {documentsMember ? (
            <div className="space-y-4 text-xs">
              <div className="grid gap-2 md:grid-cols-4">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                  <p className="font-semibold text-slate-700">Identificaciones</p>
                  <p className="text-slate-600">{documentsByType.ids.length}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                  <p className="font-semibold text-slate-700">Respaldo seguro</p>
                  <p className="text-slate-600">{documentsByType.insurance.length}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                  <p className="font-semibold text-slate-700">Comprobantes pago</p>
                  <p className="text-slate-600">{documentsByType.payments.length}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                  <p className="font-semibold text-slate-700">Permisos menor</p>
                  <p className="text-slate-600">{documentsByType.minorPermits.length}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">Filtrar por persona</label>
                <select
                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs md:hidden"
                  value={documentsOwnerFilter}
                  onChange={(event) => setDocumentsOwnerFilter(event.target.value as DocumentsOwnerFilter)}
                >
                  {documentOwnerOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="hidden flex-wrap gap-2 md:flex">
                  {documentOwnerOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setDocumentsOwnerFilter(option.value)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        documentsOwnerFilter === option.value
                          ? "border-cyan-300 bg-cyan-50 text-cyan-700"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {((documentsOwnerFilter === "ALL" && shouldRequireOwnInsuranceProof) ||
                (documentsOwnerFilter !== "ALL" && selectedOwnerHasOwnInsurance)) &&
              documentsByType.insurance.length === 0 ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-800">
                  {documentsOwnerFilter === "ALL"
                    ? "El pasajero o un acompanante indico seguro propio, pero no hay documento de respaldo cargado."
                    : "La persona seleccionada indico seguro propio, pero no hay documento de respaldo cargado."}
                </div>
              ) : null}

              {filteredDocuments.length === 0 ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-800">
                  {documentsOwnerFilter === "ALL"
                    ? "Este pasajero aun no tiene documentos cargados por agentes."
                    : "La persona seleccionada aun no tiene documentos cargados por agentes."}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredDocuments.map((doc) => (
                    <div key={doc.id} className="rounded-md border border-slate-200 bg-white p-3">
                      <p className="font-semibold text-slate-800">{DOC_TYPE_LABEL[doc.type]}</p>
                      <p className="text-slate-700">Archivo: {doc.fileName}</p>
                      <p className="text-slate-700">Corresponde a: {doc.ownerName || "-"}</p>
                      {doc.concept ? <p className="text-slate-600">Concepto: {doc.concept}</p> : null}
                      {doc.conceptOther ? <p className="text-slate-600">Detalle: {doc.conceptOther}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-600">No se pudo cargar la informacion de documentos.</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDocumentsDialog}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={luggageDialog.open} onOpenChange={(next) => (next ? null : closeLuggageDialog())}>
        <DialogContent className="max-h-[65vh] w-[92vw] max-w-3xl overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>
              Equipaje permitido {luggageDialog.member ? `· ${luggageDialog.member.fullName}` : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-xs text-slate-600">
              Este texto se inserta en la clausula SETIMO del contrato para este pasajero.
            </p>
            <textarea
              value={luggageDraft}
              onChange={(event) => setLuggageDraft(event.target.value)}
              maxLength={500}
              placeholder="Ejemplo: 1 articulo personal de hasta 10 kg y 1 maleta carry-on de hasta 10 kg..."
              className="min-h-[130px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeLuggageDialog}>
              Cancelar
            </Button>
            <Button type="button" onClick={saveLuggageDraft}>
              Guardar equipaje
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
