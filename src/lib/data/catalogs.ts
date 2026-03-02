import type { CatalogItem } from "../types/ops";

export const airlines: CatalogItem[] = [
  { id: "ops_airline_1", name: "Avianca", active: true },
  { id: "ops_airline_2", name: "Copa Airlines", active: true },
  { id: "ops_airline_3", name: "Aeromexico", active: true },
  { id: "ops_airline_4", name: "Delta", active: true },
];

export const lodgingTypes: CatalogItem[] = [
  { id: "ops_lodging_type_1", name: "Hotel", active: true },
  { id: "ops_lodging_type_2", name: "Apartamento", active: true },
  { id: "ops_lodging_type_3", name: "Hostal", active: true },
  { id: "ops_lodging_type_4", name: "Casa", active: true },
];

export const accommodations: CatalogItem[] = [
  { id: "ops_accommodation_1", name: "Doble", active: true },
  { id: "ops_accommodation_2", name: "Sencilla", active: true },
  { id: "ops_accommodation_3", name: "Triple", active: true },
  { id: "ops_accommodation_4", name: "Cuadruple", active: true },
];

export const insurances: CatalogItem[] = [
  { id: "ops_insurance_1", name: "Basico", active: true },
  { id: "ops_insurance_2", name: "Plus", active: true },
  { id: "ops_insurance_3", name: "Premium", active: true },
];

export const nationalities: CatalogItem[] = [
  { id: "ops_nationality_1", name: "Mexicana", active: true },
  { id: "ops_nationality_2", name: "Guatemalteca", active: true },
  { id: "ops_nationality_3", name: "Costarricense", active: true },
  { id: "ops_nationality_4", name: "Salvadorena", active: true },
  { id: "ops_nationality_5", name: "Hondurena", active: true },
];

export const identificationTypes: CatalogItem[] = [
  { id: "ops_identification_type_1", name: "Pasaporte", active: true },
  { id: "ops_identification_type_2", name: "DPI", active: true },
  { id: "ops_identification_type_3", name: "Licencia", active: true },
];
