import type { ModelFamily, RawAnalyzedProduct } from "../modelFamily/types";
import { buildTaxonomyFromProduct } from "../taxonomy/buildTaxonomy";
import { mergeVisionEnrichmentIntoTaxonomy } from "../taxonomy/vision/mergeVisionEnrichment";
import type { TaxonomyVisionEnrichmentRecord } from "../taxonomy/vision/types";
import { enrichFamilyWithSightings } from "../newArrivals/sourceSightings";

export interface EnrichTaxonomyOptions {
  visionEnrichments?: Map<string, TaxonomyVisionEnrichmentRecord>;
}

export function enrichModelFamilyWithTaxonomy(
  family: ModelFamily,
  products: RawAnalyzedProduct[],
  priorFamily?: ModelFamily | null,
  options?: EnrichTaxonomyOptions,
): ModelFamily {
  const representative =
    products.find((product) => product.productUrl === family.representativeProductId) ??
    products[0];

  let taxonomy = representative ? buildTaxonomyFromProduct(representative) : undefined;
  const visionRecord = options?.visionEnrichments?.get(family.modelFamilyId);
  if (taxonomy && visionRecord) {
    taxonomy = mergeVisionEnrichmentIntoTaxonomy(taxonomy, visionRecord);
  }

  const sightings = enrichFamilyWithSightings(family, products, priorFamily);

  return {
    ...family,
    primaryCategory: taxonomy?.primaryCategory ?? family.primaryCategory ?? "UNCLASSIFIED",
    hybridInfluences: taxonomy?.hybridInfluences ?? family.hybridInfluences ?? [],
    taxonomy: taxonomy ?? family.taxonomy,
    modelFamilyFirstSeenAt: sightings.modelFamilyFirstSeenAt ?? family.modelFamilyFirstSeenAt,
    sourceSightings: sightings.sourceSightings ?? family.sourceSightings,
    sourceCategoryRefs: sightings.sourceCategoryRefs ?? family.sourceCategoryRefs,
  };
}

export function enrichModelFamiliesWithTaxonomy(
  families: ModelFamily[],
  productLookup: Map<string, RawAnalyzedProduct>,
  priorFamilies?: Map<string, ModelFamily>,
  options?: EnrichTaxonomyOptions,
): ModelFamily[] {
  return families.map((family) => {
    const products = family.sourceProductIds
      .map((id) => productLookup.get(id))
      .filter((product): product is RawAnalyzedProduct => Boolean(product));
    const prior = priorFamilies?.get(family.modelFamilyId);
    return enrichModelFamilyWithTaxonomy(family, products, prior, options);
  });
}
