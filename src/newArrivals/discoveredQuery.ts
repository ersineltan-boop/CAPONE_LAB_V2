import type { ModelFamily } from "../modelFamily/types";
import type { PrimaryFootwearCategory } from "../taxonomy/types";
import {
  buildTaxonomyChips,
  familyMatchesScope,
  isWithinPeriod,
  resolveFirstSeenForScope,
  type NewArrivalsPeriod,
  type NewArrivalsScope,
} from "./query";

export interface DiscoveredNewArrivalsQuery {
  scope: NewArrivalsScope;
  period: NewArrivalsPeriod;
  referenceDate?: string;
}

export interface DiscoveredNewArrivalsItem {
  modelFamilyId: string;
  brand: string;
  canonicalName: string;
  primaryCategory: PrimaryFootwearCategory;
  representativeImage: string | null;
  discoveredAt: string;
  sourceLabel: string;
  sourceId: string;
  taxonomyChips: string[];
}

/** CAPONE first catalog discovery — NOT source-verified newness. */
export function queryDiscoveredNewArrivals(
  families: ModelFamily[],
  query: DiscoveredNewArrivalsQuery,
): DiscoveredNewArrivalsItem[] {
  const referenceDate = query.referenceDate ?? new Date().toISOString();
  const results: DiscoveredNewArrivalsItem[] = [];

  for (const family of families) {
    if (!familyMatchesScope(family, query.scope)) continue;

    const discoveredAt = resolveFirstSeenForScope(family, query.scope);
    if (!discoveredAt) continue;
    if (!isWithinPeriod(discoveredAt, query.period, referenceDate)) continue;

    const sourceId = query.scope.type === "SOURCE" ? query.scope.sourceId : null;
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
      discoveredAt,
      sourceLabel: source?.sourceLabel ?? family.brand,
      sourceId: source?.sourceId ?? family.brand.toLowerCase(),
      taxonomyChips: buildTaxonomyChips(family),
    });
  }

  return results.sort(
    (a, b) => Date.parse(b.discoveredAt) - Date.parse(a.discoveredAt),
  );
}
