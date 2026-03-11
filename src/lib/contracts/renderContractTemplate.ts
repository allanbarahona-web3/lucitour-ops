import type { ContractPayload } from "@/lib/contracts/contractMapper";
import { CONTRACT_GENERAL_TEMPLATE } from "@/lib/contracts/contractGeneralTemplate";

type Dict = Record<string, unknown>;

const getPath = (obj: Dict, path: string): unknown =>
  path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Dict)) {
      return (acc as Dict)[key];
    }
    return "";
  }, obj);

const replaceTokens = (text: string, data: Dict): string =>
  text.replace(/{{\s*([a-zA-Z0-9_.]+)\s*}}/g, (_m, token: string) => {
    const value = getPath(data, token);
    if (value === null || value === undefined) {
      return "";
    }
    return String(value);
  });

const renderEqIf = (
  text: string,
  path: string,
  expected: string,
  data: Dict,
): string => {
  const pattern = new RegExp(
    `{{#if \\(eq ${path.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")} \\\"${expected}\\\"\\)}}([\\s\\S]*?){{\\/if}}`,
    "g",
  );
  const current = String(getPath(data, path) ?? "");
  return text.replace(pattern, (_m, inner) => (current === expected ? inner : ""));
};

const renderBoolIf = (text: string, path: string, data: Dict): string => {
  const pattern = new RegExp(
    `{{#if ${path.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}}}([\\s\\S]*?){{\\/if}}`,
    "g",
  );
  return text.replace(pattern, (_m, inner) => (Boolean(getPath(data, path)) ? inner : ""));
};

const renderEach = (text: string, path: string, data: Dict): string => {
  const pattern = new RegExp(
    `{{#each ${path.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}}}([\\s\\S]*?){{\\/each}}`,
    "g",
  );

  return text.replace(pattern, (_m, block) => {
    const items = getPath(data, path);
    if (!Array.isArray(items) || items.length === 0) {
      return "";
    }

    return items
      .map((item) => {
        const withParentRefs = String(block).replace(
          /{{\s*\.\.\/signatures\.clientDate\s*}}/g,
          String(getPath(data, "signatures.clientDate") ?? ""),
        );
        return replaceTokens(withParentRefs, item as Dict);
      })
      .join("");
  });
};

export const renderContractGeneralPreview = (payload: ContractPayload): string => {
  const data = payload as unknown as Dict;

  let out = CONTRACT_GENERAL_TEMPLATE;

  out = renderEqIf(out, "client.idType", "cedula", data);
  out = renderEqIf(out, "client.idType", "passport", data);
  out = renderEqIf(out, "client.idType", "dimex", data);
  out = renderEqIf(out, "payment.plan", "installments", data);
  out = renderEqIf(out, "payment.plan", "cash", data);

  out = renderBoolIf(out, "travelers.hasCompanions", data);
  out = renderBoolIf(out, "travelers.hasMinors", data);
  out = renderBoolIf(out, "sale.isResale", data);
  out = renderBoolIf(out, "legal.applyExonerationAnnex", data);
  out = renderBoolIf(out, "lucitours.signatories.includeEdwin", data);
  out = renderBoolIf(out, "lucitours.signatories.includeErick", data);

  out = renderEach(out, "travelers.companions", data);
  out = renderEach(out, "travelers.minors", data);
  out = renderEach(out, "trip.itineraryItems", data);

  out = replaceTokens(out, data);

  return out
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};
