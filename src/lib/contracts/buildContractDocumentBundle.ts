import { identificationTypes } from "@/lib/data/catalogs";
import { mapTripMemberToContractDraft } from "@/lib/contracts/contractMapper";
import {
  renderContractGeneralPreview,
  renderContractGeneralPreviewHtml,
} from "@/lib/contracts/renderContractTemplate";
import {
  renderInsuranceAnnexPreview,
  renderInsuranceAnnexPreviewHtml,
} from "@/lib/contracts/renderInsuranceAnnexTemplate";
import {
  renderInsuranceExonerationPreview,
  renderInsuranceExonerationPreviewHtml,
} from "@/lib/contracts/renderInsuranceExonerationTemplate";
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
  wantsInsurance: boolean | null;
  insuranceId: string;
  hasOwnInsurance: boolean | null;
  isMinor?: boolean;
  guardianName?: string;
  guardianIdType?: string;
  guardianIdNumber?: string;
  guardianPhone?: string;
}

export interface ContractDocumentFile {
  kind: "contract" | "insurance-annex" | "insurance-exoneration" | "minor-annex";
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
  resolveInsuranceName?: (insuranceId: string) => string;
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
  const insuranceNameResolver =
    input.resolveInsuranceName ??
    ((insuranceId: string) => (insuranceId ? insuranceId : "PENDIENTE"));

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
      wantsInsurance: input.member.wantsInsurance,
      insuranceId: input.member.insuranceId,
      hasOwnInsurance: input.member.hasOwnInsurance,
    },
    ...input.member.companions.map((companion) => ({
      name: companion.fullName,
      role: toTravelerRoleLabel(companion),
      idType: resolveIdTypeLabel(companion.identificationTypeId),
      idNumber: companion.identification,
      emergencyName: companion.emergencyContactName,
      emergencyPhone: companion.emergencyContactPhone,
      wantsInsurance: companion.wantsInsurance,
      insuranceId: companion.insuranceId,
      hasOwnInsurance: companion.hasOwnInsurance,
      isMinor: companion.isMinor,
      guardianName: input.member.fullName,
      guardianIdType: resolveIdTypeLabel(input.member.identificationTypeId),
      guardianIdNumber: input.member.identification,
      guardianPhone: input.member.phone,
    })),
  ];

  const insuranceAnnexNumber = `${contractNumber}-AS`;
  const insurancePayload = {
    contractNumber,
    annexNumber: insuranceAnnexNumber,
    clientFullName: input.member.fullName,
    clientIdType: resolveIdTypeLabel(input.member.identificationTypeId),
    clientIdNumber: input.member.identification,
    tripDestination: input.member.packageName || input.trip.name || "-",
    tripStartDate: input.trip.dateFrom,
    tripEndDate: input.trip.dateTo,
    annexIssuedAt: issuedAt,
    annexSentAt: issuedAt,
    annexCutoffAt: "48 horas antes del viaje",
    includeEdwin,
    includeErick,
    lucitoursEdwinDate: includeEdwin ? issuedAt : "",
    lucitoursErickDate: includeErick ? issuedAt : "",
    clientDate: issuedAt,
    travelers: allTravelers.map((traveler) => ({
      travelerName: traveler.name,
      travelerRole: traveler.role,
      travelerIdType: traveler.idType,
      travelerIdNumber: traveler.idNumber,
      emergencyContactName: traveler.emergencyName || input.member.emergencyContactName,
      emergencyContactPhone: traveler.emergencyPhone || input.member.emergencyContactPhone,
      wantsInsuranceWithLucitours: traveler.wantsInsurance,
      provider:
        traveler.wantsInsurance === true
          ? insuranceNameResolver(traveler.insuranceId)
          : "NO APLICA",
      hasOwnInsurance: traveler.hasOwnInsurance,
    })),
  };

  files.push({
    kind: "insurance-annex",
    title: "Anexo de declaracion de seguro",
    fileNameBase: `${sanitizeName(contractNumber)}-anexo-seguro`,
    plainText: renderInsuranceAnnexPreview(insurancePayload),
    html: renderInsuranceAnnexPreviewHtml(insurancePayload),
  });

  const travelersWithoutLucitoursInsurance = allTravelers.filter(
    (traveler) => traveler.wantsInsurance === false,
  );

  travelersWithoutLucitoursInsurance.forEach((traveler, index) => {
    files.push({
      kind: "insurance-exoneration",
      title: `Anexo de exoneracion por seguro - ${traveler.name}`,
      fileNameBase: `${sanitizeName(contractNumber)}-anexo-exoneracion-${index + 1}-${sanitizeName(traveler.name)}`,
      plainText: renderInsuranceExonerationPreview({
        contractNumber,
        annexNumber: `${contractNumber}-EX-${index + 1}`,
        tripDestination: input.member.packageName || input.trip.name || "-",
        tripStartDate: input.trip.dateFrom,
        tripEndDate: input.trip.dateTo,
        clientFullName: input.member.fullName,
        travelerName: traveler.name,
        travelerRole: traveler.role,
        travelerIdType: traveler.idType,
        travelerIdNumber: traveler.idNumber,
        emergencyContactName: traveler.emergencyName || input.member.emergencyContactName,
        emergencyContactPhone: traveler.emergencyPhone || input.member.emergencyContactPhone,
        hasOwnInsurance: traveler.hasOwnInsurance,
        includeEdwin,
        includeErick,
        lucitoursEdwinDate: includeEdwin ? issuedAt : "",
        lucitoursErickDate: includeErick ? issuedAt : "",
        issuedAt,
      }),
      html: renderInsuranceExonerationPreviewHtml({
        contractNumber,
        annexNumber: `${contractNumber}-EX-${index + 1}`,
        tripDestination: input.member.packageName || input.trip.name || "-",
        tripStartDate: input.trip.dateFrom,
        tripEndDate: input.trip.dateTo,
        clientFullName: input.member.fullName,
        travelerName: traveler.name,
        travelerRole: traveler.role,
        travelerIdType: traveler.idType,
        travelerIdNumber: traveler.idNumber,
        emergencyContactName: traveler.emergencyName || input.member.emergencyContactName,
        emergencyContactPhone: traveler.emergencyPhone || input.member.emergencyContactPhone,
        hasOwnInsurance: traveler.hasOwnInsurance,
        includeEdwin,
        includeErick,
        lucitoursEdwinDate: includeEdwin ? issuedAt : "",
        lucitoursErickDate: includeErick ? issuedAt : "",
        issuedAt,
      }),
    });
  });

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
