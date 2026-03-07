import type {
  CatalogItem,
  CatalogName,
  Client,
  ClientPurchase,
  ContractModificationRequest,
  CreateContractModificationInput,
  CreateClientInput,
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
  UpsellOrder,
  UpsellOrderLine,
  TimePunch,
  UpdateContractModificationPatch,
  UpdateCatalogItemPatch,
  UpdateClientPatch,
  UpdateBillingConfig,
  UpdateLeadPatch,
  CreateUpsellOrderInput,
  UpdateUpsellOrderPatch,
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
  UpsellOrderStatus,
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
import type { BillingConfig } from "../types/ops";

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
  private clientCounter = 1;
  private catalogCounter = 100;
  private modificationCounter = 0;
  private timePunchCounter = 0;
  private holidayCounter = 0;
  private deductionCounter = 0;
  private payslipCounter = 0;
  private upsellOrderCounter = 0;

  private trips: Trip[] = [
    {
      id: makeId("trip", 1),
      name: "Gira Cancun Marzo",
      dateFrom: "2026-03-10",
      dateTo: "2026-03-17",
      status: "ACTIVE",
      maxSeats: 40,
      lodgingType: "HOTEL",
      packageBasePrice: 1200,
      reservationMinPerPerson: 300,
    },
    {
      id: makeId("trip", 2),
      name: "Ruta Bogota Abril",
      dateFrom: "2026-04-02",
      dateTo: "2026-04-09",
      status: "PLANNED",
      maxSeats: 28,
      lodgingType: "HOSTEL",
      packageBasePrice: 850,
      reservationMinPerPerson: 200,
    },
  ];

  private tripMembers: TripMember[] = [
    {
      id: makeId("member", 1),
      tripId: makeId("trip", 1),
      clientId: makeId("client", 1),
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
      packageLodgingType: "HOTEL",
      packageBasePrice: 1200,
      packageFinalPrice: 1200,
      reservationMinPerPerson: 300,
      reservationFinalPerPerson: 300,
      paymentPlanMonths: 6,
      paymentBalanceTotal: 900,
      paymentInstallmentAmount: 150,
      accommodationType: "TWIN",
      seatUnitPrice: 0,
      luggageType: "CARRY_ON",
      luggageQuantity: 0,
      luggageUnitPrice: 0,
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
      enteredByUserId: currentUser.id,
      assignedToUserId: currentUser.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: makeId("member", 2),
      tripId: makeId("trip", 1),
      clientId: null,
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
      packageLodgingType: "HOTEL",
      packageBasePrice: 1200,
      packageFinalPrice: 1200,
      reservationMinPerPerson: 300,
      reservationFinalPerPerson: 300,
      paymentPlanMonths: 6,
      paymentBalanceTotal: 1800,
      paymentInstallmentAmount: 300,
      accommodationType: "MATRIMONIAL",
      seatUnitPrice: 0,
      luggageType: "CARRY_ON",
      luggageQuantity: 0,
      luggageUnitPrice: 0,
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
      enteredByUserId: currentUser.id,
      assignedToUserId: currentUser.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: makeId("member", 3),
      tripId: makeId("trip", 2),
      clientId: null,
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
      packageLodgingType: "HOSTEL",
      packageBasePrice: 850,
      packageFinalPrice: 850,
      reservationMinPerPerson: 200,
      reservationFinalPerPerson: 200,
      paymentPlanMonths: 6,
      paymentBalanceTotal: 650,
      paymentInstallmentAmount: 108.33,
      accommodationType: "TWIN",
      seatUnitPrice: 0,
      luggageType: "CARRY_ON",
      luggageQuantity: 0,
      luggageUnitPrice: 0,
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
      quoteTravelDateFrom: "",
      quoteTravelDateTo: "",
      quotePartySize: null,
      quoteDraft: null,
      quoteDraftUpdatedAt: null,
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

  private upsellOrders: UpsellOrder[] = [];

  private clients: Client[] = [
    {
      id: makeId("client", 1),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      firstName: "Ana",
      lastName: "Torres",
      fullName: "Ana Torres",
      identificationTypeId: identificationTypes[0]?.id ?? "",
      identification: "A1234567",
      phone: "+52 555 010 1001",
      email: "ana.torres@correo.com",
      nationalityId: "",
      medicalNotes: "Vegana",
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
  private billingConfig: BillingConfig = {
    exchangeRate: 500,
    cardFeeRate: 0.05,
    vendorCommissionRate: 0.05,
    taxRate: 0.13,
    quoteMarginRates: {
      flightsInternational: 0.12,
      flightsDomestic: 0.1,
      tours: 0.15,
      lodging: 0.12,
      transfers: 0.1,
      extras: 0.1,
    },
    perPaxFeeTiers: [
      { id: "ops_fee_tier_1", minPax: 1, maxPax: 3, feePerPax: 250 },
      { id: "ops_fee_tier_2", minPax: 4, maxPax: 6, feePerPax: 200 },
      { id: "ops_fee_tier_3", minPax: 7, maxPax: null, feePerPax: 150 },
    ],
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

  async getBillingConfig(): Promise<BillingConfig> {
    return { ...this.billingConfig };
  }

  async updateBillingConfig(config: UpdateBillingConfig): Promise<BillingConfig> {
    this.billingConfig = {
      ...this.billingConfig,
      ...config,
    };
    return { ...this.billingConfig };
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

  private findClientMatch(member: Pick<TripMember, "email" | "identification">): Client | null {
    const email = member.email?.trim().toLowerCase();
    if (email) {
      const byEmail = this.clients.find(
        (client) => client.email?.trim().toLowerCase() === email,
      );
      if (byEmail) {
        return byEmail;
      }
    }
    const identification = member.identification?.trim();
    if (identification) {
      return this.clients.find((client) => client.identification === identification) ?? null;
    }
    return null;
  }

  private splitFullName(fullName: string) {
    const trimmed = fullName.trim();
    if (!trimmed) {
      return { firstName: "", lastName: "" };
    }
    const parts = trimmed.split(/\s+/);
    const [firstName, ...rest] = parts;
    return { firstName, lastName: rest.join(" ") };
  }

  private buildFullName(firstName: string, lastName: string, fallback: string) {
    const combined = `${firstName} ${lastName}`.trim();
    return combined || fallback || "";
  }

  private upsertClientFromMember(member: TripMember): Client {
    const now = nowIso();
    const preferValue = (nextValue: string, prevValue: string) =>
      nextValue && nextValue.trim() ? nextValue : prevValue;
    const nameParts = this.splitFullName(member.fullName);
    const existing = this.findClientMatch(member);
    if (existing) {
      const nextFirstName = preferValue(nameParts.firstName, existing.firstName);
      const nextLastName = preferValue(nameParts.lastName, existing.lastName);
      const updated: Client = {
        ...existing,
        firstName: nextFirstName,
        lastName: nextLastName,
        fullName: this.buildFullName(
          nextFirstName,
          nextLastName,
          preferValue(member.fullName, existing.fullName),
        ),
        identificationTypeId: preferValue(
          member.identificationTypeId,
          existing.identificationTypeId,
        ),
        identification: preferValue(member.identification, existing.identification),
        phone: preferValue(member.phone, existing.phone),
        email: preferValue(member.email, existing.email),
        nationalityId: preferValue(member.nationalityId, existing.nationalityId),
        medicalNotes: preferValue(member.specialSituations, existing.medicalNotes),
        updatedAt: now,
      };
      const index = this.clients.findIndex((client) => client.id === existing.id);
      if (index >= 0) {
        this.clients[index] = updated;
      }
      return updated;
    }

    const created: Client = {
      id: makeId("client", ++this.clientCounter),
      createdAt: now,
      updatedAt: now,
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      fullName: this.buildFullName(nameParts.firstName, nameParts.lastName, member.fullName),
      identificationTypeId: member.identificationTypeId,
      identification: member.identification,
      phone: member.phone,
      email: member.email,
      nationalityId: member.nationalityId,
      medicalNotes: member.specialSituations,
    };
    this.clients.push(created);
    return created;
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

    const updatedBase: TripMember = {
      ...this.tripMembers[index],
      ...patch,
      updatedAt: nowIso(),
    };

    let updated = updatedBase;
    const hasClient = updated.clientId
      ? this.clients.some((client) => client.id === updated.clientId)
      : false;
    const shouldEnsureClient =
      updated.contractsStatus === ContractsStatus.SENT && (!updated.clientId || !hasClient);

    if (shouldEnsureClient) {
      const client = this.upsertClientFromMember(updated);
      updated = { ...updated, clientId: client.id };
    }

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
    let member: TripMember = {
      id: makeId("member", ++this.memberCounter),
      tripId,
      enteredByUserId: currentUser.id,
      assignedToUserId: input.assignedToUserId ?? currentUser.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...input,
      reservationCode: makeUniqueReservationCode(existingCodes),
      clientId: input.clientId ?? null,
      paymentBalanceTotal: input.paymentBalanceTotal ?? null,
      paymentInstallmentAmount: input.paymentInstallmentAmount ?? null,
      billingTotalAmount: input.billingTotalAmount ?? null,
    };

    if (member.contractsStatus === ContractsStatus.SENT) {
      const client = this.upsertClientFromMember(member);
      member = { ...member, clientId: client.id };
    }

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

  async listClients(): Promise<Client[]> {
    return this.clients.map((client) => ({ ...client }));
  }

  async listClientPurchases(clientId: string): Promise<ClientPurchase[]> {
    const items = this.tripMembers.filter((member) => member.clientId === clientId);
    const mapped = items.map((member) => {
      const trip = this.trips.find((entry) => entry.id === member.tripId);
      return {
        tripId: member.tripId,
        tripName: trip?.name ?? "-",
        tripDateFrom: trip?.dateFrom ?? "",
        tripDateTo: trip?.dateTo ?? "",
        memberId: member.id,
        reservationCode: member.reservationCode,
        contractsStatus: member.contractsStatus,
        contractsSentAt: member.contractsSentAt,
        billingStatus: member.billingStatus,
        totalAmount: member.billingTotalAmount ?? null,
        createdAt: member.createdAt,
      };
    });
    return mapped.sort((a, b) => (b.contractsSentAt ?? b.createdAt).localeCompare(a.contractsSentAt ?? a.createdAt));
  }

  async createClient(input: CreateClientInput): Promise<Client> {
    const now = nowIso();
    const firstName = input.firstName ?? "";
    const lastName = input.lastName ?? "";
    const fullName = this.buildFullName(firstName, lastName, input.fullName ?? "");
    const client: Client = {
      id: makeId("client", ++this.clientCounter),
      createdAt: now,
      updatedAt: now,
      ...input,
      firstName,
      lastName,
      fullName,
      identificationTypeId: input.identificationTypeId ?? "",
      identification: input.identification ?? "",
      phone: input.phone ?? "",
      email: input.email ?? "",
      nationalityId: input.nationalityId ?? "",
      medicalNotes: input.medicalNotes ?? "",
    };

    this.clients.push(client);
    return { ...client };
  }

  async updateClient(clientId: string, patch: UpdateClientPatch): Promise<Client | null> {
    const index = this.clients.findIndex((client) => client.id === clientId);
    if (index === -1) {
      return null;
    }

    const current = this.clients[index];
    const nextFirstName = patch.firstName ?? current.firstName;
    const nextLastName = patch.lastName ?? current.lastName;
    const nextFullName = this.buildFullName(
      nextFirstName,
      nextLastName,
      patch.fullName ?? current.fullName,
    );
    const updated: Client = {
      ...current,
      ...patch,
      firstName: nextFirstName,
      lastName: nextLastName,
      fullName: nextFullName,
      updatedAt: nowIso(),
    };
    this.clients[index] = updated;
    return { ...updated };
  }

  async deleteClient(clientId: string): Promise<boolean> {
    const index = this.clients.findIndex((client) => client.id === clientId);
    if (index === -1) {
      return false;
    }
    this.clients.splice(index, 1);
    this.tripMembers = this.tripMembers.map((member) =>
      member.clientId === clientId ? { ...member, clientId: null, updatedAt: nowIso() } : member,
    );
    return true;
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
      quoteTravelDateFrom: input.quoteTravelDateFrom ?? "",
      quoteTravelDateTo: input.quoteTravelDateTo ?? "",
      quotePartySize: input.quotePartySize ?? null,
      quoteStatus: input.quoteStatus ?? QuoteStatus.PENDING,
      quoteCode: input.quoteCode ?? "",
      quoteDraft: input.quoteDraft ?? null,
      quoteDraftUpdatedAt: input.quoteDraftUpdatedAt ?? null,
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

    if (patch.quoteDraft !== undefined) {
      updated.quoteDraftUpdatedAt = patch.quoteDraftUpdatedAt ?? now;
    }

    if (!updated.quoteCode && updated.quoteStatus !== QuoteStatus.PENDING) {
      const existingCodes = new Set(this.leads.map((lead) => lead.quoteCode).filter(Boolean));
      updated.quoteCode = makeUniqueQuoteCode(existingCodes);
    }

    this.leads[index] = updated;
    return { ...updated };
  }

  async listUpsellOrders(): Promise<UpsellOrder[]> {
    return this.upsellOrders.map((order) => ({
      ...order,
      lines: order.lines.map((line) => ({ ...line })),
    }));
  }

  async createUpsellOrder(input: CreateUpsellOrderInput): Promise<UpsellOrder> {
    const now = nowIso();
    const normalizedLines: UpsellOrderLine[] = input.lines.map((line) => ({
      ...line,
      ownerName: line.ownerName?.trim() || "Titular",
      quantity: Math.max(0, line.quantity),
      unitPrice: Math.max(0, line.unitPrice),
      totalPrice: Math.max(0, line.quantity) * Math.max(0, line.unitPrice),
    }));
    const totalAmount = normalizedLines.reduce((sum, line) => sum + line.totalPrice, 0);

    const created: UpsellOrder = {
      id: makeId("upsell", ++this.upsellOrderCounter),
      tripId: input.tripId,
      tripMemberId: input.tripMemberId,
      leadId: input.leadId ?? null,
      clientId: input.clientId ?? null,
      quoteCode: input.quoteCode ?? null,
      status: input.status ?? UpsellOrderStatus.SENT_TO_PURCHASES,
      currency: input.currency ?? "USD",
      totalAmount,
      notes: input.notes ?? "",
      lines: normalizedLines,
      createdByUserId: input.createdByUserId,
      createdAt: now,
      updatedAt: now,
    };

    this.upsellOrders.push(created);
    return {
      ...created,
      lines: created.lines.map((line) => ({ ...line })),
    };
  }

  async updateUpsellOrder(
    orderId: string,
    patch: UpdateUpsellOrderPatch,
  ): Promise<UpsellOrder | null> {
    const index = this.upsellOrders.findIndex((order) => order.id === orderId);
    if (index === -1) {
      return null;
    }

    const nextLines = patch.lines
      ? patch.lines.map((line) => ({
          ...line,
          ownerName: line.ownerName?.trim() || "Titular",
          quantity: Math.max(0, line.quantity),
          unitPrice: Math.max(0, line.unitPrice),
          totalPrice: Math.max(0, line.quantity) * Math.max(0, line.unitPrice),
        }))
      : this.upsellOrders[index].lines;

    const updated: UpsellOrder = {
      ...this.upsellOrders[index],
      ...patch,
      lines: nextLines,
      totalAmount: nextLines.reduce((sum, line) => sum + line.totalPrice, 0),
      updatedAt: nowIso(),
    };

    this.upsellOrders[index] = updated;
    return {
      ...updated,
      lines: updated.lines.map((line) => ({ ...line })),
    };
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
