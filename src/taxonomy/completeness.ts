import type { ModelFamily } from "../modelFamily/types";
import { isApplicable, isKnown } from "./featureHelpers";
import type { FootwearTaxonomyV1, TaxonomyFeature } from "./types";

export interface TaxonomyCompletenessReport {
  totalFamilies: number;
  categoryKnownCount: number;
  categoryKnownPercent: number;
  unclassifiedCount: number;
  toeShapeKnown: number;
  toeShapeUnknown: number;
  backConstructionKnown: number;
  backConstructionUnknown: number;
  heelTypeKnown: number;
  heelTypeUnknown: number;
  criticalCompletenessPercent: number;
  averageFeatureCompletenessPercent: number;
}

function featureCompleteness(features: TaxonomyFeature<unknown>[]): number {
  const applicable = features.filter(isApplicable);
  if (applicable.length === 0) return 100;
  const known = applicable.filter(isKnown).length;
  return Math.round((known / applicable.length) * 1000) / 10;
}

function collectAllFeatures(taxonomy: FootwearTaxonomyV1): TaxonomyFeature<unknown>[] {
  const globalFeatures = Object.values(taxonomy.global) as TaxonomyFeature<unknown>[];
  const specificFeatures = Object.values(taxonomy.categorySpecific).filter(
    Boolean,
  ) as TaxonomyFeature<unknown>[];
  return [...globalFeatures, ...specificFeatures];
}

export function computeFamilyFeatureCompleteness(family: ModelFamily): number {
  if (!family.taxonomy) return 0;
  return featureCompleteness(collectAllFeatures(family.taxonomy));
}

export function buildTaxonomyCompletenessReport(
  families: ModelFamily[],
): TaxonomyCompletenessReport {
  let categoryKnownCount = 0;
  let unclassifiedCount = 0;
  let toeShapeKnown = 0;
  let toeShapeUnknown = 0;
  let backConstructionKnown = 0;
  let backConstructionUnknown = 0;
  let heelTypeKnown = 0;
  let heelTypeUnknown = 0;
  let completenessSum = 0;

  for (const family of families) {
    const category = family.primaryCategory ?? family.taxonomy?.primaryCategory;
    if (category && category !== "UNCLASSIFIED") categoryKnownCount += 1;
    else unclassifiedCount += 1;

    const taxonomy = family.taxonomy;
    if (!taxonomy) continue;

    if (isKnown(taxonomy.global.toeShape)) toeShapeKnown += 1;
    else if (isApplicable(taxonomy.global.toeShape)) toeShapeUnknown += 1;

    if (isKnown(taxonomy.global.backConstruction)) backConstructionKnown += 1;
    else if (isApplicable(taxonomy.global.backConstruction)) backConstructionUnknown += 1;

    if (isKnown(taxonomy.global.heelType)) heelTypeKnown += 1;
    else if (isApplicable(taxonomy.global.heelType)) heelTypeUnknown += 1;

    completenessSum += featureCompleteness(collectAllFeatures(taxonomy));
  }

  const total = families.length || 1;
  const criticalKnown =
    toeShapeKnown + backConstructionKnown + heelTypeKnown + categoryKnownCount;
  const criticalApplicable = total * 4;

  return {
    totalFamilies: families.length,
    categoryKnownCount,
    categoryKnownPercent: Math.round((categoryKnownCount / total) * 1000) / 10,
    unclassifiedCount,
    toeShapeKnown,
    toeShapeUnknown,
    backConstructionKnown,
    backConstructionUnknown,
    heelTypeKnown,
    heelTypeUnknown,
    criticalCompletenessPercent:
      Math.round((criticalKnown / criticalApplicable) * 1000) / 10,
    averageFeatureCompletenessPercent:
      Math.round((completenessSum / total) * 10) / 10,
  };
}
