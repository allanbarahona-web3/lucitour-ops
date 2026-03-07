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
  PURCHASES = "PURCHASES",
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

export interface QuoteMarginRates {
  flightsInternational: number;
  flightsDomestic: number;
  tours: number;
  lodging: number;
  transfers: number;
  extras: number;
}

export interface QuoteFeeTier {
  id: string;
  minPax: number;
  maxPax: number | null;
  feePerPax: number;
}

export interface BillingConfig {
  exchangeRate: number;
  cardFeeRate: number;
  vendorCommissionRate: number;
  taxRate: number;
  quoteMarginRates: QuoteMarginRates;
  perPaxFeeTiers: QuoteFeeTier[];
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

export enum BillingStatus {
  NOT_SENT = "NOT_SENT",
  SENT = "SENT",
}

export enum ContractsWorkflowStatus {
  IN_PROGRESS = "IN_PROGRESS",
  INFO_PENDING = "INFO_PENDING",
  SENT_TO_SIGN = "SENT_TO_SIGN",
  APPROVED = "APPROVED",
}

export enum QuoteStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  IN_PROGRESS = "IN_PROGRESS",
  OFFER_SENT = "OFFER_SENT",
  WON = "WON",
  PAUSED = "PAUSED",
  LOST = "LOST",
}

export type ContractModificationStep = "STEP1" | "STEP2" | "STEP3" | "STEP4";

export enum ContractModificationStatus {
  PENDING = "PENDING",
  DONE = "DONE",
}

export type DocumentType =
  | "ID_CARD"
  | "PASSPORT"
  | "MINOR_PERMIT"
  | "INSURANCE"
  | "PAYMENT_PROOF";

export interface DocumentUpload {
  id: string;
  type: DocumentType;
  fileName: string;
  ownerName: string;
  concept?: string;
  conceptOther?: string;
}

export interface Companion {
  id: string;
  fullName: string;
  identification: string;
  email: string;
  phone: string;
  address: string;
  maritalStatus: MaritalStatus | "";
  nationalityId: string;
  profession: string;
  isMinor: boolean;
  wantsInsurance: boolean | null;
  insuranceId: string;
  hasOwnInsurance: boolean | null;
  emergencyContactName: string;
  emergencyContactPhone: string;
  specialSituations: string;
}

export type TripStatus = "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export type TripLodgingType = "HOTEL" | "HOSTEL" | "AIRBNB";

export type TripAccommodationType =
  | "TWIN"
  | "INDIVIDUAL"
  | "MATRIMONIAL"
  | "TRIPLE"
  | "CUADRUPLE";

export type TripLuggageType = "CARRY_ON" | "CHECKED";

export interface TripExtraItem {
  id: string;
  label: string;
  quantity: number | null;
  unitPrice: number | null;
}

export type UpsellType =
  | "SEAT"
  | "LUGGAGE"
  | "TOUR"
  | "INSURANCE"
  | "FLIGHT"
  | "OTHER";

export enum UpsellOrderStatus {
  DRAFT = "DRAFT",
  SENT_TO_PURCHASES = "SENT_TO_PURCHASES",
  IN_PROGRESS = "IN_PROGRESS",
  PURCHASED = "PURCHASED",
  BILLED = "BILLED",
  CANCELLED = "CANCELLED",
}

