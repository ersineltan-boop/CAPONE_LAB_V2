import type {
  TaxonomyEvidenceSource,
  TaxonomyFeature,
  TaxonomyFieldStatus,
} from "./types";

export function featureKnown<T>(
  value: T,
  source: TaxonomyEvidenceSource = "PRODUCT_TEXT",
  confidence: number | null = 0.75,
): TaxonomyFeature<T> {
  return { value, status: "KNOWN", source, confidence };
}

export function featureUnknown<T>(): TaxonomyFeature<T> {
  return { value: null, status: "UNKNOWN", source: "UNKNOWN", confidence: null };
}

export function featureNotApplicable<T>(): TaxonomyFeature<T> {
  return { value: null, status: "NOT_APPLICABLE", source: "UNKNOWN", confidence: null };
}

export function featureFromDerived<T>(
  value: T,
  confidence: number | null = 0.65,
): TaxonomyFeature<T> {
  return { value, status: "KNOWN", source: "DERIVED", confidence };
}

export function isApplicable<T>(feature: TaxonomyFeature<T>): boolean {
  return feature.status !== "NOT_APPLICABLE";
}

export function isKnown<T>(feature: TaxonomyFeature<T>): boolean {
  return feature.status === "KNOWN" && feature.value !== null;
}

/** KNOWN features must always carry an explicit evidence source. */
export function isValidKnownFeature<T>(feature: TaxonomyFeature<T>): boolean {
  if (!isKnown(feature)) return true;
  return feature.source !== "UNKNOWN";
}

export function parseExplicitHeelHeightMm(text: string): number | null {
  const match = text.match(/\b(\d{1,3})\s*mm\b/i);
  if (!match?.[1]) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeProductText(parts: Array<string | null | undefined>): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function textIncludesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

export function createEmptyGlobalFields(): import("./types").FootwearTaxonomyGlobal {
  const unknown = featureUnknown;
  return {
    toeShape: unknown(),
    toeLength: unknown(),
    toeOpening: unknown(),
    backConstruction: unknown(),
    vampHeight: unknown(),
    heelHeightClass: unknown(),
    heelHeightMm: unknown(),
    heelType: unknown(),
    soleProfile: unknown(),
    platformConstruction: unknown(),
    closureFeatures: unknown(),
    strapFeatures: unknown(),
    sideConstruction: unknown(),
    hardwareType: unknown(),
    hardwareIntensity: unknown(),
    embellishmentFeatures: unknown(),
    materialFamily: unknown(),
    colorFamily: unknown(),
    surfacePattern: unknown(),
  };
}

export function setFieldStatus<T>(
  feature: TaxonomyFeature<T>,
  status: TaxonomyFieldStatus,
): TaxonomyFeature<T> {
  return { ...feature, status, value: status === "KNOWN" ? feature.value : null };
}
