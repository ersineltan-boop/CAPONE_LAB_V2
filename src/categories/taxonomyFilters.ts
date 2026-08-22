import type { ModelFamily } from "../modelFamily/types";
import { isKnown } from "../taxonomy/featureHelpers";
import type { PrimaryFootwearCategory, TaxonomyFeature } from "../taxonomy/types";
import type { TaxonomyFilterFieldId } from "./categoryFilterConfig";
import { getFilterFieldsForCategory } from "./categoryFilterConfig";
import { computeFieldCoverage } from "./taxonomyCoverage";
import { getTaxonomyFeature } from "./taxonomyFieldAccess";

export interface TaxonomyActiveFilter {
  field: TaxonomyFilterFieldId;
  value: string;
}

export interface FacetValueCount {
  value: string;
  count: number;
}

export interface FacetGroup {
  field: TaxonomyFilterFieldId;
  values: FacetValueCount[];
  coverage: FacetCoverage;
  tier: "primary" | "limited";
}

export const FILTER_COVERAGE_PRIMARY_THRESHOLD = 50;

export interface FacetCoverage {
  known: number;
  applicable: number;
  percent: number;
}

export function getFamilyPrimaryCategory(
  family: ModelFamily,
): PrimaryFootwearCategory {
  return (
    family.primaryCategory ??
    family.taxonomy?.primaryCategory ??
    "UNCLASSIFIED"
  );
}

export function filterFamiliesByCategory(
  families: ModelFamily[],
  category: PrimaryFootwearCategory,
): ModelFamily[] {
  return families.filter((family) => getFamilyPrimaryCategory(family) === category);
}

function normalizeFeatureValues(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.includes("+")) {
    return value.split("+").filter(Boolean);
  }
  return [String(value)];
}

export function featureValueMatchesFilter(
  feature: TaxonomyFeature<unknown> | null,
  filterValue: string,
): boolean {
  if (!feature || !isKnown(feature)) return false;
  const values = normalizeFeatureValues(feature.value);
  return values.includes(filterValue);
}

export function familyMatchesFilters(
  family: ModelFamily,
  filters: TaxonomyActiveFilter[],
): boolean {
  if (filters.length === 0) return true;
  return filters.every((filter) =>
    featureValueMatchesFilter(getTaxonomyFeature(family, filter.field), filter.value),
  );
}

export function applyTaxonomyFilters(
  families: ModelFamily[],
  filters: TaxonomyActiveFilter[],
): ModelFamily[] {
  if (filters.length === 0) return families;
  return families.filter((family) => familyMatchesFilters(family, filters));
}

function collectKnownValues(
  families: ModelFamily[],
  field: TaxonomyFilterFieldId,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const family of families) {
    const feature = getTaxonomyFeature(family, field);
    if (!feature || !isKnown(feature)) continue;
    for (const value of normalizeFeatureValues(feature.value)) {
      if (value === "UNKNOWN" || value === "NOT_APPLICABLE") continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return counts;
}

/** Faceted counts: for each field, apply all active filters except that field. */
export function buildFacetGroups(
  families: ModelFamily[],
  category: PrimaryFootwearCategory,
  activeFilters: TaxonomyActiveFilter[],
): FacetGroup[] {
  const fields = getFilterFieldsForCategory(category);
  const groups: FacetGroup[] = [];

  for (const field of fields) {
    const filtersExceptField = activeFilters.filter((filter) => filter.field !== field);
    const scopedFamilies = applyTaxonomyFilters(families, filtersExceptField);
    const valueCounts = collectKnownValues(scopedFamilies, field);
    const values = [...valueCounts.entries()]
      .filter(([, count]) => count > 0)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

    if (values.length > 0) {
      const coverage = computeFieldCoverage(scopedFamilies, field);
      groups.push({
        field,
        values,
        coverage,
        tier:
          coverage.percent >= FILTER_COVERAGE_PRIMARY_THRESHOLD
            ? "primary"
            : "limited",
      });
    }
  }

  return groups;
}

export function isStandardFilterValue(value: string): boolean {
  return value !== "UNKNOWN" && value !== "NOT_APPLICABLE";
}
