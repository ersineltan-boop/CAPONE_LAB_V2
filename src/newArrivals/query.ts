import type { ModelFamily } from "../modelFamily/types";
import type { PrimaryFootwearCategory } from "../taxonomy/types";

export type NewArrivalsPeriod = "24H" | "7D" | "30D" | "90D";

export type NewArrivalsScope =
  | { type: "ALL" }
  | { type: "BRAND"; brand: string }
  | { type: "SOURCE"; sourceId: string }
  | { type: "CATEGORY"; category: PrimaryFootwearCategory }
  | {
      type: "FILTER";
      category?: PrimaryFootwearCategory;
      filters: NewArrivalsTaxonomyFilter[];
    };

export interface NewArrivalsTaxonomyFilter {
  field: "backConstruction" | "toeShape" | "heelType" | "heelHeightClass";
  value: string;
}

export interface NewArrivalsQuery {
  scope: NewArrivalsScope;
  period: NewArrivalsPeriod;
  referenceDate?: string;
}

export interface NewArrivalsItem {
  modelFamilyId: string;
  brand: string;
  canonicalName: string;
  primaryCategory: PrimaryFootwearCategory;
  representativeImage: string | null;
  firstSeenAt: string;
  sourceLabel: string;
  sourceId: string;
  taxonomyChips: string[];
}

const PERIOD_MS: Record<NewArrivalsPeriod, number> = {
  "24H": 24 * 60 * 60 * 1000,
  "7D": 7 * 24 * 60 * 60 * 1000,
  "30D": 30 * 24 * 60 * 60 * 1000,
  "90D": 90 * 24 * 60 * 60 * 1000,
};

export function resolveFirstSeenForScope(
  family: ModelFamily,
  scope: NewArrivalsScope,
): string | null {
  if (scope.type === "SOURCE") {
    const sighting = family.sourceSightings?.find(
      (item) => item.sourceId === scope.sourceId,
    );
    return sighting?.firstSeenAt ?? null;
  }

  if (scope.type === "BRAND") {
    if (family.brand.trim().toUpperCase() !== scope.brand.trim().toUpperCase()) {
      return null;
    }
    const brandSighting = family.sourceSightings?.find(
      (item) => item.sourceLabel.trim().toUpperCase() === scope.brand.trim().toUpperCase(),
    );
    return brandSighting?.firstSeenAt ?? family.modelFamilyFirstSeenAt ?? null;
  }

  return family.modelFamilyFirstSeenAt ?? null;
}

function matchesTaxonomyFilter(
  family: ModelFamily,
  filter: NewArrivalsTaxonomyFilter,
): boolean {
  const taxonomy = family.taxonomy;
  if (!taxonomy) return false;

  switch (filter.field) {
    case "backConstruction":
      return taxonomy.global.backConstruction.value === filter.value;
    case "toeShape":
      return taxonomy.global.toeShape.value === filter.value;
    case "heelType":
      return taxonomy.global.heelType.value === filter.value;
    case "heelHeightClass":
      return taxonomy.global.heelHeightClass.value === filter.value;
    default:
      return false;
  }
}

export function familyMatchesScope(
  family: ModelFamily,
  scope: NewArrivalsScope,
): boolean {
  const category = family.primaryCategory ?? family.taxonomy?.primaryCategory ?? "UNCLASSIFIED";

  switch (scope.type) {
    case "ALL":
      return true;
    case "BRAND":
      return family.brand.trim().toUpperCase() === scope.brand.trim().toUpperCase();
    case "SOURCE":
      return Boolean(
        family.sourceSightings?.some((item) => item.sourceId === scope.sourceId),
      );
    case "CATEGORY":
      return category === scope.category;
    case "FILTER":
      if (scope.category && category !== scope.category) return false;
      return scope.filters.every((filter) => matchesTaxonomyFilter(family, filter));
    default:
      return false;
  }
}

export function isWithinPeriod(
  firstSeenAt: string,
  period: NewArrivalsPeriod,
  referenceDate: string = new Date().toISOString(),
): boolean {
  const ref = Date.parse(referenceDate);
  const seen = Date.parse(firstSeenAt);
  if (Number.isNaN(ref) || Number.isNaN(seen)) return false;
  return ref - seen <= PERIOD_MS[period];
}

export function buildTaxonomyChips(family: ModelFamily): string[] {
  const chips: string[] = [];
  const category = family.primaryCategory ?? family.taxonomy?.primaryCategory;
  if (category) chips.push(category);

  const taxonomy = family.taxonomy;
  if (!taxonomy) return chips;

  if (taxonomy.global.backConstruction.value) {
    chips.push(taxonomy.global.backConstruction.value);
  }
  if (taxonomy.global.toeShape.value) {
    chips.push(taxonomy.global.toeShape.value);
  }
  for (const tag of taxonomy.derivedStyleTags) {
    chips.push(tag);
  }
  return chips;
}

export function queryNewArrivals(
  families: ModelFamily[],
  query: NewArrivalsQuery,
): NewArrivalsItem[] {
  const referenceDate = query.referenceDate ?? new Date().toISOString();
  const results: NewArrivalsItem[] = [];

  for (const family of families) {
    if (!familyMatchesScope(family, query.scope)) continue;

    const firstSeenAt = resolveFirstSeenForScope(family, query.scope);
    if (!firstSeenAt) continue;
    if (!isWithinPeriod(firstSeenAt, query.period, referenceDate)) continue;

    const sourceId =
      query.scope.type === "SOURCE" ? query.scope.sourceId : null;
    const source = sourceId
      ? family.sourceSightings?.find((item) => item.sourceId === sourceId)
      : family.sourceSightings?.[0];

    results.push({
      modelFamilyId: family.modelFamilyId,
      brand: family.brand,
      canonicalName: family.canonicalName,
      primaryCategory:
        family.primaryCategory ?? family.taxonomy?.primaryCategory ?? "UNCLASSIFIED",
      representativeImage: family.representativeImage,
      firstSeenAt,
      sourceLabel: source?.sourceLabel ?? family.brand,
      sourceId: source?.sourceId ?? family.brand.toLowerCase(),
      taxonomyChips: buildTaxonomyChips(family),
    });
  }

  return results.sort(
    (a, b) => Date.parse(b.firstSeenAt) - Date.parse(a.firstSeenAt),
  );
}
