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
import { useSession } from "@/lib/auth/sessionContext";
import {
  ContractsWorkflowStatus,
  DocsStatus,
  PassportStatus,
  Role,
  type CatalogItem,
  type AdultContractCase,
  type DocumentType,
  type DocumentUpload,
  type Trip,
  type TripMember,
} from "@/lib/types/ops";
import { mapTripMemberToContractDraft } from "@/lib/contracts/contractMapper";
import {
  renderContractGeneralPreview,
} from "@/lib/contracts/renderContractTemplate";
import {
  renderMinorPermitAnnexPreview,
} from "@/lib/contracts/renderMinorPermitAnnexTemplate";

type ItineraryItem = { date: string; activity: string };
type LucitoursSigner = "none" | "edwin" | "erick";
type MinorPermitStatusByAnnex = Record<
  string,
  {
    guardianSentAt: string | null;
    guardianSignedAt: string | null;
    adultSentAt: string | null;
    adultSignedAt: string | null;
  }
>;
type DocumentsOwnerFilter = "ALL" | string;
type WorkQueueFilter = "ALL" | "PENDING_SIGNATURE" | "ORANGE" | "RED";
type DocumentSaveState = "idle" | "saving" | "saved" | "error";
type AdultTravelerDescriptor = {
  travelerKey: string;
  fullName: string;
  email: string;
  identificationTypeId: string;
  identification: string;
  phone: string;
  address: string;
  maritalStatus: TripMember["maritalStatus"];
  nationalityId: string;
  profession: string;
  wantsInsurance: boolean | null;
  hasOwnInsurance: boolean | null;
  emergencyContactName: string;
  emergencyContactPhone: string;
  isTitular: boolean;
  indexLabel: string;
};

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

const belongsToOwner = (docOwnerName: string, ownerName: string, titularFullName: string) => {
  if (ownerName === titularFullName) {
    return isTitularOwnerName(docOwnerName, titularFullName);
  }
  return normalizeOwnerName(docOwnerName) === normalizeOwnerName(ownerName);
};

const resolveGuardianFromMember = (
  member: TripMember,
  minorCompanion: TripMember["companions"][number],
) => {
  const requestedGuardianName =
    minorCompanion.guardianFullName?.trim() || minorCompanion.emergencyContactName?.trim() || "";
  const requestedGuardianPhone =
    minorCompanion.guardianPhone?.trim() || minorCompanion.emergencyContactPhone?.trim() || "";

  if (!requestedGuardianName || isTitularOwnerName(requestedGuardianName, member.fullName)) {
    return {
      guardianName: member.fullName,
      guardianIdType: member.identificationTypeId,
      guardianIdNumber: member.identification,
      guardianPhone: requestedGuardianPhone || member.phone,
      travelingAdultName: member.fullName,
      travelingAdultIdType: member.identificationTypeId,
      travelingAdultIdNumber: member.identification,
      travelingAdultPhone: member.phone,
    };
  }

  const adultCompanion = member.companions.find(
    (candidate) =>
      !candidate.isMinor &&
      normalizeOwnerName(candidate.fullName || "") === normalizeOwnerName(requestedGuardianName),
  );

  if (adultCompanion) {
    const preferredTravelingAdult = minorCompanion.travelingAdultCompanionId
      ? member.companions.find(
          (candidate) =>
            !candidate.isMinor && candidate.id === minorCompanion.travelingAdultCompanionId,
        )
      : undefined;
    const travelingAdultByName = minorCompanion.travelingAdultName?.trim()
      ? member.companions.find(
          (candidate) =>
            !candidate.isMinor &&
            normalizeOwnerName(candidate.fullName || "") ===
              normalizeOwnerName(minorCompanion.travelingAdultName || ""),
        )
      : undefined;
    const travelingAdult = preferredTravelingAdult || travelingAdultByName || adultCompanion;

    return {
      guardianName: adultCompanion.fullName || requestedGuardianName,
      guardianIdType:
        adultCompanion.guardianIdTypeId || adultCompanion.identificationTypeId || member.identificationTypeId,
      guardianIdNumber:
        adultCompanion.guardianIdNumber || adultCompanion.identification || member.identification,
      guardianPhone: adultCompanion.phone || requestedGuardianPhone || member.phone,
      travelingAdultName: travelingAdult.fullName || member.fullName,
      travelingAdultIdType: travelingAdult.identificationTypeId || member.identificationTypeId,
      travelingAdultIdNumber: travelingAdult.identification || member.identification,
      travelingAdultPhone: travelingAdult.phone || member.phone,
    };
  }

  const preferredTravelingAdult = minorCompanion.travelingAdultCompanionId
    ? member.companions.find(
        (candidate) => !candidate.isMinor && candidate.id === minorCompanion.travelingAdultCompanionId,
      )
    : undefined;

  return {
    guardianName: requestedGuardianName,
    guardianIdType: minorCompanion.guardianIdTypeId || member.identificationTypeId,
    guardianIdNumber: minorCompanion.guardianIdNumber || member.identification,
    guardianPhone: requestedGuardianPhone || member.phone,
    travelingAdultName:
      preferredTravelingAdult?.fullName || minorCompanion.travelingAdultName || member.fullName,
    travelingAdultIdType:
      preferredTravelingAdult?.identificationTypeId || member.identificationTypeId,
    travelingAdultIdNumber:
      preferredTravelingAdult?.identification || member.identification,
    travelingAdultPhone: preferredTravelingAdult?.phone || member.phone,
  };
};

const ANNEX_CUTOFF_HOURS = 48;

const OUTBOUND_ACTIVITY = "Vuelo de ida al destino.";
const RETURN_ACTIVITY = "Vuelo de vuelta al pais de origen.";
const DOC_TYPE_LABEL: Record<DocumentType, string> = {
  ID_CARD: "Cedula / identificacion",
  PASSPORT: "Pasaporte",
  MINOR_PERMIT: "Permiso de menor",
  INSURANCE: "Respaldo de seguro",
  PAYMENT_PROOF: "Comprobante de pago",
};

const escapePreviewHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderPlainPreviewHtml = (text: string): string => `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Vista previa contrato</title>
    <style>
      body {
        margin: 0;
        background: #f8fafc;
        color: #0f172a;
        font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      }

      .content {
        margin: 0 auto;
        max-width: 980px;
        padding: 24px;
        font-size: 13px;
        line-height: 1.55;
        white-space: pre-wrap;
      }
    </style>
  </head>
  <body>
    <pre class="content">${escapePreviewHtml(text)}</pre>
  </body>
</html>`;

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

