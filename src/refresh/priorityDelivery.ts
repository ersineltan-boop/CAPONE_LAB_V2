import { buildNewnessFromProductHints } from "../newArrivals/detectNewness";
import { analyzeProducts } from "../analysis/analyzeProduct";
import { buildModelFamilies } from "../modelFamily/buildFamilies";
import type { ModelFamily } from "../modelFamily/types";
import type { PilotProduct } from "../collector/types";
import { applySourceAwareBrandReplacement } from "../brands/automation/delivery";

/** Partial catalog publication updates observed evidence without inventing exits. */
export function mergePriorityBrandDelivery(prior: ModelFamily[], products: PilotProduct[], input: { id: string; brand: string; officialUrl: string; collectedAt: string }): ModelFamily[] {
  const { families } = buildModelFamilies(analyzeProducts(products));
  const refreshedUrls = new Set(products.map((product) => product.productUrl.replace(/\/+$/, "").toLowerCase()));
  const previousById = new Map(prior.map((family) => [family.modelFamilyId, family]));
  const replacement = applySourceAwareBrandReplacement(prior, {
    slug: input.id, brand: input.brand, officialUrl: input.officialUrl, collectedAt: input.collectedAt, families,
    productNewness: new Map(products.map(product => [product.productUrl.replace(/\/+$/, "").toLowerCase(), buildNewnessFromProductHints(product, input.collectedAt)])),
  });
  const delivered = replacement.brandShard.map((family) => {
    const old = previousById.get(family.modelFamilyId);
    return old && !old.variants.some((variant) => refreshedUrls.has(variant.url.replace(/\/+$/, "").toLowerCase())) ? old : family;
  });
  const ids = new Set(delivered.map((family) => family.modelFamilyId));
  // Older shards may predate explicit official source sightings.
  return [...delivered, ...prior.filter((family) => !ids.has(family.modelFamilyId))];
}
