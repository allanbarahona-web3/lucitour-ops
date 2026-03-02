export enum ContractStatus {
  SENT = "SENT",
  MISSING = "MISSING",
}

export enum DocsStatus {
  UPLOADED = "UPLOADED",
  NOT_UPLOADED = "NOT_UPLOADED",
}

export enum PassportStatus {
  ENTERED = "ENTERED",
  NOT_ENTERED = "NOT_ENTERED",
}

export enum ItineraryStatus {
  READY = "READY",
  MISSING = "MISSING",
  NOT_APPLICABLE = "NOT_APPLICABLE",
}

export enum Role {
  ADMIN = "ADMIN",
  AGENT = "AGENT",
  SUPERVISOR = "SUPERVISOR",
  ACCOUNTING = "ACCOUNTING",
  CONTRACTS = "CONTRACTS",
  QUOTES = "QUOTES",
  BILLING = "BILLING",
  VIEWER = "VIEWER",
}

export enum TimePunchType {
  ENTRY = "ENTRY",
  BREAK1_START = "BREAK1_START",
  BREAK1_END = "BREAK1_END",
  LUNCH_OUT = "LUNCH_OUT",
  LUNCH_IN = "LUNCH_IN",
  BREAK2_START = "BREAK2_START",
  BREAK2_END = "BREAK2_END",
  EXIT = "EXIT",
}

export interface PayrollRoleConfig {
  role: Role;
  baseHourlyRate: number;
  baseDailyHours: number;
  overtimeMultiplier: number;
  holidayMultiplier: number;
  severanceRate: number;
  commissionRate: number;
}

export interface PayrollGlobalConfig {
  retentionRate: number;
}

export interface PayrollDeduction {
  id: string;
  userId: string;
  periodType: "biweekly_1" | "biweekly_2" | "monthly";
  periodMonth: string;
  amount: number;
  reason: string;
  receiptNote: string;
  createdAt: string;
  createdByUserId: string;
}

export interface PayrollPayslip {
  id: string;
  userId: string;
  periodType: "biweekly_1" | "biweekly_2" | "monthly";
  periodMonth: string;
  grossPay: number;
  overtimePay: number;
  holidayPay: number;
  commissionPay: number;
  deductionPay: number;
  retentionPay: number;
  netPay: number;
  totalHours: number;
  daysWorked: number;
  vacationDays: number;
  generatedAt: string;
  sentAt: string | null;
  sentByUserId: string | null;
  pdfContent: string;
}

export interface HolidayDate {
  id: string;
  date: string;
  label: string;
}

export enum MaritalStatus {
  SINGLE = "SINGLE",
  MARRIED = "MARRIED",
  DIVORCED = "DIVORCED",
  WIDOWED = "WIDOWED",
}

export enum ContractsStatus {
  NOT_SENT = "NOT_SENT",
  SENT = "SENT",
}

export type ContractModificationStep = "STEP1" | "STEP2" | "STEP3" | "STEP4";

export enum ContractModificationStatus {
  PENDING = "PENDING",
  DONE = "DONE",
}

export type DocumentType = "ID_CARD" | "PASSPORT" | "MINOR_PERMIT" | "INSURANCE";

export interface DocumentUpload {
  id: string;
  type: DocumentType;
  fileName: string;
  ownerName: string;
}

export interface Companion {
  id: string;
  fullName: string;
  identification: string;
  isMinor: boolean;
}

export type TripStatus = "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export interface Trip {
  id: string;
  name: string;
  dateFrom: string;
  dateTo: string;
  status: TripStatus;
  maxSeats: number;
}

export interface TripMember {
  id: string;
  tripId: string;
  fullName: string;
  phone: string;
  email: string;
  reservationCode: string;
  identificationTypeId: string;
  identification: string;
  airlineId: string;
  lodgingTypeId: string;
  accommodationId: string;
  contractStatus: ContractStatus;
  docsStatus: DocsStatus;
  passportStatus: PassportStatus;
  seats: number;
  insuranceId: string;
  luggage: boolean;
  details: string;
  nationalityId: string;
  itineraryStatus: ItineraryStatus;
  wantsReservation: boolean;
  packageName: string;
  address: string;
  maritalStatus: MaritalStatus | "";
  profession: string;
  wantsInsurance: boolean | null;
  hasOwnInsurance: boolean | null;
  emergencyContactName: string;
  emergencyContactPhone: string;
  specialSituations: string;
  hasCompanions: boolean | null;
  companions: Companion[];
  hasMinorCompanions: boolean;
  hasParentalAuthority: boolean | null;
  documents: DocumentUpload[];
  docFlags: {
    idCard: boolean;
    passport: boolean;
    minorPermit: boolean;
    insurance: boolean;
  };
  isDraft: boolean;
  contractsStatus: ContractsStatus;
  contractsSentByUserId: string | null;
  contractsSentAt: string | null;
  enteredByUserId: string;
  assignedToUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContractModificationRequest {
  id: string;
  tripId: string;
  memberId: string;
  step: ContractModificationStep;
  payload: Partial<TripMember>;
  requestedByUserId: string;
  assignedToUserId: string | null;
  processedByUserId: string | null;
  processedAt: string | null;
  status: ContractModificationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TimePunch {
  id: string;
  userId: string;
  type: TimePunchType;
  occurredAt: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface CatalogItem {
  id: string;
  name: string;
  active: boolean;
}

export interface Lead {
  id: string;
  createdAt: string;
  updatedAt: string;
  agentUserId: string;
  fullName: string;
  identificationTypeId: string;
  identification: string;
  phone: string;
  email: string;
  wantsReservation: boolean;
  notes: string;
}

export type CatalogName =
  | "airlines"
  | "lodgingTypes"
  | "accommodations"
  | "insurances"
  | "nationalities"
  | "identificationTypes";

export type CreateTripInput = Omit<Trip, "id">;

export type CreateTripMemberInput = Omit<
  TripMember,
  "id" | "tripId" | "enteredByUserId" | "assignedToUserId" | "createdAt" | "updatedAt"
> & { assignedToUserId?: string };

export type UpdateTripMemberPatch = Partial<
  Omit<TripMember, "id" | "tripId" | "enteredByUserId">
>;

export type CreateContractModificationInput = Omit<
  ContractModificationRequest,
  "id" | "createdAt" | "updatedAt"
>;

export type UpdateContractModificationPatch = Partial<
  Omit<ContractModificationRequest, "id" | "createdAt" | "requestedByUserId">
>;

export type CreateTimePunchInput = Omit<TimePunch, "id" | "createdAt">;

export type UpdatePayrollRoleConfig = Partial<
  Omit<PayrollRoleConfig, "role">
> & { role: Role };

export type UpdatePayrollGlobalConfig = Partial<PayrollGlobalConfig>;

export type CreatePayrollDeductionInput = Omit<
  PayrollDeduction,
  "id" | "createdAt" | "createdByUserId"
>;

export type CreatePayrollPayslipInput = Omit<
  PayrollPayslip,
  "id" | "generatedAt" | "sentAt" | "sentByUserId"
> & {
  sentAt?: string | null;
  sentByUserId?: string | null;
};

export type CreateHolidayDateInput = Omit<HolidayDate, "id">;

export type CreateLeadInput = Omit<
  Lead,
  "id" | "createdAt" | "updatedAt" | "agentUserId"
> & { agentUserId?: string };

export type UpdateLeadPatch = Partial<Omit<Lead, "id" | "createdAt">>;

export type UpdateCatalogItemPatch = Partial<Pick<CatalogItem, "name" | "active">>;