const buildMinorPermitAnnexNumber = (contractNumber: string, minorName: string) => {
  const contractPart = (contractNumber || "SIN-CONTRATO").replace(/\s+/g, "-").toUpperCase();
  const minorPart = (minorName || "SIN-MENOR")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toUpperCase();
  return `ANX-MEN-${contractPart}-${minorPart}`;
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
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [identificationTypeCatalog, setIdentificationTypeCatalog] = useState<CatalogItem[]>([]);
  const [nationalityCatalog, setNationalityCatalog] = useState<CatalogItem[]>([]);
  const [signerByMember, setSignerByMember] = useState<Record<string, LucitoursSigner>>({});
  const [previewDialog, setPreviewDialog] = useState<{ open: boolean; memberId: string | null }>({
    open: false,
    memberId: null,
  });
  const [previewTravelerKey, setPreviewTravelerKey] = useState<string>("");
  const [documentsDialog, setDocumentsDialog] = useState<{ open: boolean; memberId: string | null }>({
    open: false,
    memberId: null,
  });
  const [documentSaveStateById, setDocumentSaveStateById] = useState<
    Record<string, { state: DocumentSaveState; message?: string }>
  >({});
  const [documentsOwnerFilter, setDocumentsOwnerFilter] = useState<DocumentsOwnerFilter>("ALL");
  
  const [minorPermitDialog, setMinorPermitDialog] = useState<{ open: boolean; memberId: string | null }>({
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
  const [minorPermitStatusByAnnex, setMinorPermitStatusByAnnex] = useState<MinorPermitStatusByAnnex>({});
  const [emailBusyKey, setEmailBusyKey] = useState<string | null>(null);
  const [workQueueFilter, setWorkQueueFilter] = useState<WorkQueueFilter>("ALL");
  const [workQueueQuery, setWorkQueueQuery] = useState("");
  const canViewClient = user.role === Role.ADMIN || user.role === Role.CONTRACTS;

  const identificationById = useMemo(() => {
    const map = new Map<string, string>();
    identificationTypeCatalog.forEach((item) => map.set(item.id, item.name));
    return map;
  }, [identificationTypeCatalog]);

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

  const getAdultTravelers = (member: TripMember): AdultTravelerDescriptor[] => [
    {
      travelerKey: `titular:${member.id}`,
      fullName: member.fullName,
      email: member.email,
      identificationTypeId: member.identificationTypeId,
      identification: member.identification,
      phone: member.phone,
      address: member.address,
      maritalStatus: member.maritalStatus,
      nationalityId: member.nationalityId,
      profession: member.profession,
      wantsInsurance: member.wantsInsurance,
      hasOwnInsurance: member.hasOwnInsurance,
      emergencyContactName: member.emergencyContactName,
      emergencyContactPhone: member.emergencyContactPhone,
      isTitular: true,
      indexLabel: "TITULAR",
    },
    ...member.companions
      .filter((companion) => !companion.isMinor)
      .map((companion, index) => ({
        travelerKey: `companion:${companion.id}`,
        fullName: companion.fullName || `Acompanante ${index + 1}`,
        email: companion.email,
        identificationTypeId: companion.identificationTypeId || member.identificationTypeId,
        identification: companion.identification,
        phone: companion.phone,
        address: companion.address,
        maritalStatus: companion.maritalStatus,
        nationalityId: companion.nationalityId,
        profession: companion.profession,
        wantsInsurance: companion.wantsInsurance,
        hasOwnInsurance: companion.hasOwnInsurance,
        emergencyContactName: companion.emergencyContactName,
        emergencyContactPhone: companion.emergencyContactPhone,
        isTitular: false,
        indexLabel: `ACOMP-${index + 1}`,
      })),
  ];

  const getAdultContractCases = (member: TripMember): AdultContractCase[] => {
    const byTraveler = new Map((member.adultContractCases ?? []).map((item) => [item.travelerKey, item]));

    return getAdultTravelers(member).map((traveler) => {
      const existing = byTraveler.get(traveler.travelerKey);
      return {
        travelerKey: traveler.travelerKey,
        travelerName: traveler.fullName,
        travelerEmail: traveler.email,
        isTitular: traveler.isTitular,
        sentAt: existing?.sentAt ?? null,
        signedFileName: existing?.signedFileName ?? null,
        signedUploadedAt: existing?.signedUploadedAt ?? null,
      };
    });
  };

  const getMissingAdultContractLabels = (member: TripMember) =>
    getAdultContractCases(member)
      .filter((item) => !item.signedFileName)
      .map((item) => `Contrato firmado de ${item.travelerName}`);

  const getTravelersForValidation = (member: TripMember) => [
    {
      ownerName: member.fullName,
      idTypeLabel: toContractIdTypeLabel(member.identificationTypeId),
    },
    ...member.companions.map((companion) => ({
      ownerName: companion.fullName || "Acompanante",
      idTypeLabel: toContractIdTypeLabel(
        (companion as { identificationTypeId?: string }).identificationTypeId ??
          member.identificationTypeId,
      ),
    })),
  ];

  const getCedulaBlockingIssues = (member: TripMember) => {
    const issues: string[] = [];
    const travelers = getTravelersForValidation(member);

    travelers.forEach((traveler) => {
      if (traveler.idTypeLabel === "Pasaporte") {
        return;
      }

      const idDoc = member.documents.find(
        (doc) =>
          doc.type === "ID_CARD" && belongsToOwner(doc.ownerName, traveler.ownerName, member.fullName),
      );

      if (!idDoc) {
        issues.push(`${traveler.ownerName}: falta cedula/identificacion.`);
        return;
      }

      if (idDoc.idIsValid !== true) {
        issues.push(`${traveler.ownerName}: cedula vencida o no validada.`);
      }

      if (idDoc.idSignatureMatches !== true) {
        issues.push(`${traveler.ownerName}: firma de cedula no coincide o no validada.`);
      }
    });

    return issues;
  };

  const getPassportPendingItems = (member: TripMember) => {
    const pending: string[] = [];
    const travelers = getTravelersForValidation(member);

    travelers.forEach((traveler) => {
      const passportDoc = member.documents.find(
        (doc) =>
          doc.type === "PASSPORT" && belongsToOwner(doc.ownerName, traveler.ownerName, member.fullName),
      );

      if (!passportDoc) {
        pending.push(`${traveler.ownerName}: pasaporte pendiente.`);
        return;
      }

      if (passportDoc.passportIsValid !== true) {
        pending.push(`${traveler.ownerName}: pasaporte vencido/no validado.`);
      }
    });

    return pending;
  };

  const getAnnexRequirements = (member: TripMember) => {
    const requiresMinorAnnex = member.companions.some((companion) => companion.isMinor);

    const missingUploadLabels: string[] = [];
    if (requiresMinorAnnex && !member.signedMinorAnnexFileName) {
      missingUploadLabels.push("Anexo de menor firmado");
    }

    return {
      requiresMinorAnnex,
      missingUploadLabels,
    };
  };

  const userById = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((user) => map.set(user.id, user.name));
    return map;
  }, [users]);

  const loadQueue = async () => {
    setIsLoading(true);
    const [queueMembers, trips, billingConfig, idTypes, nationalities] = await Promise.all([
      repo.listContractsQueue(),
      repo.listTrips(),
      repo.getBillingConfig(),
      repo.listCatalog("identificationTypes"),
      repo.listCatalog("nationalities"),
    ]);

    const nextTripMap = trips.reduce<Record<string, Trip>>((acc, trip) => {
      acc[trip.id] = trip;
      return acc;
    }, {});

    setTripMap(nextTripMap);
    setItems(queueMembers);
    setExchangeRate(billingConfig.exchangeRate);
    setIdentificationTypeCatalog(idTypes);
    setNationalityCatalog(nationalities);
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
    if (status === ContractsWorkflowStatus.SENT_TO_SIGN) {
      const blockingIssues = getCedulaBlockingIssues(member);
      if (blockingIssues.length > 0) {
        window.alert(
          `No se puede enviar a firma hasta validar cedulas.\n\n${blockingIssues.join("\n")}`,
        );
        return;
      }
    }

    if (status === ContractsWorkflowStatus.APPROVED) {
      const missingCloseRequirements: string[] = [];
      missingCloseRequirements.push(...getMissingAdultContractLabels(member));
      missingCloseRequirements.push(...getAnnexRequirements(member).missingUploadLabels);
      if (missingCloseRequirements.length > 0) {
        window.alert(
          `No se puede cerrar contrato hasta cargar firmados requeridos.\n\n${missingCloseRequirements.join("\n")}`,
        );
        return;
      }
    }

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

  const uploadSignedFile = async (
    member: TripMember,
    patch: Partial<TripMember>,
  ) => {
    const now = new Date().toISOString();
    const optimistic: TripMember = {
      ...member,
      ...patch,
      updatedAt: now,
    };

    setItems((prev) => prev.map((item) => (item.id === member.id ? optimistic : item)));

    const updated = await repo.updateTripMember(member.tripId, member.id, {
      ...patch,
      updatedAt: now,
    });

    if (updated) {
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    }
  };

  const upsertAdultContractCase = async (
    member: TripMember,
    travelerKey: string,
    patch: Partial<AdultContractCase>,
  ) => {
    const now = new Date().toISOString();
    const current = getAdultContractCases(member);
    const nextCases = current.map((item) =>
      item.travelerKey === travelerKey
        ? {
            ...item,
            ...patch,
          }
        : item,
    );

    const optimistic: TripMember = {
      ...member,
      adultContractCases: nextCases,
      updatedAt: now,
    };

    setItems((prev) => prev.map((item) => (item.id === member.id ? optimistic : item)));

    const updated = await repo.updateTripMember(member.tripId, member.id, {
      adultContractCases: nextCases,
      updatedAt: now,
    });

    if (updated) {
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    }
  };

  const updateDocumentReview = async (
    member: TripMember,
    documentId: string,
    patch: Partial<DocumentUpload>,
  ) => {
    setDocumentSaveStateById((prev) => ({
      ...prev,
      [documentId]: { state: "saving", message: "Guardando cambios..." },
    }));

    const now = new Date().toISOString();
    const nextDocuments = member.documents.map((doc) =>
      doc.id === documentId
        ? {
            ...doc,
            ...patch,
            reviewedByUserId: user.id,
            reviewedAt: now,
          }
        : doc,
    );

    const nextPassportStatus = nextDocuments.some(
      (doc) => doc.type === "PASSPORT" && doc.passportIsValid === true,
    )
      ? PassportStatus.ENTERED
      : PassportStatus.NOT_ENTERED;

    const nextDocsStatus = nextDocuments.length > 0 ? DocsStatus.UPLOADED : DocsStatus.NOT_UPLOADED;

    const optimistic: TripMember = {
      ...member,
      documents: nextDocuments,
      passportStatus: nextPassportStatus,
      docsStatus: nextDocsStatus,
      contractsWorkflowStatus:
        member.contractsWorkflowStatus === ContractsWorkflowStatus.SENT_TO_SIGN &&
        getCedulaBlockingIssues({ ...member, documents: nextDocuments }).length > 0
          ? ContractsWorkflowStatus.INFO_PENDING
          : member.contractsWorkflowStatus,
      contractsStatusUpdatedAt: now,
      updatedAt: now,
    };

    setItems((prev) => prev.map((item) => (item.id === member.id ? optimistic : item)));

    try {
      const updated = await repo.updateTripMember(member.tripId, member.id, {
        documents: nextDocuments,
        passportStatus: nextPassportStatus,
        docsStatus: nextDocsStatus,
        contractsWorkflowStatus: optimistic.contractsWorkflowStatus,
        contractsStatusUpdatedAt: now,
        updatedAt: now,
      });

      if (updated) {
        setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      }

      setDocumentSaveStateById((prev) => ({
        ...prev,
        [documentId]: { state: "saved", message: "Guardado" },
      }));

      window.setTimeout(() => {
        setDocumentSaveStateById((prev) => {
          const current = prev[documentId];
          if (!current || current.state !== "saved") {
            return prev;
          }
          return {
            ...prev,
            [documentId]: { state: "idle" },
          };
        });
      }, 1800);
    } catch {
      setItems((prev) => prev.map((item) => (item.id === member.id ? member : item)));
      setDocumentSaveStateById((prev) => ({
        ...prev,
        [documentId]: { state: "error", message: "No se pudo guardar. Intenta de nuevo." },
      }));
    }
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
    includeEdwin: value === "edwin",
    includeErick: value === "erick",
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

  const openPreviewDialog = (member: TripMember) => {
    const adults = getAdultTravelers(member);
    setPreviewTravelerKey(adults[0]?.travelerKey ?? "");
    setPreviewDialog({ open: true, memberId: member.id });
  };

  const closePreviewDialog = () => {
    setPreviewDialog({ open: false, memberId: null });
    setPreviewTravelerKey("");
  };

  const buildPdfFromText = async (title: string, content: string): Promise<Uint8Array | null> => {
    const normalizedContent = content
      .replace(/^[ \t]*#{1,6}[ \t]*/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!normalizedContent) {
      return null;
    }

    const { jsPDF } = await import("jspdf");

    const toDataUrl = async (path: string): Promise<string | null> => {
      try {
        const response = await fetch(path);
        if (!response.ok) {
          return null;
        }
        const blob = await response.blob();
        return await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      } catch {
        return null;
      }
    };

    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginX = 42;
    const headerHeight = 64;
    const footerHeight = 42;
    const contentTop = headerHeight + 26;
    const contentBottom = pageHeight - footerHeight - 18;
    const lineHeight = 14.5;
    const logoDataUrl = await toDataUrl("/logo/logo-lucitour.png");

    const drawPageChrome = (pageNumber: number) => {
      if (logoDataUrl) {
        pdf.addImage(logoDataUrl, "PNG", marginX, 14, 77, 28);
      }

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(71, 85, 105);
      pdf.text("VIAJES LUCITOURS TURISMO INTERNACIONAL", pageWidth - marginX, 24, {
        align: "right",
      });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.text("3-101-874546", pageWidth - marginX, 36, { align: "right" });
      pdf.text("+506 6015-9906", pageWidth - marginX, 47, { align: "right" });
      pdf.text("lucitours1211@gmail.com", pageWidth - marginX, 58, { align: "right" });

      pdf.setDrawColor(226, 232, 240);
      pdf.line(marginX, headerHeight, pageWidth - marginX, headerHeight);

      const footerY = pageHeight - footerHeight;
      pdf.line(marginX, footerY, pageWidth - marginX, footerY);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text("Documento contractual generado por Lucitours.", marginX, footerY + 16);

      pdf.setDrawColor(167, 243, 208);
      pdf.setFillColor(236, 253, 245);
      const badgeWidth = 98;
      const badgeX = pageWidth - marginX - badgeWidth;
      pdf.roundedRect(badgeX, footerY + 7, badgeWidth, 17, 8, 8, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(6, 95, 70);
      pdf.text("AFILIADO A CANATUR", badgeX + badgeWidth / 2, footerY + 18, {
        align: "center",
      });

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Pag. ${pageNumber}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    };

    drawPageChrome(1);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    const titleLines = pdf.splitTextToSize(title, pageWidth - marginX * 2) as string[];

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);

    const maxTextWidth = pageWidth - marginX * 2;
    const split = pdf.splitTextToSize(normalizedContent, maxTextWidth) as string[];

    let y = contentTop;

    titleLines.forEach((line) => {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text(line, marginX, y);
      y += lineHeight;
    });

    y += 6;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);

    let pageNumber = 1;
    split.forEach((line) => {
      if (y > contentBottom) {
        pdf.addPage();
        pageNumber += 1;
        drawPageChrome(pageNumber);
        y = contentTop;
      }
      pdf.text(line, marginX, y);
      y += lineHeight;
    });

    return new Uint8Array(pdf.output("arraybuffer"));
  };

  const bytesToBase64 = (bytes: Uint8Array): string => {
    const chunkSize = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  };

  const downloadPdfDocument = (fileBaseName: string, pdfBytes: Uint8Array) => {
    const normalized = Uint8Array.from(pdfBytes);
    const blob = new Blob([normalized.buffer], { type: "application/pdf" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `${fileBaseName}.pdf`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  };

  const sendPdfByEmail = async (
    params: {
      busyKey: string;
      toEmail: string;
      recipientName: string;
      subject: string;
      messageText: string;
      fileName: string;
      pdfBytes: Uint8Array;
    },
  ): Promise<boolean> => {
    if (!params.toEmail?.trim()) {
      window.alert("Esta persona no tiene correo registrado.");
      return false;
    }

    setEmailBusyKey(params.busyKey);
    try {
      const response = await fetch("/api/contracts/send-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: params.toEmail.trim(),
          subject: params.subject,
          messageText: params.messageText,
          fileName: params.fileName,
          pdfBase64: bytesToBase64(params.pdfBytes),
        }),
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        window.alert(data?.error || "No se pudo enviar el correo.");
        return false;
      }

      window.alert(`PDF enviado por correo a ${params.recipientName} (${params.toEmail}).`);
      return true;
    } catch {
      window.alert("Error inesperado enviando el correo.");
      return false;
    } finally {
      setEmailBusyKey(null);
    }
  };

  const downloadContractPreview = async (member: TripMember, content: string) => {
    const safeName = member.fullName.trim().replace(/\s+/g, "-").toLowerCase() || member.id;
    const pdfBytes = await buildPdfFromText(`Contrato · ${member.fullName}`, content);
    if (!pdfBytes) {
      return;
    }
    downloadPdfDocument(`contrato-${safeName}`, pdfBytes);
  };

  const emailContractPreview = async (
    member: TripMember,
    traveler: AdultTravelerDescriptor,
    content: string,
  ) => {
    const safeName = traveler.fullName.trim().replace(/\s+/g, "-").toLowerCase() || member.id;
    const pdfBytes = await buildPdfFromText(`Contrato · ${traveler.fullName}`, content);
    if (!pdfBytes) {
      return;
    }
    const sent = await sendPdfByEmail({
      busyKey: `contract:${member.id}:${traveler.travelerKey}`,
      toEmail: traveler.email,
      recipientName: traveler.fullName,
      subject: `Contrato para firma · ${traveler.fullName}`,
      messageText:
        "Adjuntamos su contrato en PDF para que pueda revisarlo, firmarlo y devolverlo por este mismo medio.",
      fileName: `contrato-${safeName}.pdf`,
      pdfBytes,
    });

    if (
      sent &&
      member.contractsWorkflowStatus !== ContractsWorkflowStatus.SENT_TO_SIGN &&
      member.contractsWorkflowStatus !== ContractsWorkflowStatus.APPROVED
    ) {
      await handleStatusChange(member, ContractsWorkflowStatus.SENT_TO_SIGN);
    }

    if (sent) {
      await upsertAdultContractCase(member, traveler.travelerKey, {
        sentAt: new Date().toISOString(),
      });
    }
  };


  const downloadMinorPermitPreview = async (
    member: TripMember,
    minorName: string,
    content: string,
  ) => {
    const safeMember = member.fullName.trim().replace(/\s+/g, "-").toLowerCase() || member.id;
    const safeMinor = minorName.trim().replace(/\s+/g, "-").toLowerCase() || "menor";
    const pdfBytes = await buildPdfFromText(`Anexo autorizacion menor · ${minorName}`, content);
    if (!pdfBytes) {
      return;
    }
    downloadPdfDocument(`anexo-menor-${safeMember}-${safeMinor}`, pdfBytes);
  };

  const emailMinorPermitPreview = async (
    member: TripMember,
    annexNumber: string,
    minorName: string,
    recipient: "guardian" | "adult",
    toEmail: string,
    recipientName: string,
    content: string,
  ) => {
    const safeMember = member.fullName.trim().replace(/\s+/g, "-").toLowerCase() || member.id;
    const safeMinor = minorName.trim().replace(/\s+/g, "-").toLowerCase() || "menor";
    const pdfBytes = await buildPdfFromText(`Anexo autorizacion menor · ${minorName}`, content);
    if (!pdfBytes) {
      return;
    }
    const sent = await sendPdfByEmail({
      busyKey: `minor:${annexNumber}:${recipient}`,
      toEmail,
      recipientName,
      subject: `Anexo de menor para firma · ${minorName}`,
      messageText:
        "Adjuntamos el anexo de autorizacion de menor en PDF para firma y devolucion.",
      fileName: `anexo-menor-${safeMember}-${safeMinor}.pdf`,
      pdfBytes,
    });

    if (sent) {
      setMinorPermitStatusByAnnex((prev) => ({
        ...prev,
        [annexNumber]: {
          guardianSentAt:
            recipient === "guardian"
              ? (prev[annexNumber]?.guardianSentAt ?? new Date().toISOString())
              : (prev[annexNumber]?.guardianSentAt ?? null),
          guardianSignedAt: prev[annexNumber]?.guardianSignedAt ?? null,
          adultSentAt:
            recipient === "adult"
              ? (prev[annexNumber]?.adultSentAt ?? new Date().toISOString())
              : (prev[annexNumber]?.adultSentAt ?? null),
          adultSignedAt: prev[annexNumber]?.adultSignedAt ?? null,
        },
      }));
    }
  };

  const openDocumentsDialog = (memberId: string) => {
    setDocumentsOwnerFilter("ALL");
    setDocumentsDialog({ open: true, memberId });
  };

  const closeDocumentsDialog = () => {
    setDocumentsOwnerFilter("ALL");
    setDocumentSaveStateById({});
    setDocumentsDialog({ open: false, memberId: null });
  };
  const openMinorPermitDialog = (memberId: string) => {
    setMinorPermitDialog({ open: true, memberId });
  };
  const closeMinorPermitDialog = () => {
    setMinorPermitDialog({ open: false, memberId: null });
  };
  const markMinorPermitSigned = (
    annexNumber: string,
    signer: "guardian" | "adult",
    trip?: Trip,
  ) => {
    if (isAnnexPastCutoff(trip)) {
      return;
    }
    setMinorPermitStatusByAnnex((prev) => {
      const current = prev[annexNumber];
      return {
        ...prev,
        [annexNumber]: {
          guardianSentAt: current?.guardianSentAt ?? null,
          guardianSignedAt:
            signer === "guardian"
              ? new Date().toISOString()
              : (current?.guardianSignedAt ?? null),
          adultSentAt: current?.adultSentAt ?? null,
          adultSignedAt:
            signer === "adult"
              ? new Date().toISOString()
              : (current?.adultSignedAt ?? null),
        },
      };
    });
  };

  const previewMember = previewDialog.memberId
    ? items.find((item) => item.id === previewDialog.memberId) ?? null
    : null;
  const previewTrip = previewMember ? tripMap[previewMember.tripId] : undefined;
  const previewAdultTravelers = previewMember ? getAdultTravelers(previewMember) : [];
  const previewSelectedTraveler =
    previewAdultTravelers.find((traveler) => traveler.travelerKey === previewTravelerKey) ??
    previewAdultTravelers[0] ??
    null;
  const previewMemberForContract = previewMember && previewSelectedTraveler
    ? {
        ...previewMember,
        fullName: previewSelectedTraveler.fullName,
        email: previewSelectedTraveler.email,
        phone: previewSelectedTraveler.phone,
        address: previewSelectedTraveler.address,
        identificationTypeId: previewSelectedTraveler.identificationTypeId,
        identification: previewSelectedTraveler.identification,
        maritalStatus: previewSelectedTraveler.maritalStatus,
        nationalityId: previewSelectedTraveler.nationalityId,
        profession: previewSelectedTraveler.profession,
        wantsInsurance: previewSelectedTraveler.wantsInsurance,
        hasOwnInsurance: previewSelectedTraveler.hasOwnInsurance,
        emergencyContactName: previewSelectedTraveler.emergencyContactName,
        emergencyContactPhone: previewSelectedTraveler.emergencyContactPhone,
        hasCompanions: false,
        hasMinorCompanions: false,
        companions: [],
        seats: 1,
      }
    : null;
  const previewDraft = previewMemberForContract
    ? mapTripMemberToContractDraft(previewMemberForContract, previewTrip, {
        itineraryItems: itineraryByMember[previewMemberForContract.id],
        requireManualItinerary: true,
        allowedLuggageText: luggageTextByMember[previewMemberForContract.id],
        exchangeRate,
        catalogs: {
          identificationTypes: identificationTypeCatalog,
          nationalities: nationalityCatalog,
        },
        lucitoursSignatories: signerFlags(signerByMember[previewMemberForContract.id] ?? "none"),
      })
    : null;
  if (previewDraft?.payload?.contract?.number && previewSelectedTraveler) {
    previewDraft.payload.contract.number = `${previewDraft.payload.contract.number}-${previewSelectedTraveler.indexLabel}`;
  }
  const previewAdultContractCases = previewMember ? getAdultContractCases(previewMember) : [];
  const previewSelectedContractCase =
    previewSelectedTraveler
      ? previewAdultContractCases.find((item) => item.travelerKey === previewSelectedTraveler.travelerKey) ?? null
      : null;
  const previewContractText = previewDraft
    ? renderContractGeneralPreview(previewDraft.payload)
    : "";
  const previewContractModalHtml = previewContractText
    ? renderPlainPreviewHtml(previewContractText)
    : "";
  const previewCedulaIssues = previewMember ? getCedulaBlockingIssues(previewMember) : [];
  const previewPassportPending = previewMember ? getPassportPendingItems(previewMember) : [];
  const previewAnnexRequirements = previewMember
    ? getAnnexRequirements(previewMember)
    : {
        requiresMinorAnnex: false,
        missingUploadLabels: [] as string[],
      };
  const previewMissingCloseRequirements = previewMember
    ? [
        ...getMissingAdultContractLabels(previewMember),
        ...previewAnnexRequirements.missingUploadLabels,
      ]
    : [];

    
  const minorPermitMember = minorPermitDialog.memberId
    ? items.find((item) => item.id === minorPermitDialog.memberId) ?? null
    : null;
  const documentsMember = documentsDialog.memberId
    ? items.find((item) => item.id === documentsDialog.memberId) ?? null
    : null;

  const minorPermitTrip = minorPermitMember ? tripMap[minorPermitMember.tripId] : undefined;

  const minorPermitDraft = minorPermitMember
    ? mapTripMemberToContractDraft(minorPermitMember, minorPermitTrip, {
        itineraryItems: itineraryByMember[minorPermitMember.id],
        requireManualItinerary: true,
        allowedLuggageText: luggageTextByMember[minorPermitMember.id],
        exchangeRate,
        catalogs: {
          identificationTypes: identificationTypeCatalog,
          nationalities: nationalityCatalog,
        },
        lucitoursSignatories: signerFlags(signerByMember[minorPermitMember.id] ?? "none"),
      })
    : null;

  const minorPermitAnnexes = minorPermitMember && minorPermitDraft
    ? minorPermitMember.companions
        .filter((companion) => companion.isMinor)
        .map((companion) => {
          const annexNumber = buildMinorPermitAnnexNumber(
            minorPermitDraft.payload.contract.number,
            companion.fullName || "Acompanante menor",
          );
          const guardian = resolveGuardianFromMember(minorPermitMember, companion);
          const guardianCompanion = minorPermitMember.companions.find(
            (candidate) =>
              !candidate.isMinor &&
              normalizeOwnerName(candidate.fullName || "") === normalizeOwnerName(guardian.guardianName),
          );
          const travelingAdultCompanion = minorPermitMember.companions.find(
            (candidate) =>
              !candidate.isMinor &&
              normalizeOwnerName(candidate.fullName || "") ===
                normalizeOwnerName(guardian.travelingAdultName),
          );
          const hasSupportingPermit = minorPermitMember.documents.some(
            (doc) =>
              doc.type === "MINOR_PERMIT" &&
              normalizeOwnerName(doc.ownerName) === normalizeOwnerName(companion.fullName || ""),
          );
          return {
            annexNumber,
            minorName: companion.fullName || "Acompanante menor",
            minorIdType: toContractIdTypeLabel(
              (companion as { identificationTypeId?: string }).identificationTypeId ??
                minorPermitMember.identificationTypeId,
            ),
            minorIdNumber: companion.identification,
            guardianName: guardian.guardianName,
            guardianIdType: toContractIdTypeLabel(guardian.guardianIdType),
            guardianIdNumber: guardian.guardianIdNumber,
            guardianPhone: guardian.guardianPhone,
            guardianEmail:
              companion.guardianEmail ||
              guardianCompanion?.email ||
              (isTitularOwnerName(guardian.guardianName, minorPermitMember.fullName)
                ? minorPermitMember.email
                : ""),
            travelingAdultName: guardian.travelingAdultName,
            travelingAdultIdType: toContractIdTypeLabel(guardian.travelingAdultIdType),
            travelingAdultIdNumber: guardian.travelingAdultIdNumber,
            travelingAdultPhone: guardian.travelingAdultPhone,
            travelingAdultEmail:
              travelingAdultCompanion?.email ||
              (isTitularOwnerName(guardian.travelingAdultName, minorPermitMember.fullName)
                ? minorPermitMember.email
                : ""),
            hasSupportingPermit,
            previewText: renderMinorPermitAnnexPreview({
              contractNumber: minorPermitDraft.payload.contract.number,
              annexNumber,
              tripDestination: minorPermitDraft.payload.trip.destinationCountry,
              tripStartDate: minorPermitDraft.payload.trip.startDate,
              tripEndDate: minorPermitDraft.payload.trip.endDate,
              clientFullName: minorPermitMember.fullName,
              minorFullName: companion.fullName || "Acompanante menor",
              minorIdType: toContractIdTypeLabel(
                (companion as { identificationTypeId?: string }).identificationTypeId ??
                  minorPermitMember.identificationTypeId,
              ),
              minorIdNumber: companion.identification,
              guardianName: guardian.guardianName,
              guardianIdType: toContractIdTypeLabel(guardian.guardianIdType),
              guardianIdNumber: guardian.guardianIdNumber,
              guardianPhone: guardian.guardianPhone,
              travelingAdultName: guardian.travelingAdultName,
              travelingAdultIdType: toContractIdTypeLabel(guardian.travelingAdultIdType),
              travelingAdultIdNumber: guardian.travelingAdultIdNumber,
              travelingAdultPhone: guardian.travelingAdultPhone,
              issuedAt: formatIsoDate(new Date().toISOString()),
            }),
          };
        })
    : [];

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
                  exchangeRate,
                  catalogs: {
                    identificationTypes: identificationTypeCatalog,
                    nationalities: nationalityCatalog,
                  },
                  lucitoursSignatories: signerFlags(signerByMember[member.id] ?? "none"),
                });
                const isReady = draft.missingFields.length === 0;
                const itineraryCount = itineraryByMember[member.id]?.length ?? 0;
                const adultCases = getAdultContractCases(member);
                const adultSignedCount = adultCases.filter((item) => item.signedFileName).length;
                const hasMinorPermitAnnex = member.companions.some((companion) => companion.isMinor);
                const cedulaBlockingIssues = getCedulaBlockingIssues(member);
                const passportPendingItems = getPassportPendingItems(member);
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
                        <span className="text-[11px] text-slate-500">
                          Firmas adultos: {adultSignedCount}/{adultCases.length}
                        </span>
                        {cedulaBlockingIssues.length > 0 ? (
                          <span className="text-[11px] font-semibold text-rose-700">
                            Pendiente cedula ({cedulaBlockingIssues.length})
                          </span>
                        ) : null}
                        {passportPendingItems.length > 0 ? (
                          <span className="text-[11px] font-semibold text-amber-700">
                            Pendiente pasaporte ({passportPendingItems.length})
                          </span>
                        ) : null}
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
                          onClick={() => openPreviewDialog(member)}
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
                          onClick={() => openMinorPermitDialog(member.id)}
                          disabled={!hasMinorPermitAnnex}
                          className="text-left text-xs font-semibold text-cyan-600 hover:underline disabled:text-slate-400 disabled:no-underline"
                        >
                          {hasMinorPermitAnnex ? "Ver anexo menor" : "Sin anexo menor"}
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
        <DialogContent className="flex h-[80vh] w-[98vw] max-w-[100rem] flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              Itinerario manual {itineraryDialog.member ? `· ${itineraryDialog.member.fullName}` : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1">
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
          </div>

          <DialogFooter className="flex flex-wrap gap-2 sm:justify-end">
            <Button type="button" size="sm" variant="outline" onClick={closeItineraryDialog}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={saveItineraryDraft}>
              Guardar itinerario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewDialog.open} onOpenChange={(next) => (next ? null : closePreviewDialog())}>
        <DialogContent className="flex h-[88vh] w-[98vw] max-w-[110rem] flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              Contrato individual {previewSelectedTraveler ? `· ${previewSelectedTraveler.fullName}` : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1">
          {previewDraft ? (
            <div className="space-y-3 pb-2">
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

              {previewCedulaIssues.length > 0 ? (
                <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
                  <p className="font-semibold">Bloqueo por cedula antes de firma:</p>
                  <ul className="mt-2 list-disc pl-4">
                    {previewCedulaIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {previewPassportPending.length > 0 ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                  Pasaporte pendiente ({previewPassportPending.length}). No bloquea firma de contrato,
                  pero debe resolverse antes de pasar a Compras.
                </div>
              ) : null}

              {previewAdultTravelers.length > 0 ? (
                <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700">
                  <p className="font-semibold text-slate-800">Grupo de viaje (contratos individuales por adulto)</p>
                  <div className="mt-2 grid gap-2 md:grid-cols-[280px_1fr]">
                    <select
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                      value={previewSelectedTraveler?.travelerKey ?? ""}
                      onChange={(event) => setPreviewTravelerKey(event.target.value)}
                    >
                      {previewAdultTravelers.map((traveler) => (
                        <option key={traveler.travelerKey} value={traveler.travelerKey}>
                          {traveler.fullName} ({traveler.isTitular ? "Titular" : "Acompanante"})
                        </option>
                      ))}
                    </select>
                    <div className="text-[11px] text-slate-600">
                      Reserva de grupo: <span className="font-semibold">{previewMember?.reservationCode || "-"}</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {previewMember && previewSelectedContractCase ? (
                <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700">
                  <p className="font-semibold text-slate-800">Contrato firmado (archivo recibido por persona)</p>
                  <p>
                    Archivo actual: <span className="font-semibold">{previewSelectedContractCase.signedFileName || "-"}</span>
                  </p>
                  <p>
                    Fecha carga: <span className="font-semibold">{formatDateTime(previewSelectedContractCase.signedUploadedAt)}</span>
                  </p>
                  <p>
                    Correo de firma: <span className="font-semibold">{previewSelectedContractCase.travelerEmail || "-"}</span>
                  </p>
                  <label className="mt-2 inline-flex cursor-pointer items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    Cargar contrato firmado
                    <input
                      type="file"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) {
                          return;
                        }
                        void upsertAdultContractCase(previewMember, previewSelectedContractCase.travelerKey, {
                          signedFileName: file.name,
                          signedUploadedAt: new Date().toISOString(),
                        });
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
              ) : null}

              {previewMissingCloseRequirements.length > 0 ? (
                <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
                  <p className="font-semibold">Pendientes para cerrar contrato:</p>
                  <ul className="mt-2 list-disc pl-4">
                    {previewMissingCloseRequirements.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                  Requisitos de cierre completos (contrato y anexos firmados cargados).
                </div>
              )}

              <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700">
                Estado actual: <span className="font-semibold">{getWorkflowStatusLabel(previewMember?.contractsWorkflowStatus)}</span>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <iframe
                  title="Vista previa contrato"
                  srcDoc={previewContractModalHtml}
                  className="h-[50vh] w-full rounded-md border border-slate-200 bg-white"
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600">No se pudo generar el contrato.</p>
          )}
          </div>

          <DialogFooter className="flex flex-wrap gap-2 sm:justify-end">
            {previewMember && previewDraft && previewSelectedTraveler ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void downloadContractPreview(
                      {
                        ...previewMember,
                        fullName: previewSelectedTraveler.fullName,
                      },
                      previewContractText,
                    )
                  }
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
                  Descargar contrato (PDF)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void emailContractPreview(previewMember, previewSelectedTraveler, previewContractText)
                  }
                  disabled={
                    previewDraft.missingFields.length > 0 ||
                    previewCedulaIssues.length > 0 ||
                    previewMember.contractsWorkflowStatus === ContractsWorkflowStatus.APPROVED ||
                    busyId === previewMember.id ||
                    !previewSelectedTraveler.email ||
                    emailBusyKey === `contract:${previewMember.id}:${previewSelectedTraveler.travelerKey}`
                  }
                >
                  {emailBusyKey === `contract:${previewMember.id}:${previewSelectedTraveler.travelerKey}`
                    ? "Enviando correo..."
                    : "Enviar PDF a firmar"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    void handleStatusChange(previewMember, ContractsWorkflowStatus.APPROVED)
                  }
                  disabled={
                    previewMember.contractsWorkflowStatus !== ContractsWorkflowStatus.SENT_TO_SIGN ||
                    previewMissingCloseRequirements.length > 0 ||
                    busyId === previewMember.id
                  }
                >
                  Marcar contrato firmado
                </Button>
              </>
            ) : null}
            <Button type="button" size="sm" variant="outline" onClick={closePreviewDialog}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={minorPermitDialog.open}
        onOpenChange={(next) => (next ? null : closeMinorPermitDialog())}
      >
        <DialogContent className="flex h-[88vh] w-[98vw] max-w-[110rem] flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              Anexos de autorizacion para menor {minorPermitMember ? `· ${minorPermitMember.fullName}` : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1">
          {minorPermitMember && minorPermitTrip ? (
            <div className="space-y-3 pb-2">
              {isAnnexPastCutoff(minorPermitTrip) ? (
                <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700">
                  La ventana de actualizacion del anexo de menor ya vencio (48h antes del inicio del tour).
                </div>
              ) : (
                <div className="rounded-md border border-sky-300 bg-sky-50 p-3 text-xs text-sky-700">
                  Este anexo es independiente y obligatorio por cada menor de edad. Requiere firma del tutor/patria potestad y del adulto que acompana al menor. Lucitours no firma este documento.
                </div>
              )}

              {minorPermitAnnexes.length > 0 ? (
                <div className="space-y-2 rounded-md border border-cyan-200 bg-cyan-50 p-3">
                  <div className="rounded-md border border-cyan-300 bg-white p-2 text-xs text-slate-700">
                    <p>
                      Archivo de anexo menor firmado: <span className="font-semibold">{minorPermitMember.signedMinorAnnexFileName || "-"}</span>
                    </p>
                    <label className="mt-2 inline-flex cursor-pointer items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      Cargar anexo menor firmado
                      <input
                        type="file"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) {
                            return;
                          }
                          void uploadSignedFile(minorPermitMember, {
                            signedMinorAnnexFileName: file.name,
                            signedMinorAnnexUploadedAt: new Date().toISOString(),
                          });
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <p className="text-xs font-semibold text-cyan-800">
                    Anexos de menor requeridos ({minorPermitAnnexes.length})
                  </p>
                  {minorPermitAnnexes.map((annex) => (
                    <div key={annex.annexNumber} className="rounded-md border border-cyan-300 bg-white p-3">
                      {(() => {
                        const status = minorPermitStatusByAnnex[annex.annexNumber];
                        const fullySigned = Boolean(status?.guardianSignedAt && status?.adultSignedAt);
                        const partiallySigned = Boolean(status?.guardianSignedAt || status?.adultSignedAt);
                        return (
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-800">
                          {annex.minorName} · {annex.annexNumber}
                        </p>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                            fullySigned
                              ? "bg-emerald-100 text-emerald-700"
                              : partiallySigned
                                ? "bg-sky-100 text-sky-700"
                                : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {fullySigned ? "Firmado (2/2)" : partiallySigned ? "Parcial (1/2)" : "Borrador"}
                        </span>
                      </div>
                        );
                      })()}

                      <div className="mb-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-700">
                        Respaldo de permiso cargado: {annex.hasSupportingPermit ? "SI" : "NO"}
                      </div>

                      <div className="mb-2 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-700 md:grid-cols-2">
                        <div>
                          <p className="font-semibold text-slate-800">Tutor / patria potestad</p>
                          <p>{annex.guardianName}</p>
                          <p>{annex.guardianEmail || "Sin correo"}</p>
                          <p>
                            Estado: {minorPermitStatusByAnnex[annex.annexNumber]?.guardianSignedAt
                              ? "Firmado"
                              : minorPermitStatusByAnnex[annex.annexNumber]?.guardianSentAt
                                ? "Enviado"
                                : "Pendiente"}
                          </p>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">Adulto que acompana</p>
                          <p>{annex.travelingAdultName}</p>
                          <p>{annex.travelingAdultEmail || "Sin correo"}</p>
                          <p>
                            Estado: {minorPermitStatusByAnnex[annex.annexNumber]?.adultSignedAt
                              ? "Firmado"
                              : minorPermitStatusByAnnex[annex.annexNumber]?.adultSentAt
                                ? "Enviado"
                                : "Pendiente"}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                        <iframe
                          title={`Vista previa anexo menor ${annex.annexNumber}`}
                          srcDoc={renderPlainPreviewHtml(annex.previewText)}
                          className="h-[40vh] w-full rounded-md border border-slate-200 bg-white"
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => markMinorPermitSigned(annex.annexNumber, "guardian", minorPermitTrip)}
                          disabled={
                            isAnnexPastCutoff(minorPermitTrip) ||
                            !minorPermitStatusByAnnex[annex.annexNumber]?.guardianSentAt ||
                            Boolean(minorPermitStatusByAnnex[annex.annexNumber]?.guardianSignedAt)
                          }
                        >
                          Marcar firma tutor
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => markMinorPermitSigned(annex.annexNumber, "adult", minorPermitTrip)}
                          disabled={
                            isAnnexPastCutoff(minorPermitTrip) ||
                            !minorPermitStatusByAnnex[annex.annexNumber]?.adultSentAt ||
                            Boolean(minorPermitStatusByAnnex[annex.annexNumber]?.adultSignedAt)
                          }
                        >
                          Marcar firma adulto acompanante
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void downloadMinorPermitPreview(
                              minorPermitMember,
                              annex.minorName,
                              annex.previewText,
                            )
                          }
                        >
                          Descargar anexo menor (PDF)
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void emailMinorPermitPreview(
                              minorPermitMember,
                              annex.annexNumber,
                              annex.minorName,
                              "guardian",
                              annex.guardianEmail,
                              annex.guardianName,
                              annex.previewText,
                            )
                          }
                          disabled={
                            isAnnexPastCutoff(minorPermitTrip) ||
                            Boolean(minorPermitStatusByAnnex[annex.annexNumber]?.guardianSentAt) ||
                            !annex.guardianEmail ||
                            emailBusyKey === `minor:${annex.annexNumber}:guardian`
                          }
                        >
                          {emailBusyKey === `minor:${annex.annexNumber}:guardian`
                            ? "Enviando..."
                            : "Enviar a tutor"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void emailMinorPermitPreview(
                              minorPermitMember,
                              annex.annexNumber,
                              annex.minorName,
                              "adult",
                              annex.travelingAdultEmail,
                              annex.travelingAdultName,
                              annex.previewText,
                            )
                          }
                          disabled={
                            isAnnexPastCutoff(minorPermitTrip) ||
                            Boolean(minorPermitStatusByAnnex[annex.annexNumber]?.adultSentAt) ||
                            !annex.travelingAdultEmail ||
                            emailBusyKey === `minor:${annex.annexNumber}:adult`
                          }
                        >
                          {emailBusyKey === `minor:${annex.annexNumber}:adult`
                            ? "Enviando..."
                            : "Enviar a adulto acompanante"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-800">
                  No hay acompanantes menores en este expediente.
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-600">No se pudo generar el anexo de menor.</p>
          )}
          </div>

          <DialogFooter className="flex flex-wrap gap-2 sm:justify-end">
            <Button type="button" size="sm" variant="outline" onClick={closeMinorPermitDialog}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={documentsDialog.open} onOpenChange={(next) => (next ? null : closeDocumentsDialog())}>
        <DialogContent className="flex h-[88vh] w-[96vw] max-w-5xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              Documentos recibidos {documentsMember ? `· ${documentsMember.fullName}` : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1">
          {documentsMember ? (
            <div className="space-y-4 pb-2 text-xs">
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
                      {doc.type === "ID_CARD" ? (
                        <div className="mt-2 space-y-2 rounded-md border border-rose-200 bg-rose-50 p-2">
                          <p className="text-[11px] font-semibold text-rose-700">
                            Validacion de cedula (bloquea envio a firma)
                          </p>
                          <label className="flex items-center gap-2 text-[11px] text-slate-700">
                            <input
                              type="checkbox"
                              checked={doc.idIsValid === true}
                              onChange={(event) =>
                                void updateDocumentReview(documentsMember, doc.id, {
                                  idIsValid: event.target.checked,
                                })
                              }
                            />
                            Cedula vigente
                          </label>
                          <label className="flex items-center gap-2 text-[11px] text-slate-700">
                            <input
                              type="checkbox"
                              checked={doc.idSignatureMatches === true}
                              onChange={(event) =>
                                void updateDocumentReview(documentsMember, doc.id, {
                                  idSignatureMatches: event.target.checked,
                                })
                              }
                            />
                            Firma coincide
                          </label>
                        </div>
                      ) : null}

                      {doc.type === "PASSPORT" ? (
                        <div className="mt-2 space-y-2 rounded-md border border-amber-200 bg-amber-50 p-2">
                          <p className="text-[11px] font-semibold text-amber-700">
                            Estado de pasaporte (no bloquea contrato, bloquea paso a Compras)
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                                doc.passportIsValid === true
                                  ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                                  : "border-slate-300 bg-white text-slate-700"
                              }`}
                              onClick={() =>
                                void updateDocumentReview(documentsMember, doc.id, {
                                  passportIsValid: true,
                                })
                              }
                            >
                              Marcar vigente
                            </button>
                            <button
                              type="button"
                              className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                                doc.passportIsValid === false
                                  ? "border-amber-300 bg-amber-100 text-amber-700"
                                  : "border-slate-300 bg-white text-slate-700"
                              }`}
                              onClick={() =>
                                void updateDocumentReview(documentsMember, doc.id, {
                                  passportIsValid: false,
                                })
                              }
                            >
                              Marcar vencido
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {doc.reviewedAt ? (
                        <p className="mt-2 text-[11px] text-slate-500">
                          Revisado: {formatDateTime(doc.reviewedAt)}
                        </p>
                      ) : null}

                      {documentSaveStateById[doc.id]?.state === "saving" ? (
                        <p className="mt-1 text-[11px] text-sky-700">Guardando cambios...</p>
                      ) : null}
                      {documentSaveStateById[doc.id]?.state === "saved" ? (
                        <p className="mt-1 text-[11px] text-emerald-700">Guardado</p>
                      ) : null}
                      {documentSaveStateById[doc.id]?.state === "error" ? (
                        <p className="mt-1 text-[11px] text-rose-700">
                          {documentSaveStateById[doc.id]?.message || "No se pudo guardar."}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-600">No se pudo cargar la informacion de documentos.</p>
          )}
          </div>

          <DialogFooter className="flex flex-wrap gap-2 sm:justify-end">
            <Button type="button" size="sm" variant="outline" onClick={closeDocumentsDialog}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={luggageDialog.open} onOpenChange={(next) => (next ? null : closeLuggageDialog())}>
        <DialogContent className="flex h-[72vh] w-[92vw] max-w-3xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              Equipaje permitido {luggageDialog.member ? `· ${luggageDialog.member.fullName}` : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
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

          <DialogFooter className="flex flex-wrap gap-2 sm:justify-end">
            <Button type="button" size="sm" variant="outline" onClick={closeLuggageDialog}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={saveLuggageDraft}>
              Guardar equipaje
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