export interface UpsellOrderLine {
  id: string;
  type: UpsellType;
  label: string;
  ownerName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface UpsellOrder {
  id: string;
  tripId: string;
  tripMemberId: string;
  leadId: string | null;
  clientId: string | null;
  quoteCode: string | null;
  status: UpsellOrderStatus;
  currency: "USD";
  totalAmount: number;
  notes: string;
  lines: UpsellOrderLine[];
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Trip {
  id: string;
  name: string;
  dateFrom: string;
  dateTo: string;
  status: TripStatus;
  maxSeats: number;
  lodgingType: TripLodgingType;
  packageBasePrice: number;
  reservationMinPerPerson: number;
}

export interface TripMember {
  id: string;
  tripId: string;
  clientId: string | null;
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
  packageLodgingType: TripLodgingType | "";
  packageBasePrice: number | null;
  packageFinalPrice: number | null;
  reservationMinPerPerson: number | null;
  reservationFinalPerPerson: number | null;
  paymentPlanMonths: number | null;
  paymentBalanceTotal: number | null;
  paymentInstallmentAmount: number | null;
  accommodationType: TripAccommodationType | "";
  seatUnitPrice: number | null;
  luggageType: TripLuggageType | "";
  luggageQuantity: number | null;
  luggageUnitPrice: number | null;
  extraTours: TripExtraItem[];
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
    paymentProof: boolean;
  };
  isDraft: boolean;
  contractsStatus: ContractsStatus;
  contractsSentByUserId: string | null;
  contractsSentAt: string | null;
  contractsWorkflowStatus: ContractsWorkflowStatus | null;
  contractsTakenByUserId: string | null;
  contractsTakenAt: string | null;
  contractsStatusUpdatedAt: string | null;
  billingStatus: BillingStatus;
  billingSentByUserId: string | null;
  billingSentAt: string | null;
  billingStatusUpdatedAt: string | null;
  billingTotalAmount: number | null;
  quoteCode?: string | null;
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
  quoteDestination: string;
  quoteTravelMonth: string;
  quoteTravelDateFrom: string;
  quoteTravelDateTo: string;
  quotePartySize: number | null;
  quoteDraft: QuoteDraft | null;
  quoteDraftUpdatedAt: string | null;
  quoteStatus: QuoteStatus;
  quoteCode: string;
  quoteTakenByUserId: string | null;
  quoteTakenAt: string | null;
  quoteStatusUpdatedAt: string | null;
  quoteOfferSentAt: string | null;
  quoteWonAt: string | null;
  quotePausedAt: string | null;
  quoteLostAt: string | null;
  quoteTripId: string | null;
  quoteTripMemberId: string | null;
}

export type QuoteDraftSectionId = "lodging" | "flights" | "tours" | "transfers" | "extras";

export type QuotePriceType = "PER_PERSON" | "PER_GROUP";

export type QuoteFlightType = "INTERNATIONAL" | "DOMESTIC";

export interface QuoteDraftItem {
  id: string;
  label: string;
  quantity: number | null;
  unitPrice: number | null;
  selected: boolean;
  priceType: QuotePriceType;
  customPax: number | null;
  marginRate: number | null;
  flightType?: QuoteFlightType;
}

export interface QuoteDraftSection {
  id: QuoteDraftSectionId;
  title: string;
  items: QuoteDraftItem[];
}

export interface QuoteLodgingStay {
  id: string;
  city: string;
  nights: number | null;
  lodgingType: string;
  accommodation: string;
  mealPlan: string;
  detail: string;
  pricePerNight: number | null;
  priceType: QuotePriceType;
  customPax: number | null;
  marginRate: number | null;
}

export interface QuoteDraft {
  sections: QuoteDraftSection[];
  lodgingStays: QuoteLodgingStay[];
  notes: string;
  validUntil: string;
}

export interface Client {
  id: string;
  createdAt: string;
  updatedAt: string;
  firstName: string;
  lastName: string;
  fullName: string;
  identificationTypeId: string;
  identification: string;
  phone: string;
  email: string;
  nationalityId: string;
  medicalNotes: string;
}

export interface ClientPurchase {
  tripId: string;
  tripName: string;
  tripDateFrom: string;
  tripDateTo: string;
  memberId: string;
  reservationCode: string;
  contractsStatus: ContractsStatus;
  contractsSentAt: string | null;
  billingStatus: BillingStatus;
  totalAmount: number | null;
  createdAt: string;
}

export interface CreateUpsellOrderInput {
  tripId: string;
  tripMemberId: string;
  leadId?: string | null;
  clientId?: string | null;
  quoteCode?: string | null;
  status?: UpsellOrderStatus;
  currency?: "USD";
  totalAmount: number;
  notes?: string;
  lines: UpsellOrderLine[];
  createdByUserId: string;
}

export type UpdateUpsellOrderPatch = Partial<
  Omit<UpsellOrder, "id" | "tripId" | "tripMemberId" | "createdAt" | "createdByUserId">
>;

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
  | "id"
  | "tripId"
  | "clientId"
  | "paymentBalanceTotal"
  | "paymentInstallmentAmount"
  | "enteredByUserId"
  | "assignedToUserId"
  | "createdAt"
  | "updatedAt"
> & {
  assignedToUserId?: string;
  clientId?: string | null;
  paymentBalanceTotal?: number | null;
  paymentInstallmentAmount?: number | null;
};

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

export type UpdateBillingConfig = Partial<BillingConfig>;

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
  | "id"
  | "createdAt"
  | "updatedAt"
  | "agentUserId"
  | "quoteCode"
  | "quoteDraft"
  | "quoteDraftUpdatedAt"
  | "quoteTravelDateFrom"
  | "quoteTravelDateTo"
  | "quotePartySize"
  | "quoteTakenByUserId"
  | "quoteTakenAt"
  | "quoteStatusUpdatedAt"
  | "quoteOfferSentAt"
  | "quoteWonAt"
  | "quotePausedAt"
  | "quoteLostAt"
  | "quoteTripId"
  | "quoteTripMemberId"
> & {
  agentUserId?: string;
  quoteCode?: string;
  quoteDraft?: QuoteDraft | null;
  quoteDraftUpdatedAt?: string | null;
  quoteTravelDateFrom?: string;
  quoteTravelDateTo?: string;
  quotePartySize?: number | null;
  quoteTakenByUserId?: string | null;
  quoteTakenAt?: string | null;
  quoteStatusUpdatedAt?: string | null;
  quoteOfferSentAt?: string | null;
  quoteWonAt?: string | null;
  quotePausedAt?: string | null;
  quoteLostAt?: string | null;
  quoteTripId?: string | null;
  quoteTripMemberId?: string | null;
};

export type CreateClientInput = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  medicalNotes?: string;
  identificationTypeId?: string;
  identification?: string;
  nationalityId?: string;
  fullName?: string;
};

export type UpdateClientPatch = Partial<Omit<Client, "id" | "createdAt">>;

export type UpdateLeadPatch = Partial<Omit<Lead, "id" | "createdAt">>;

export type UpdateCatalogItemPatch = Partial<Pick<CatalogItem, "name" | "active">>;
