import type {
  FootwearTaxonomyCategoryFields,
  FootwearTaxonomyGlobal,
  FootwearTaxonomyV1,
  TaxonomyFeature,
} from "../taxonomy/types";

export function getTaxonomyFeatureFromTaxonomy(
  taxonomy: FootwearTaxonomyV1,
  field: string,
): TaxonomyFeature<unknown> | null {
  const globalFeature = taxonomy.global[field as keyof FootwearTaxonomyGlobal];
  if (globalFeature) return globalFeature as TaxonomyFeature<unknown>;
  const specificFeature =
    taxonomy.categorySpecific[field as keyof FootwearTaxonomyCategoryFields];
  return specificFeature ?? null;
}

export function getTaxonomyFeature(
  family: import("../modelFamily/types").ModelFamily,
  field: string,
): TaxonomyFeature<unknown> | null {
  const taxonomy = family.taxonomy;
  if (!taxonomy) return null;
  return getTaxonomyFeatureFromTaxonomy(taxonomy, field);
}
