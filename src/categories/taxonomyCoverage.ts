import type { ModelFamily } from "../modelFamily/types";
import { isApplicable, isKnown } from "../taxonomy/featureHelpers";
import type { PrimaryFootwearCategory } from "../taxonomy/types";
import { getFilterFieldsForCategory } from "./categoryFilterConfig";
import { getTaxonomyFeature } from "./taxonomyFieldAccess";

export interface FieldCoverageStat {
  field: string;
  known: number;
  applicable: number;
  percent: number;
}

export interface FacetCoverage {
  known: number;
  applicable: number;
  percent: number;
}

export function computeFieldCoverage(
  families: ModelFamily[],
  field: string,
): FacetCoverage {
  let known = 0;
  let applicable = 0;

  for (const family of families) {
    const feature = getTaxonomyFeature(family, field);
    if (!feature || !isApplicable(feature)) continue;
    applicable += 1;
    if (isKnown(feature)) known += 1;
  }

  const percent =
    applicable > 0 ? Math.round((known / applicable) * 1000) / 10 : 0;

  return { known, applicable, percent };
}

export function buildCategoryCoverageSummary(
  families: ModelFamily[],
  category: PrimaryFootwearCategory,
): FieldCoverageStat[] {
  const fields = getFilterFieldsForCategory(category);
  return fields
    .map((field) => {
      const coverage = computeFieldCoverage(families, field);
      return {
        field,
        known: coverage.known,
        applicable: coverage.applicable,
        percent: coverage.percent,
      };
    })
    .filter((entry) => entry.applicable > 0)
    .sort((a, b) => a.percent - b.percent || a.field.localeCompare(b.field));
}
