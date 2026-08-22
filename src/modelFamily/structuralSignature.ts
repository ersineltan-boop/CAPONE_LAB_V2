import type { RawAnalyzedProduct } from "./types";

const STRUCTURAL_DETAILS = new Set([
  "THONG",
  "BRAIDED",
  "WOVEN",
  "BUCKLE",
  "BOW",
  "RUCHED",
  "LACE_UP",
  "CHAIN",
  "CUT_OUT",
  "ASYMMETRIC",
]);

export function buildStructuralSignature(product: RawAnalyzedProduct): string {
  const normalized = product.normalized;
  const construction = [...normalized.construction]
    .filter((tag) => tag !== "OTHER")
    .sort()
    .join(",");
  const details = [...normalized.details]
    .filter((tag) => STRUCTURAL_DETAILS.has(tag))
    .sort()
    .join(",");

  return [
    normalized.category ?? product.category ?? "UNKNOWN",
    normalized.heelType,
    normalized.heelHeightGroup,
    normalized.toeShape,
    construction || "-",
    details || "-",
  ].join("|");
}

export function structuralSignaturesMatch(a: string, b: string): boolean {
  return a === b;
}
