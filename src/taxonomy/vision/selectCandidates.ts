import type { ModelFamily } from "../../modelFamily/types";
import { selectAnalysisImages } from "../../modelFamily/familyImages";
import { isApplicable, isKnown } from "../featureHelpers";
import type { FootwearTaxonomyV1 } from "../types";
import { getFilterFieldsForCategory } from "../../categories/categoryFilterConfig";
import { getTaxonomyFeatureFromTaxonomy } from "../../categories/taxonomyFieldAccess";
import { CRITICAL_VISION_FIELDS } from "./constants";

export function countUnknownCriticalFields(taxonomy: FootwearTaxonomyV1 | undefined): number {
  if (!taxonomy) return CRITICAL_VISION_FIELDS.length;
  const category = taxonomy.primaryCategory;
  const fields = getFilterFieldsForCategory(category);
  let unknown = 0;
  for (const field of CRITICAL_VISION_FIELDS) {
    if (!fields.includes(field)) continue;
    const feature = getTaxonomyFeatureFromTaxonomy(taxonomy, field);
    if (!feature) {
      unknown += 1;
      continue;
    }
    if (isApplicable(feature) && !isKnown(feature)) unknown += 1;
  }
  return unknown;
}

export function hasUsableImages(family: ModelFamily): boolean {
  return selectAnalysisImages(family, 1).length > 0;
}

export function selectVisionCandidates(
  families: ModelFamily[],
  limit: number,
): ModelFamily[] {
  return [...families]
    .filter((family) => {
      const category = family.primaryCategory ?? family.taxonomy?.primaryCategory;
      return category && category !== "UNCLASSIFIED" && hasUsableImages(family);
    })
    .filter((family) => countUnknownCriticalFields(family.taxonomy) > 0)
    .sort((a, b) => {
      const unknownDiff =
        countUnknownCriticalFields(b.taxonomy) - countUnknownCriticalFields(a.taxonomy);
      if (unknownDiff !== 0) return unknownDiff;
      const aSeen = Date.parse(a.modelFamilyFirstSeenAt ?? "") || 0;
      const bSeen = Date.parse(b.modelFamilyFirstSeenAt ?? "") || 0;
      return bSeen - aSeen;
    })
    .slice(0, limit);
}
