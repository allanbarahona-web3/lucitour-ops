import { Role, type User } from "../types/ops";

export const users: User[] = [
  { id: "ops_user_1", name: "Dennise", email: "dennise@lucitour.com", role: Role.ADMIN },
  { id: "ops_user_0", name: "Sofia", email: "sofia@lucitour.com", role: Role.SUPERVISOR },
  { id: "ops_user_16", name: "Clara", email: "clara@lucitour.com", role: Role.ACCOUNTING },
  { id: "ops_user_2", name: "Vielka", email: "vielka@lucitour.com", role: Role.AGENT },
  { id: "ops_user_3", name: "Nicole", email: "nicole@lucitour.com", role: Role.AGENT },
  { id: "ops_user_4", name: "Yere", email: "yere@lucitour.com", role: Role.AGENT },
  { id: "ops_user_5", name: "Raquel", email: "raquel@lucitour.com", role: Role.AGENT },
  { id: "ops_user_6", name: "Joha", email: "joha@lucitour.com", role: Role.AGENT },
  { id: "ops_user_7", name: "Byron", email: "byron@lucitour.com", role: Role.AGENT },
  { id: "ops_user_8", name: "Karen", email: "karen@lucitour.com", role: Role.AGENT },
  { id: "ops_user_9", name: "Nallely", email: "nallely@lucitour.com", role: Role.AGENT },
  { id: "ops_user_10", name: "Joss", email: "joss@lucitour.com", role: Role.AGENT },
  { id: "ops_user_11", name: "Vale", email: "vale@lucitour.com", role: Role.VIEWER },
  { id: "ops_user_12", name: "Wanda", email: "wanda@lucitour.com", role: Role.AGENT },
  { id: "ops_user_13", name: "Samuel", email: "samuel@lucitour.com", role: Role.CONTRACTS },
  { id: "ops_user_14", name: "Paola", email: "paola@lucitour.com", role: Role.QUOTES },
  { id: "ops_user_15", name: "Luis", email: "luis@lucitour.com", role: Role.BILLING },
];

export const currentUser: User = users[0];
