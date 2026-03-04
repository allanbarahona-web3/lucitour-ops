import type {
  CatalogItem,
  CatalogName,
  ContractModificationRequest,
  CreateContractModificationInput,
  CreateHolidayDateInput,
  CreateLeadInput,
  CreateTripInput,
  CreateTripMemberInput,
  CreatePayrollDeductionInput,
  CreatePayrollPayslipInput,
  CreateTimePunchInput,
  HolidayDate,
  Lead,
  PayrollDeduction,
  PayrollGlobalConfig,
  PayrollPayslip,
  PayrollRoleConfig,
  Trip,
  TripMember,
  TimePunch,
  UpdateContractModificationPatch,
  UpdateCatalogItemPatch,
  UpdateLeadPatch,
  UpdatePayrollGlobalConfig,
  UpdatePayrollRoleConfig,
  UpdateTripMemberPatch,
} from "../types/ops";
import {
  ContractStatus,
  ContractModificationStatus,
  DocsStatus,
  ItineraryStatus,
  PassportStatus,
  Role,
  ContractsStatus,
  BillingStatus,
  QuoteStatus,
  TimePunchType,
} from "../types/ops";
import { currentUser } from "../auth/mockSession";
import {
  accommodations,
  airlines,
  identificationTypes,
  insurances,
  lodgingTypes,
  nationalities,
} from "./catalogs";
import type { IOpsRepo } from "./opsRepo";

const ID_PREFIX = "ops";

const makeId = (kind: string, counter: number) => `${ID_PREFIX}_${kind}_${counter}`;

const nowIso = () => new Date().toISOString();

