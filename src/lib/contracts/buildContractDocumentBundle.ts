import { identificationTypes } from "@/lib/data/catalogs";
import { mapTripMemberToContractDraft } from "@/lib/contracts/contractMapper";
import {
  renderContractGeneralPreview,
  renderContractGeneralPreviewHtml,
} from "@/lib/contracts/renderContractTemplate";
import {
  renderMinorPermitAnnexPreview,
  renderMinorPermitAnnexPreviewHtml,
} from "@/lib/contracts/renderMinorPermitAnnexTemplate";
import type { Companion, TripMember } from "@/lib/types/ops";

interface TripSnapshot {
  name: string;
  dateFrom: string;
  dateTo: string;
}

interface BundleTraveler {
  name: string;
  role: string;
  idType: string;
  idNumber: string;
  emergencyName: string;
  emergencyPhone: string;
  isMinor?: boolean;
  guardianName?: string;
  guardianIdType?: string;
  guardianIdNumber?: string;
  guardianPhone?: string;
}

export interface ContractDocumentFile {
  kind: "contract" | "minor-annex";
  title: string;
  fileNameBase: string;
  plainText: string;
  html: string;
}

export interface ContractDocumentBundle {
  contractNumber: string;
  missingFields: string[];
  files: ContractDocumentFile[];
}

export interface BuildContractDocumentBundleInput {
  member: TripMember;
  trip: TripSnapshot;
  includeEdwin?: boolean;
  includeErick?: boolean;
  issuedAtIso?: string;
}

const sanitizeName = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "documento";

const formatIsoDate = (value: string): string => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toISOString().slice(0, 10);
};

const resolveIdTypeLabel = (identificationTypeId: string): string =>
  identificationTypes.find((item) => item.id === identificationTypeId)?.name || "Identificacion";

const toTravelerRoleLabel = (companion: Companion): string =>
  companion.isMinor ? "Menor" : "Acompanante";

const buildContractNumber = (member: TripMember): string =>
  member.reservationCode || member.quoteCode || member.id;

export const buildContractDocumentBundle = (
  input: BuildContractDocumentBundleInput,
): ContractDocumentBundle => {
  const issuedAt = formatIsoDate(input.issuedAtIso || new Date().toISOString());
  const contractNumber = buildContractNumber(input.member);
  const includeEdwin = input.includeEdwin ?? true;
  const includeErick = input.includeErick ?? false;

  const { payload: contractPayload, missingFields } = mapTripMemberToContractDraft(
    input.member,
    {
      id: input.member.tripId,
      name: input.trip.name,
      dateFrom: input.trip.dateFrom,
      dateTo: input.trip.dateTo,
      status: "ACTIVE",
      maxSeats: 0,
      lodgingType: "HOTEL",
      packageBasePrice: 0,
      reservationMinPerPerson: 0,
    },
    {
      lucitoursSignatories: {
        includeEdwin,
        includeErick,
      },
    },
  );

  contractPayload.signatures.lucitoursEdwinDate = includeEdwin ? issuedAt : "";
  contractPayload.signatures.lucitoursErickDate = includeErick ? issuedAt : "";
  contractPayload.signatures.clientDate = issuedAt;

  const files: ContractDocumentFile[] = [];
  files.push({
    kind: "contract",
    title: "Contrato general de viaje turistico",
    fileNameBase: `${sanitizeName(contractNumber)}-contrato-general`,
    plainText: renderContractGeneralPreview(contractPayload),
    html: renderContractGeneralPreviewHtml(contractPayload),
  });

  const allTravelers: BundleTraveler[] = [
    {
      name: input.member.fullName,
      role: "Titular",
      idType: resolveIdTypeLabel(input.member.identificationTypeId),
      idNumber: input.member.identification,
      emergencyName: input.member.emergencyContactName,
      emergencyPhone: input.member.emergencyContactPhone,
    },
    ...input.member.companions.map((companion) => ({
      name: companion.fullName,
      role: toTravelerRoleLabel(companion),
      idType: resolveIdTypeLabel(companion.identificationTypeId),
      idNumber: companion.identification,
      emergencyName: companion.emergencyContactName,
      emergencyPhone: companion.emergencyContactPhone,
      isMinor: companion.isMinor,
      guardianName: input.member.fullName,
      guardianIdType: resolveIdTypeLabel(input.member.identificationTypeId),
      guardianIdNumber: input.member.identification,
      guardianPhone: input.member.phone,
    })),
  ];

  const minorCompanions = allTravelers.filter(
    (traveler) => "isMinor" in traveler && traveler.isMinor,
  );

  minorCompanions.forEach((traveler, index) => {
    files.push({
      kind: "minor-annex",
      title: `Anexo de autorizacion de menor - ${traveler.name}`,
      fileNameBase: `${sanitizeName(contractNumber)}-anexo-menor-${index + 1}-${sanitizeName(traveler.name)}`,
      plainText: renderMinorPermitAnnexPreview({
        contractNumber,
        annexNumber: `${contractNumber}-MN-${index + 1}`,
        tripDestination: input.member.packageName || input.trip.name || "-",
        tripStartDate: input.trip.dateFrom,
        tripEndDate: input.trip.dateTo,
        clientFullName: input.member.fullName,
        minorFullName: traveler.name,
        minorIdType: traveler.idType,
        minorIdNumber: traveler.idNumber,
        guardianName: traveler.guardianName || input.member.fullName,
        guardianIdType: traveler.guardianIdType || resolveIdTypeLabel(input.member.identificationTypeId),
        guardianIdNumber: traveler.guardianIdNumber || input.member.identification,
        guardianPhone: traveler.guardianPhone || input.member.phone,
        travelingAdultName: input.member.fullName,
        travelingAdultIdType: resolveIdTypeLabel(input.member.identificationTypeId),
        travelingAdultIdNumber: input.member.identification,
        travelingAdultPhone: input.member.phone,
        issuedAt,
      }),
      html: renderMinorPermitAnnexPreviewHtml({
        contractNumber,
        annexNumber: `${contractNumber}-MN-${index + 1}`,
        tripDestination: input.member.packageName || input.trip.name || "-",
        tripStartDate: input.trip.dateFrom,
        tripEndDate: input.trip.dateTo,
        clientFullName: input.member.fullName,
        minorFullName: traveler.name,
        minorIdType: traveler.idType,
        minorIdNumber: traveler.idNumber,
        guardianName: traveler.guardianName || input.member.fullName,
        guardianIdType: traveler.guardianIdType || resolveIdTypeLabel(input.member.identificationTypeId),
        guardianIdNumber: traveler.guardianIdNumber || input.member.identification,
        guardianPhone: traveler.guardianPhone || input.member.phone,
        travelingAdultName: input.member.fullName,
        travelingAdultIdType: resolveIdTypeLabel(input.member.identificationTypeId),
        travelingAdultIdNumber: input.member.identification,
        travelingAdultPhone: input.member.phone,
        issuedAt,
      }),
    });
  });

  return {
    contractNumber,
    missingFields,
    files,
  };
};
