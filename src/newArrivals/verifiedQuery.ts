import type { ModelFamily } from "../modelFamily/types";
import type { PrimaryFootwearCategory, SourceSighting } from "../taxonomy/types";
import { isVerifiedNew } from "./newness";
import { buildTaxonomyChips } from "./query";
import type { NewArrivalsPeriod } from "./query";
import { isWithinPeriod } from "./query";

export type VerifiedNewArrivalsScope =
  | { type: "ALL" }
  | { type: "BRAND"; brand: string }
  | { type: "SOURCE"; sourceId: string }
  | { type: "CATEGORY"; category: PrimaryFootwearCategory };

export interface VerifiedNewArrivalsQuery {
  scope: VerifiedNewArrivalsScope;
  period: NewArrivalsPeriod;
  referenceDate?: string;
}

export interface VerifiedNewArrivalsItem {
  modelFamilyId: string;
  brand: string;
  canonicalName: string;
  primaryCategory: PrimaryFootwearCategory;
  representativeImage: string | null;
  effectiveNewAt: string;
  sourceLabel: string;
  sourceId: string;
  evidenceType: string | null;
  evidenceText: string | null;
  taxonomyChips: string[];
}

function sightingMatchesScope(
  sighting: SourceSighting,
  scope: VerifiedNewArrivalsScope,
  familyBrand: string,
): boolean {
  switch (scope.type) {
    case "ALL":
      return true;
    case "BRAND":
      return (
        familyBrand.trim().toUpperCase() === scope.brand.trim().toUpperCase() ||
        sighting.sourceLabel.trim().toUpperCase() === scope.brand.trim().toUpperCase()
      );
    case "SOURCE":
      return sighting.sourceId === scope.sourceId;
    case "CATEGORY":
      return true;
    default:
      return false;
  }
}

function resolveVerifiedSighting(
  family: ModelFamily,
  scope: VerifiedNewArrivalsScope,
): SourceSighting | null {
  const sightings = family.sourceSightings ?? [];
  const verified = sightings.filter((s) => isVerifiedNew(s.newness));

  if (scope.type === "SOURCE") {
    return verified.find((s) => s.sourceId === scope.sourceId) ?? null;
  }

  if (scope.type === "BRAND") {
    return (
      verified.find(
        (s) => s.sourceLabel.trim().toUpperCase() === scope.brand.trim().toUpperCase(),
      ) ??
      verified.find((s) => s.sourceId === scope.brand.toLowerCase().replace(/[^a-z0-9]+/g, "-")) ??
      null
    );
  }

  if (verified.length === 0) return null;

  return verified.reduce((best, current) => {
    const bestAt = Date.parse(best.newness?.effectiveNewAt ?? "");
    const currentAt = Date.parse(current.newness?.effectiveNewAt ?? "");
    return currentAt > bestAt ? current : best;
  });
}

export function familyMatchesVerifiedScope(
  family: ModelFamily,
  scope: VerifiedNewArrivalsScope,
): boolean {
  const category =
    family.primaryCategory ?? family.taxonomy?.primaryCategory ?? "UNCLASSIFIED";
  if (scope.type === "CATEGORY" && category !== scope.category) return false;

  const sighting = resolveVerifiedSighting(family, scope);
  if (!sighting || !isVerifiedNew(sighting.newness)) return false;

  return sightingMatchesScope(sighting, scope, family.brand);
}

export function queryVerifiedNewArrivals(
  families: ModelFamily[],
  query: VerifiedNewArrivalsQuery,
): VerifiedNewArrivalsItem[] {
  const referenceDate = query.referenceDate ?? new Date().toISOString();
  const results: VerifiedNewArrivalsItem[] = [];
  const seenFamilyIds = new Set<string>();

  for (const family of families) {
    if (!familyMatchesVerifiedScope(family, query.scope)) continue;

    const sighting = resolveVerifiedSighting(family, query.scope);
    if (!sighting?.newness?.effectiveNewAt) continue;
    if (!isWithinPeriod(sighting.newness.effectiveNewAt, query.period, referenceDate)) {
      continue;
    }

    if (seenFamilyIds.has(family.modelFamilyId)) continue;
    seenFamilyIds.add(family.modelFamilyId);

    results.push({
      modelFamilyId: family.modelFamilyId,
      brand: family.brand,
      canonicalName: family.canonicalName,
      primaryCategory:
        family.primaryCategory ?? family.taxonomy?.primaryCategory ?? "UNCLASSIFIED",
      representativeImage: family.representativeImage,
      effectiveNewAt: sighting.newness.effectiveNewAt,
      sourceLabel: sighting.sourceLabel,
      sourceId: sighting.sourceId,
      evidenceType: sighting.newness.evidenceType,
      evidenceText: sighting.newness.evidenceText ?? null,
      taxonomyChips: buildTaxonomyChips(family),
    });
  }

  return results.sort(
    (a, b) => Date.parse(b.effectiveNewAt) - Date.parse(a.effectiveNewAt),
  );
}

export function countVerifiedNewInCategory(
  families: ModelFamily[],
  category: PrimaryFootwearCategory,
  period: NewArrivalsPeriod = "90D",
  referenceDate?: string,
): number {
  return queryVerifiedNewArrivals(families, {
    scope: { type: "CATEGORY", category },
    period,
    referenceDate,
  }).length;
}
