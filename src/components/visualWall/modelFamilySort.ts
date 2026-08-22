import type { AnalyzedProduct } from "../../types/marketAnalysis";
import type { ModelFamily } from "../../modelFamily/types";

export type ModelFamilyDateSource =
  | "publishedAt"
  | "createdAt"
  | "firstSeenAt"
  | "unknown";

export type VisualWallSortMode = "NEWEST" | "BY_BRAND";

export interface ProductSortDate {
  iso: string | null;
  timestamp: number | null;
  source: ModelFamilyDateSource;
}

export interface ModelFamilySortMeta {
  modelFamilyId: string;
  sortTimestamp: number | null;
  source: ModelFamilyDateSource;
  displayDate: string | null;
}

export type ProductWithSortDates = Pick<
  AnalyzedProduct,
  "productUrl" | "discoveredAt" | "publishedAt" | "createdAt"
>;

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatDisplayDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function resolveProductSortDate(
  product: ProductWithSortDates,
  firstSeenByUrl: ReadonlyMap<string, string>,
): ProductSortDate {
  const publishedAt = product.publishedAt ?? null;
  const publishedTs = parseTimestamp(publishedAt);
  if (publishedTs !== null) {
    return {
      iso: publishedAt,
      timestamp: publishedTs,
      source: "publishedAt",
    };
  }

  const createdAt = product.createdAt ?? null;
  const createdTs = parseTimestamp(createdAt);
  if (createdTs !== null) {
    return {
      iso: createdAt,
      timestamp: createdTs,
      source: "createdAt",
    };
  }

  const firstSeenAt =
    firstSeenByUrl.get(product.productUrl) ?? product.discoveredAt ?? null;
  const firstSeenTs = parseTimestamp(firstSeenAt);
  if (firstSeenTs !== null) {
    return {
      iso: firstSeenAt,
      timestamp: firstSeenTs,
      source: "firstSeenAt",
    };
  }

  return {
    iso: null,
    timestamp: null,
    source: "unknown",
  };
}

export function resolveModelFamilySortMeta(
  family: ModelFamily,
  productByUrl: ReadonlyMap<string, AnalyzedProduct>,
  firstSeenByUrl: ReadonlyMap<string, string>,
): ModelFamilySortMeta {
  const variantDates = family.sourceProductIds
    .map((productId) => productByUrl.get(productId))
    .filter((product): product is AnalyzedProduct => Boolean(product))
    .map((product) => resolveProductSortDate(product, firstSeenByUrl));

  if (variantDates.length === 0) {
    return {
      modelFamilyId: family.modelFamilyId,
      sortTimestamp: null,
      source: "unknown",
      displayDate: null,
    };
  }

  let earliest = variantDates[0]!;
  for (const candidate of variantDates.slice(1)) {
    if (candidate.timestamp === null) continue;
    if (earliest.timestamp === null || candidate.timestamp < earliest.timestamp) {
      earliest = candidate;
    }
  }

  return {
    modelFamilyId: family.modelFamilyId,
    sortTimestamp: earliest.timestamp,
    source: earliest.source,
    displayDate: earliest.iso ? formatDisplayDate(earliest.iso) : null,
  };
}

export function buildModelFamilySortIndex(
  families: ModelFamily[],
  productByUrl: ReadonlyMap<string, AnalyzedProduct>,
  firstSeenByUrl: ReadonlyMap<string, string>,
): Map<string, ModelFamilySortMeta> {
  return new Map(
    families.map((family) => [
      family.modelFamilyId,
      resolveModelFamilySortMeta(family, productByUrl, firstSeenByUrl),
    ]),
  );
}

function compareFamiliesNewestFirst(
  a: ModelFamily,
  b: ModelFamily,
  sortIndex: ReadonlyMap<string, ModelFamilySortMeta>,
): number {
  const aMeta = sortIndex.get(a.modelFamilyId);
  const bMeta = sortIndex.get(b.modelFamilyId);
  const aTs = aMeta?.sortTimestamp ?? null;
  const bTs = bMeta?.sortTimestamp ?? null;

  if (aTs === null && bTs === null) {
    return a.canonicalName.localeCompare(b.canonicalName, "tr");
  }
  if (aTs === null) return 1;
  if (bTs === null) return -1;
  if (aTs !== bTs) return bTs - aTs;

  return a.canonicalName.localeCompare(b.canonicalName, "tr");
}

export function sortModelFamilies(
  families: ModelFamily[],
  sortIndex: ReadonlyMap<string, ModelFamilySortMeta>,
  mode: VisualWallSortMode,
): ModelFamily[] {
  const sorted = [...families];

  if (mode === "BY_BRAND") {
    sorted.sort((a, b) => {
      const brandCmp = a.brand.localeCompare(b.brand, "tr");
      if (brandCmp !== 0) return brandCmp;
      return compareFamiliesNewestFirst(a, b, sortIndex);
    });
    return sorted;
  }

  sorted.sort((a, b) => compareFamiliesNewestFirst(a, b, sortIndex));
  return sorted;
}

export interface ModelFamilyDateStats {
  totalFamilies: number;
  withPublishedOrCreatedAt: number;
  withFirstSeenFallback: number;
  unknown: number;
}

export function computeModelFamilyDateStats(
  sortIndex: ReadonlyMap<string, ModelFamilySortMeta>,
): ModelFamilyDateStats {
  let withPublishedOrCreatedAt = 0;
  let withFirstSeenFallback = 0;
  let unknown = 0;

  for (const meta of sortIndex.values()) {
    if (meta.source === "publishedAt" || meta.source === "createdAt") {
      withPublishedOrCreatedAt += 1;
    } else if (meta.source === "firstSeenAt") {
      withFirstSeenFallback += 1;
    } else {
      unknown += 1;
    }
  }

  return {
    totalFamilies: sortIndex.size,
    withPublishedOrCreatedAt,
    withFirstSeenFallback,
    unknown,
  };
}

export const MODEL_FAMILY_DATE_PRIORITY = [
  "publishedAt",
  "createdAt",
  "firstSeenAt",
  "unknown",
] as const;
