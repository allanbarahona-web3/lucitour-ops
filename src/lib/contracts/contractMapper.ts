import { identificationTypes, nationalities } from "@/lib/data/catalogs";
import type { MaritalStatus, Trip, TripMember } from "@/lib/types/ops";

export enum ContractClientIdType {
  CEDULA = "cedula",
  PASSPORT = "passport",
  DIMEX = "dimex",
}

export interface ContractPayload {
  contract: {
    number: string;
  };
  client: {
    fullName: string;
    civilStatus: string;
    profession: string;
    nationality: string;
    idType: ContractClientIdType;
    idTypeLabel: string;
    idNumber: string;
    address: string;
    email: string;
    phone: string;
    emergencyContact: {
      name: string;
      phone: string;
    };
  };
  trip: {
    destinationCountry: string;
    startDate: string;
    endDate: string;
    itineraryItems: Array<{ date: string; activity: string }>;
    allowedLuggageText: string;
  };
  travelers: {
    hasCompanions: boolean;
    companions: Array<{
      fullName: string;
      civilStatus: string;
      profession: string;
      idType: ContractClientIdType;
      idTypeLabel: string;
      idNumber: string;
      address: string;
      email: string;
      phone: string;
    }>;
    hasMinors: boolean;
    minors: Array<{ fullName: string; idNumber: string; guardianName: string }>;
  };
  payment: {
    totalAmount: number;
    plan: "cash" | "installments";
    initialAmount: number;
    installmentsSummary: string;
    dueDate: string;
    paidAt: string;
  };
  lodging: {
    checkInDateFrom: string;
    checkInDateTo: string;
    checkOutDate: string;
  };
  legal: {
    applyExonerationAnnex: boolean;
  };
  sale: {
    isResale: boolean;
  };
  annexes: {
    insuranceAndCoverage: {
      enabled: boolean;
      version: string;
      signedAt: string;
      cutoffHours: number;
    };
  };
  lucitours: {
    signatories: {
      includeEdwin: boolean;
      includeErick: boolean;
    };
  };
  signatures: {
    lucitoursEdwinDate: string;
    lucitoursErickDate: string;
    clientDate: string;
  };
}

export interface ContractDraftResult {
  payload: ContractPayload;
  missingFields: string[];
}

export interface ContractDraftOverrides {
  itineraryItems?: Array<{ date: string; activity: string }>;
  requireManualItinerary?: boolean;
  allowedLuggageText?: string;
  lucitoursSignatories?: {
    includeEdwin: boolean;
    includeErick: boolean;
  };
}

const DEFAULT_ALLOWED_LUGGAGE_TEXT =
  "1 articulo personal de hasta 10 kg (mochila de espalda, no carry-on). Excesos de equipaje son por cuenta del Cliente.";

const maritalStatusLabel: Record<MaritalStatus, string> = {
  SINGLE: "soltero/a",
  MARRIED: "casado/a",
  DIVORCED: "divorciado/a",
  WIDOWED: "viudo/a",
};

const resolveIdType = (identificationTypeId: string): ContractClientIdType => {
  const name =
    identificationTypes.find((item) => item.id === identificationTypeId)?.name.toLowerCase() ?? "";

  if (name.includes("pasaporte")) {
    return ContractClientIdType.PASSPORT;
  }
  if (name.includes("dimex")) {
    return ContractClientIdType.DIMEX;
  }
  return ContractClientIdType.CEDULA;
};

const idTypeLabelByValue: Record<ContractClientIdType, string> = {
  [ContractClientIdType.CEDULA]: "Cedula de identidad",
  [ContractClientIdType.PASSPORT]: "Pasaporte",
  [ContractClientIdType.DIMEX]: "DIMEX",
};

const resolveNationality = (nationalityId: string): string =>
  nationalities.find((item) => item.id === nationalityId)?.name ?? "";

