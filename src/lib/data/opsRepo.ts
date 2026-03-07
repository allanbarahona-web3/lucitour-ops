import type {
  CatalogItem,
  CatalogName,
  Client,
  ClientPurchase,
  ContractModificationRequest,
  CreateContractModificationInput,
  CreateClientInput,
  CreateTripInput,
  CreateLeadInput,
  CreateTripMemberInput,
  CreateHolidayDateInput,
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
  TimePunch,
  UpdatePayrollGlobalConfig,
  UpdatePayrollRoleConfig,
  UpdateContractModificationPatch,
  UpdateCatalogItemPatch,
  UpdateClientPatch,
  UpdateBillingConfig,
  UpdateLeadPatch,
  CreateUpsellOrderInput,
  UpdateUpsellOrderPatch,
  UpdateTripMemberPatch,
} from "../types/ops";
import type { BillingConfig } from "../types/ops";
import { MockOpsRepo } from "./mockOpsRepo";

export interface IOpsRepo {
  listTrips(): Promise<Trip[]>;
  getTrip(id: string): Promise<Trip | null>;
  listTripMembers(tripId: string): Promise<TripMember[]>;
  listClients(): Promise<Client[]>;
  listClientPurchases(clientId: string): Promise<ClientPurchase[]>;
  createClient(input: CreateClientInput): Promise<Client>;
  updateClient(clientId: string, patch: UpdateClientPatch): Promise<Client | null>;
  deleteClient(clientId: string): Promise<boolean>;
  listContractsQueue(): Promise<TripMember[]>;
  listContractModifications(): Promise<ContractModificationRequest[]>;
  listTimePunches(): Promise<TimePunch[]>;
  listPayrollRoleConfigs(): Promise<PayrollRoleConfig[]>;
  updatePayrollRoleConfig(config: UpdatePayrollRoleConfig): Promise<PayrollRoleConfig>;
  getPayrollGlobalConfig(): Promise<PayrollGlobalConfig>;
  updatePayrollGlobalConfig(config: UpdatePayrollGlobalConfig): Promise<PayrollGlobalConfig>;
  getBillingConfig(): Promise<BillingConfig>;
  updateBillingConfig(config: UpdateBillingConfig): Promise<BillingConfig>;
  listHolidayDates(): Promise<HolidayDate[]>;
  addHolidayDate(input: CreateHolidayDateInput): Promise<HolidayDate>;
  deleteHolidayDate(id: string): Promise<boolean>;
  listPayrollDeductions(): Promise<PayrollDeduction[]>;
  addPayrollDeduction(input: CreatePayrollDeductionInput): Promise<PayrollDeduction>;
  deletePayrollDeduction(id: string): Promise<boolean>;
  listPayrollPayslips(): Promise<PayrollPayslip[]>;
  createPayrollPayslip(input: CreatePayrollPayslipInput): Promise<PayrollPayslip>;
  updateTripMember(
    tripId: string,
    memberId: string,
    patch: UpdateTripMemberPatch,
  ): Promise<TripMember | null>;
  createTrip(input: CreateTripInput): Promise<Trip>;
  createTripMember(tripId: string, input: CreateTripMemberInput): Promise<TripMember>;
  createContractModification(
    input: CreateContractModificationInput,
  ): Promise<ContractModificationRequest>;
  createTimePunch(input: CreateTimePunchInput, options?: { override?: boolean }): Promise<TimePunch>;
  updateContractModification(
    requestId: string,
    patch: UpdateContractModificationPatch,
  ): Promise<ContractModificationRequest | null>;
  listLeads(): Promise<Lead[]>;
  createLead(input: CreateLeadInput): Promise<Lead>;
  updateLead(leadId: string, patch: UpdateLeadPatch): Promise<Lead | null>;
  listUpsellOrders(): Promise<UpsellOrder[]>;
  createUpsellOrder(input: CreateUpsellOrderInput): Promise<UpsellOrder>;
  updateUpsellOrder(orderId: string, patch: UpdateUpsellOrderPatch): Promise<UpsellOrder | null>;
  listCatalog(catalogName: CatalogName): Promise<CatalogItem[]>;
  addCatalogItem(catalogName: CatalogName, name: string): Promise<CatalogItem>;
  updateCatalogItem(
    catalogName: CatalogName,
    id: string,
    patch: UpdateCatalogItemPatch,
  ): Promise<CatalogItem | null>;
  deleteCatalogItem(catalogName: CatalogName, id: string): Promise<boolean>;
  deriveQueue(currentUserId: string): Promise<TripMember[]>;
}

let cachedRepo: IOpsRepo | null = null;

export const getOpsRepo = (): IOpsRepo => {
  if (!cachedRepo) {
    cachedRepo = new MockOpsRepo();
  }
  return cachedRepo;
};
