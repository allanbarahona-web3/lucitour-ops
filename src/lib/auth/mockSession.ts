import { Role, type User } from "../types/ops";

export const users: User[] = [
  { id: "ops_user_1", name: "Dennise", email: "dennise@lucitour.com", role: Role.ADMIN },
  { id: "ops_user_0", name: "Sofia", email: "sofia@lucitour.com", role: Role.SUPERVISOR },
  { id: "ops_user_16", name: "Clara", email: "clara@lucitour.com", role: Role.ACCOUNTING },
  { id: "ops_user_10", name: "Joss", email: "joss@lucitour.com", role: Role.AGENT },
  { id: "ops_user_11", name: "Vale", email: "vale@lucitour.com", role: Role.VIEWER },
  { id: "ops_user_13", name: "Samuel", email: "samuel@lucitour.com", role: Role.CONTRACTS },
  { id: "ops_user_14", name: "Paola", email: "paola@lucitour.com", role: Role.QUOTES },
  { id: "ops_user_15", name: "Luis", email: "luis@lucitour.com", role: Role.BILLING },
  { id: "ops_user_17", name: "Irene", email: "irene@lucitour.com", role: Role.PURCHASES },
];

export const currentUser: User = users[0];