const makeReservationCode = () => {
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

const makeUniqueReservationCode = (existingCodes: Set<string>) => {
  let attempts = 0;
  let next = makeReservationCode();
  while (existingCodes.has(next) && attempts < 25) {
    next = makeReservationCode();
    attempts += 1;
  }
  return next;
};

const makeQuoteCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  const now = new Date();
  const month = months[now.getMonth()] ?? "MES";
  const year = String(now.getFullYear()).slice(-2);
  let suffix = "";
  for (let i = 0; i < 4; i += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `COT${month}${year}${suffix}`;
};

const makeUniqueQuoteCode = (existingCodes: Set<string>) => {
  let attempts = 0;
  let next = makeQuoteCode();
  while (existingCodes.has(next) && attempts < 25) {
    next = makeQuoteCode();
    attempts += 1;
  }
  return next;
};

const cloneCatalogs = (items: CatalogItem[]) => items.map((item) => ({ ...item }));

export class MockOpsRepo implements IOpsRepo {
  private tripCounter = 2;
  private memberCounter = 3;
  private catalogCounter = 100;
  private modificationCounter = 0;
  private timePunchCounter = 0;
  private holidayCounter = 0;
  private deductionCounter = 0;
  private payslipCounter = 0;

  private trips: Trip[] = [
    {
      id: makeId("trip", 1),
      name: "Gira Cancun Marzo",
      dateFrom: "2026-03-10",
      dateTo: "2026-03-17",
      status: "ACTIVE",
      maxSeats: 40,
    },
    {
      id: makeId("trip", 2),
      name: "Ruta Bogota Abril",
      dateFrom: "2026-04-02",
      dateTo: "2026-04-09",
      status: "PLANNED",
      maxSeats: 28,
    },
  ];

  private tripMembers: TripMember[] = [
    {
      id: makeId("member", 1),
      tripId: makeId("trip", 1),
      fullName: "Ana Torres",
      phone: "+52 555 010 1001",
      email: "ana.torres@correo.com",
      reservationCode: "RES-1001",
      identificationTypeId: identificationTypes[0]?.id ?? "",
      identification: "A1234567",
      airlineId: airlines[0]?.id ?? "",
      lodgingTypeId: lodgingTypes[0]?.id ?? "",
      accommodationId: accommodations[0]?.id ?? "",
      contractStatus: ContractStatus.SENT,
      docsStatus: DocsStatus.UPLOADED,
      passportStatus: PassportStatus.ENTERED,
      seats: 1,
      insuranceId: "",
      luggage: true,
      details: "Vegana",
      nationalityId: "",
      itineraryStatus: ItineraryStatus.READY,
      wantsReservation: true,
      packageName: "Gira Cancun Marzo",
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
      enteredByUserId: currentUser.id,
      assignedToUserId: currentUser.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: makeId("member", 2),
      tripId: makeId("trip", 1),
      fullName: "Luis Perez",
      phone: "+52 555 010 1002",
      email: "luis.perez@correo.com",
      reservationCode: "RES-1002",
      identificationTypeId: identificationTypes[1]?.id ?? "",
      identification: "DPI-8901",
      airlineId: airlines[1]?.id ?? "",
      lodgingTypeId: lodgingTypes[1]?.id ?? "",
      accommodationId: accommodations[1]?.id ?? "",
      contractStatus: ContractStatus.MISSING,
      docsStatus: DocsStatus.NOT_UPLOADED,
      passportStatus: PassportStatus.NOT_ENTERED,
      seats: 2,
      insuranceId: "",
      luggage: false,
      details: "",
      nationalityId: "",
      itineraryStatus: ItineraryStatus.MISSING,
      wantsReservation: true,
      packageName: "Gira Cancun Marzo",
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
      enteredByUserId: currentUser.id,
      assignedToUserId: currentUser.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: makeId("member", 3),
      tripId: makeId("trip", 2),
      fullName: "Camila Vega",
      phone: "+52 555 010 1003",
      email: "camila.vega@correo.com",
      reservationCode: "RES-1003",
      identificationTypeId: identificationTypes[2]?.id ?? "",
      identification: "LIC-5521",
      airlineId: airlines[2]?.id ?? "",
      lodgingTypeId: lodgingTypes[2]?.id ?? "",
      accommodationId: accommodations[2]?.id ?? "",
      contractStatus: ContractStatus.SENT,
      docsStatus: DocsStatus.NOT_UPLOADED,
      passportStatus: PassportStatus.ENTERED,
      seats: 1,
      insuranceId: "",
      luggage: true,
      details: "",
      nationalityId: "",
      itineraryStatus: ItineraryStatus.READY,
      wantsReservation: true,
      packageName: "Ruta Bogota Abril",
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
      enteredByUserId: currentUser.id,
      assignedToUserId: currentUser.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  ];

  private leads: Lead[] = [
    {
      id: makeId("lead", 1),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      agentUserId: currentUser.id,
      fullName: "Mario Rios",
      identificationTypeId: identificationTypes[0]?.id ?? "",
      identification: "C-9901",
      phone: "+506 7001 9900",
      email: "mario.rios@correo.com",
      wantsReservation: false,
      notes: "Interesado en mayo, quiere informacion.",
      quoteDestination: "",
      quoteTravelMonth: "",
      quoteStatus: QuoteStatus.PENDING,
      quoteCode: "",
      quoteTakenByUserId: null,
      quoteTakenAt: null,
      quoteStatusUpdatedAt: null,
      quoteOfferSentAt: null,
      quoteWonAt: null,
      quotePausedAt: null,
      quoteLostAt: null,
      quoteTripId: null,
      quoteTripMemberId: null,
    },
  ];

  private catalogs: Record<CatalogName, CatalogItem[]> = {
    airlines: cloneCatalogs(airlines),
    lodgingTypes: cloneCatalogs(lodgingTypes),
    accommodations: cloneCatalogs(accommodations),
    insurances: cloneCatalogs(insurances),
    nationalities: cloneCatalogs(nationalities),
    identificationTypes: cloneCatalogs(identificationTypes),
  };

  private contractModifications: ContractModificationRequest[] = [];
  private timePunches: TimePunch[] = [];
  private holidayDates: HolidayDate[] = [];
  private payrollDeductions: PayrollDeduction[] = [];
  private payrollPayslips: PayrollPayslip[] = [];
  private payrollGlobalConfig: PayrollGlobalConfig = {
    retentionRate: 0.1083,
  };
  private payrollRoleConfigs: PayrollRoleConfig[] = [
    {
      role: Role.ADMIN,
      baseHourlyRate: 15,
      baseDailyHours: 8,
      overtimeMultiplier: 1.5,
      holidayMultiplier: 2,
      severanceRate: 0.0833,
      commissionRate: 0,
    },
    {
      role: Role.AGENT,
      baseHourlyRate: 8,
      baseDailyHours: 8,
      overtimeMultiplier: 1.5,
      holidayMultiplier: 2,
      severanceRate: 0.0833,
      commissionRate: 0,
    },
    {
      role: Role.SUPERVISOR,
      baseHourlyRate: 12,
      baseDailyHours: 8,
      overtimeMultiplier: 1.5,
      holidayMultiplier: 2,
      severanceRate: 0.0833,
      commissionRate: 0,
    },
    {
      role: Role.CONTRACTS,
      baseHourlyRate: 10,
      baseDailyHours: 8,
      overtimeMultiplier: 1.5,
      holidayMultiplier: 2,
      severanceRate: 0.0833,
      commissionRate: 0,
    },
    {
      role: Role.QUOTES,
      baseHourlyRate: 10,
      baseDailyHours: 8,
      overtimeMultiplier: 1.5,
      holidayMultiplier: 2,
      severanceRate: 0.0833,
      commissionRate: 0,
    },
    {
      role: Role.BILLING,
      baseHourlyRate: 10,
      baseDailyHours: 8,
      overtimeMultiplier: 1.5,
      holidayMultiplier: 2,
      severanceRate: 0.0833,
      commissionRate: 0,
    },
    {
      role: Role.VIEWER,
      baseHourlyRate: 8,
      baseDailyHours: 8,
      overtimeMultiplier: 1.5,
      holidayMultiplier: 2,
      severanceRate: 0.0833,
      commissionRate: 0,
    },
  ];

  async listTrips(): Promise<Trip[]> {
    return this.trips.map((trip) => ({ ...trip }));
  }

  async getTrip(id: string): Promise<Trip | null> {
    const trip = this.trips.find((item) => item.id === id);
    return trip ? { ...trip } : null;
  }

  async listTripMembers(tripId: string): Promise<TripMember[]> {
    return this.tripMembers
      .filter((member) => member.tripId === tripId)
      .map((member) => ({ ...member }));
  }

  async listContractsQueue(): Promise<TripMember[]> {
    return this.tripMembers
      .filter((member) => member.contractsStatus === ContractsStatus.SENT)
      .map((member) => ({ ...member }));
  }

  async listContractModifications(): Promise<ContractModificationRequest[]> {
    return this.contractModifications.map((item) => ({ ...item }));
  }

  async listTimePunches(): Promise<TimePunch[]> {
    return this.timePunches.map((item) => ({ ...item }));
  }

  async listPayrollRoleConfigs(): Promise<PayrollRoleConfig[]> {
    return this.payrollRoleConfigs.map((item) => ({ ...item }));
  }

  async updatePayrollRoleConfig(config: UpdatePayrollRoleConfig): Promise<PayrollRoleConfig> {
    const index = this.payrollRoleConfigs.findIndex((item) => item.role === config.role);
    if (index === -1) {
      const created: PayrollRoleConfig = {
        role: config.role,
        baseHourlyRate: config.baseHourlyRate ?? 0,
        baseDailyHours: config.baseDailyHours ?? 8,
        overtimeMultiplier: config.overtimeMultiplier ?? 1.5,
        holidayMultiplier: config.holidayMultiplier ?? 2,
        severanceRate: config.severanceRate ?? 0,
        commissionRate: config.commissionRate ?? 0,
      };
      this.payrollRoleConfigs.push(created);
      return { ...created };
    }

    const updated: PayrollRoleConfig = {
      ...this.payrollRoleConfigs[index],
      ...config,
    };
    this.payrollRoleConfigs[index] = updated;
    return { ...updated };
  }

  async getPayrollGlobalConfig(): Promise<PayrollGlobalConfig> {
    return { ...this.payrollGlobalConfig };
  }

  async updatePayrollGlobalConfig(
    config: UpdatePayrollGlobalConfig,
  ): Promise<PayrollGlobalConfig> {
    this.payrollGlobalConfig = {
      ...this.payrollGlobalConfig,
      ...config,
    };
    return { ...this.payrollGlobalConfig };
  }

  async listHolidayDates(): Promise<HolidayDate[]> {
    return this.holidayDates.map((item) => ({ ...item }));
  }

  async addHolidayDate(input: CreateHolidayDateInput): Promise<HolidayDate> {
    const date: HolidayDate = {
      id: makeId("holiday", ++this.holidayCounter),
      ...input,
    };
    this.holidayDates.push(date);
    return { ...date };
  }

  async deleteHolidayDate(id: string): Promise<boolean> {
    const index = this.holidayDates.findIndex((item) => item.id === id);
    if (index === -1) {
      return false;
    }
    this.holidayDates.splice(index, 1);
    return true;
  }

  async listPayrollDeductions(): Promise<PayrollDeduction[]> {
    return this.payrollDeductions.map((item) => ({ ...item }));
  }

  async addPayrollDeduction(input: CreatePayrollDeductionInput): Promise<PayrollDeduction> {
    const record: PayrollDeduction = {
      id: makeId("deduction", ++this.deductionCounter),
      createdAt: nowIso(),
      createdByUserId: currentUser.id,
      ...input,
    };
    this.payrollDeductions.push(record);
    return { ...record };
  }

  async deletePayrollDeduction(id: string): Promise<boolean> {
    const index = this.payrollDeductions.findIndex((item) => item.id === id);
    if (index === -1) {
      return false;
    }
    this.payrollDeductions.splice(index, 1);
    return true;
  }

  async listPayrollPayslips(): Promise<PayrollPayslip[]> {
    return this.payrollPayslips.map((item) => ({ ...item }));
  }

  async createPayrollPayslip(input: CreatePayrollPayslipInput): Promise<PayrollPayslip> {
    const { sentAt, sentByUserId, ...rest } = input;
    const payslip: PayrollPayslip = {
      id: makeId("payslip", ++this.payslipCounter),
      generatedAt: nowIso(),
      ...rest,
      sentAt: sentAt ?? nowIso(),
      sentByUserId: sentByUserId ?? currentUser.id,
    };
    this.payrollPayslips.push(payslip);
    return { ...payslip };
  }

  async updateTripMember(
    tripId: string,
    memberId: string,
    patch: UpdateTripMemberPatch,
  ): Promise<TripMember | null> {
    const index = this.tripMembers.findIndex(
      (member) => member.tripId === tripId && member.id === memberId,
    );

    if (index === -1) {
      return null;
    }

    const updated: TripMember = {
      ...this.tripMembers[index],
      ...patch,
      updatedAt: nowIso(),
    };

    this.tripMembers[index] = updated;
    return { ...updated };
  }

  async createTrip(input: CreateTripInput): Promise<Trip> {
    const trip: Trip = {
      id: makeId("trip", ++this.tripCounter),
      ...input,
    };

    this.trips.push(trip);
    return { ...trip };
  }

  async createTripMember(
    tripId: string,
    input: CreateTripMemberInput,
  ): Promise<TripMember> {
    const existingCodes = new Set(this.tripMembers.map((member) => member.reservationCode));
    const member: TripMember = {
      id: makeId("member", ++this.memberCounter),
      tripId,
      enteredByUserId: currentUser.id,
      assignedToUserId: input.assignedToUserId ?? currentUser.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...input,
      reservationCode: makeUniqueReservationCode(existingCodes),
    };

    this.tripMembers.push(member);
    return { ...member };
  }

  async createContractModification(
    input: CreateContractModificationInput,
  ): Promise<ContractModificationRequest> {
    const modification: ContractModificationRequest = {
      id: makeId("mod", ++this.modificationCounter),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...input,
      assignedToUserId: input.assignedToUserId ?? input.requestedByUserId,
      processedByUserId: input.processedByUserId ?? null,
      processedAt: input.processedAt ?? null,
      status: ContractModificationStatus.PENDING,
    };

    this.contractModifications.push(modification);
    return { ...modification };
  }

  async createTimePunch(
    input: CreateTimePunchInput,
    options?: { override?: boolean },
  ): Promise<TimePunch> {
    const override = options?.override === true;
    const dayKey = input.occurredAt.split("T")[0];
    const dayPunches = this.timePunches.filter(
      (item) => item.userId === input.userId && item.occurredAt.split("T")[0] === dayKey,
    );
    const existingType = dayPunches.find((item) => item.type === input.type);
    if (existingType && !override) {
      throw new Error("Punch ya registrado para este tipo.");
    }

    if (!override) {
      const order: TimePunchType[] = [
        TimePunchType.ENTRY,
        TimePunchType.BREAK1_START,
        TimePunchType.BREAK1_END,
        TimePunchType.LUNCH_OUT,
        TimePunchType.LUNCH_IN,
        TimePunchType.BREAK2_START,
        TimePunchType.BREAK2_END,
        TimePunchType.EXIT,
      ];
      const usedTypes = new Set(dayPunches.map((item) => item.type));
      const nextType = order.find((type) => !usedTypes.has(type));
      if (nextType && input.type !== nextType) {
        throw new Error("Punch fuera de orden.");
      }
    }
    const punch: TimePunch = {
      id: makeId("punch", ++this.timePunchCounter),
      createdAt: nowIso(),
      ...input,
    };

    this.timePunches.push(punch);
    return { ...punch };
  }

  async updateContractModification(
    requestId: string,
    patch: UpdateContractModificationPatch,
  ): Promise<ContractModificationRequest | null> {
    const index = this.contractModifications.findIndex((item) => item.id === requestId);
    if (index === -1) {
      return null;
    }

    const updated: ContractModificationRequest = {
      ...this.contractModifications[index],
      ...patch,
      updatedAt: nowIso(),
    };

    this.contractModifications[index] = updated;
    return { ...updated };
  }

  async listCatalog(catalogName: CatalogName): Promise<CatalogItem[]> {
    return this.catalogs[catalogName].map((item) => ({ ...item }));
  }

  async listLeads(): Promise<Lead[]> {
    return this.leads.map((lead) => ({ ...lead }));
  }

  async createLead(input: CreateLeadInput): Promise<Lead> {
    const now = nowIso();
    const existingCodes = new Set(this.leads.map((lead) => lead.quoteCode).filter(Boolean));
    const lead: Lead = {
      id: makeId("lead", this.leads.length + 1),
      createdAt: now,
      updatedAt: now,
      agentUserId: input.agentUserId ?? currentUser.id,
      ...input,
      quoteDestination: input.quoteDestination ?? "",
      quoteTravelMonth: input.quoteTravelMonth ?? "",
      quoteStatus: input.quoteStatus ?? QuoteStatus.PENDING,
      quoteCode: input.quoteCode ?? "",
      quoteTakenByUserId: input.quoteTakenByUserId ?? null,
      quoteTakenAt: input.quoteTakenAt ?? null,
      quoteStatusUpdatedAt: input.quoteStatusUpdatedAt ?? now,
      quoteOfferSentAt: input.quoteOfferSentAt ?? null,
      quoteWonAt: input.quoteWonAt ?? null,
      quotePausedAt: input.quotePausedAt ?? null,
      quoteLostAt: input.quoteLostAt ?? null,
      quoteTripId: input.quoteTripId ?? null,
      quoteTripMemberId: input.quoteTripMemberId ?? null,
    };

    if (!lead.quoteCode && lead.quoteStatus !== QuoteStatus.PENDING) {
      lead.quoteCode = makeUniqueQuoteCode(existingCodes);
    }

    this.leads.push(lead);
    return { ...lead };
  }

  async updateLead(leadId: string, patch: UpdateLeadPatch): Promise<Lead | null> {
    const index = this.leads.findIndex((lead) => lead.id === leadId);
    if (index === -1) {
      return null;
    }

    const now = nowIso();
    const prev = this.leads[index];
    const updated: Lead = {
      ...prev,
      ...patch,
      updatedAt: now,
    };

    if (patch.quoteStatus && patch.quoteStatus !== prev.quoteStatus) {
      updated.quoteStatusUpdatedAt = patch.quoteStatusUpdatedAt ?? now;
      if (patch.quoteStatus === QuoteStatus.IN_PROGRESS) {
        updated.quoteTakenAt = patch.quoteTakenAt ?? prev.quoteTakenAt ?? now;
        updated.quoteTakenByUserId =
          patch.quoteTakenByUserId ?? prev.quoteTakenByUserId ?? currentUser.id;
      }
      if (patch.quoteStatus === QuoteStatus.OFFER_SENT) {
        updated.quoteOfferSentAt = patch.quoteOfferSentAt ?? now;
      }
      if (patch.quoteStatus === QuoteStatus.WON) {
        updated.quoteWonAt = patch.quoteWonAt ?? now;
      }
      if (patch.quoteStatus === QuoteStatus.PAUSED) {
        updated.quotePausedAt = patch.quotePausedAt ?? now;
      }
      if (patch.quoteStatus === QuoteStatus.LOST) {
        updated.quoteLostAt = patch.quoteLostAt ?? now;
      }
    }

    if (!updated.quoteCode && updated.quoteStatus !== QuoteStatus.PENDING) {
      const existingCodes = new Set(this.leads.map((lead) => lead.quoteCode).filter(Boolean));
      updated.quoteCode = makeUniqueQuoteCode(existingCodes);
    }

    this.leads[index] = updated;
    return { ...updated };
  }

  async addCatalogItem(catalogName: CatalogName, name: string): Promise<CatalogItem> {
    if (currentUser.role !== Role.ADMIN) {
      throw new Error("Only admins can add catalog items.");
    }

    const newItem: CatalogItem = {
      id: makeId("catalog", ++this.catalogCounter),
      name,
      active: true,
    };

    this.catalogs[catalogName].push(newItem);
    return { ...newItem };
  }

  async updateCatalogItem(
    catalogName: CatalogName,
    id: string,
    patch: UpdateCatalogItemPatch,
  ): Promise<CatalogItem | null> {
    if (currentUser.role !== Role.ADMIN) {
      throw new Error("Only admins can update catalog items.");
    }

    const items = this.catalogs[catalogName];
    const index = items.findIndex((item) => item.id === id);

    if (index === -1) {
      return null;
    }

    const updated: CatalogItem = {
      ...items[index],
      ...patch,
    };

    items[index] = updated;
    return { ...updated };
  }

  async deleteCatalogItem(catalogName: CatalogName, id: string): Promise<boolean> {
    if (currentUser.role !== Role.ADMIN) {
      throw new Error("Only admins can delete catalog items.");
    }

    const items = this.catalogs[catalogName];
    const index = items.findIndex((item) => item.id === id);

    if (index === -1) {
      return false;
    }

    items.splice(index, 1);
    return true;
  }

  async deriveQueue(currentUserId: string): Promise<TripMember[]> {
    const isPending = (member: TripMember) =>
      member.contractStatus === ContractStatus.MISSING ||
      member.docsStatus === DocsStatus.NOT_UPLOADED ||
      member.passportStatus === PassportStatus.NOT_ENTERED ||
      member.itineraryStatus === ItineraryStatus.MISSING;

    return this.tripMembers
      .filter((member) => member.assignedToUserId === currentUserId)
      .filter(isPending)
      .map((member) => ({ ...member }));
  }
}