const toIsoDate = (raw: string): string => {
  if (!raw) {
    return "";
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  return parsed.toISOString().slice(0, 10);
};

const subtractDaysIso = (rawDate: string | undefined, days: number): string => {
  if (!rawDate) {
    return "";
  }
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const next = new Date(parsed);
  next.setDate(next.getDate() - days);
  return next.toISOString().slice(0, 10);
};

const addDaysIso = (rawDate: string | undefined, days: number): string => {
  if (!rawDate) {
    return "";
  }
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const next = new Date(parsed);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
};

export const mapTripMemberToContractDraft = (
  member: TripMember,
  trip?: Trip,
  overrides: ContractDraftOverrides = {},
): ContractDraftResult => {
  const idType = resolveIdType(member.identificationTypeId);
  const nationality = resolveNationality(member.nationalityId);

  const resolveCompanionIdType = (companion: unknown): ContractClientIdType => {
    const maybeId =
      typeof companion === "object" && companion
        ? (companion as { identificationTypeId?: string }).identificationTypeId
        : "";
    return maybeId ? resolveIdType(maybeId) : idType;
  };

  const companions = member.companions.map((companion) => ({
    fullName: companion.fullName,
    civilStatus: companion.maritalStatus ? maritalStatusLabel[companion.maritalStatus] : "",
    profession: companion.profession,
    idType: resolveCompanionIdType(companion),
    idTypeLabel: idTypeLabelByValue[resolveCompanionIdType(companion)],
    idNumber: companion.identification,
    address: companion.address,
    email: companion.email,
    phone: companion.phone,
  }));

  const minors = member.companions
    .filter((companion) => companion.isMinor)
    .map((companion) => ({
      fullName: companion.fullName,
      idNumber: companion.identification,
      guardianName: member.fullName,
    }));

  const hasInstallments = (member.paymentPlanMonths ?? 0) > 0;
  const installmentAmount = Math.max(0, member.paymentInstallmentAmount ?? 0);
  const installmentsSummary = hasInstallments
    ? `${member.paymentPlanMonths} cuotas de US$ ${installmentAmount.toFixed(2)}`
    : "";

  const itineraryItems =
    overrides.itineraryItems && overrides.itineraryItems.length > 0
      ? overrides.itineraryItems
      : [
          { date: trip?.dateFrom ?? "", activity: "Vuelo de ida al destino." },
          { date: trip?.dateTo ?? "", activity: "Vuelo de vuelta al pais de origen." },
        ];

  const payload: ContractPayload = {
    contract: {
      number: member.reservationCode || member.quoteCode || member.id,
    },
    client: {
      fullName: member.fullName,
      civilStatus: member.maritalStatus ? maritalStatusLabel[member.maritalStatus] : "",
      profession: member.profession,
      nationality,
      idType,
      idTypeLabel: idTypeLabelByValue[idType],
      idNumber: member.identification,
      address: member.address,
      email: member.email,
      phone: member.phone,
      emergencyContact: {
        name: member.emergencyContactName,
        phone: member.emergencyContactPhone,
      },
    },
    trip: {
      destinationCountry: member.packageName || trip?.name || "",
      startDate: trip?.dateFrom ?? "",
      endDate: trip?.dateTo ?? "",
      itineraryItems,
      allowedLuggageText: overrides.allowedLuggageText?.trim() || DEFAULT_ALLOWED_LUGGAGE_TEXT,
    },
    travelers: {
      hasCompanions: companions.length > 0,
      companions,
      hasMinors: minors.length > 0,
      minors,
    },
    payment: {
      totalAmount: Math.max(0, member.packageFinalPrice ?? 0),
      plan: hasInstallments ? "installments" : "cash",
      initialAmount: Math.max(0, member.reservationFinalPerPerson ?? 0),
      installmentsSummary,
      dueDate: subtractDaysIso(trip?.dateFrom, 22),
      paidAt: hasInstallments ? "" : toIsoDate(member.updatedAt),
    },
    lodging: {
      checkInDateFrom: addDaysIso(trip?.dateFrom, 1),
      checkInDateTo: addDaysIso(trip?.dateFrom, 2),
      checkOutDate: trip?.dateTo ?? "",
    },
    legal: {
      applyExonerationAnnex: member.wantsInsurance === false,
    },
    sale: {
      isResale: false,
    },
    annexes: {
      insuranceAndCoverage: {
        enabled: true,
        version: "v1",
        signedAt: "",
        cutoffHours: 48,
      },
    },
    lucitours: {
      signatories: {
        includeEdwin: overrides.lucitoursSignatories?.includeEdwin ?? false,
        includeErick: overrides.lucitoursSignatories?.includeErick ?? false,
      },
    },
    signatures: {
      lucitoursEdwinDate: "",
      lucitoursErickDate: "",
      clientDate: "",
    },
  };

  const missingFields: string[] = [];

  if (!payload.client.fullName.trim()) missingFields.push("Cliente: nombre completo");
  if (!payload.client.idNumber.trim()) missingFields.push("Cliente: numero de identificacion");
  if (!payload.client.address.trim()) missingFields.push("Cliente: direccion");
  if (!payload.client.civilStatus.trim()) missingFields.push("Cliente: estado civil");
  if (!payload.client.profession.trim()) missingFields.push("Cliente: profesion");
  if (payload.client.idType === ContractClientIdType.PASSPORT && !payload.client.nationality.trim()) {
    missingFields.push("Cliente: nacionalidad (obligatoria con pasaporte)");
  }

  if (!payload.trip.destinationCountry.trim()) missingFields.push("Viaje: destino");
  if (!payload.trip.startDate.trim()) missingFields.push("Viaje: fecha inicio");
  if (!payload.trip.endDate.trim()) missingFields.push("Viaje: fecha fin");
  if (!payload.trip.allowedLuggageText.trim()) missingFields.push("Viaje: equipaje permitido");

  if (overrides.requireManualItinerary) {
    if (!overrides.itineraryItems || overrides.itineraryItems.length === 0) {
      missingFields.push("Itinerario: debe cargarse manualmente en rol Contratos");
    } else {
      for (const [index, item] of overrides.itineraryItems.entries()) {
        if (!item.date.trim()) {
          missingFields.push(`Itinerario ${index + 1}: fecha`);
        }
        if (!item.activity.trim()) {
          missingFields.push(`Itinerario ${index + 1}: actividad`);
        }
      }
    }
  }

  if (payload.payment.totalAmount <= 0) missingFields.push("Pago: monto total");
  if (payload.payment.plan === "installments" && !payload.payment.installmentsSummary.trim()) {
    missingFields.push("Pago: detalle de cuotas");
  }

  if (!payload.lucitours.signatories.includeEdwin && !payload.lucitours.signatories.includeErick) {
    missingFields.push("Firma Lucitours: seleccionar firmante (Edwin, Erick o ambos)");
  }

  for (const [index, companion] of payload.travelers.companions.entries()) {
    if (!companion.fullName.trim()) {
      missingFields.push(`Acompanante ${index + 1}: nombre completo`);
    }
    if (!companion.idNumber.trim()) {
      missingFields.push(`Acompanante ${index + 1}: identificacion`);
    }
    if (!companion.civilStatus.trim()) {
      missingFields.push(`Acompanante ${index + 1}: estado civil`);
    }
    if (!companion.address.trim()) {
      missingFields.push(`Acompanante ${index + 1}: direccion`);
    }
    if (!companion.email.trim()) {
      missingFields.push(`Acompanante ${index + 1}: correo`);
    }
  }

  return { payload, missingFields };
};
