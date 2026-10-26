import { createSourceRefreshPlan, type SourceCatalogItem, type SourceLastGoodState, type SourceRefreshPlan } from "../../../refresh/sourceSnapshot";
import type { RomaniaCollectedProduct, RomaniaSourceStagingResult } from "../collectors/types";

export const PAPUCEI_REFRESH_SOURCE_ID = "papucei";
export const PAPUCEI_VALIDATED_CATALOG_FLOOR = 50;

function key(value: string | null | undefined, fallback: string): string {
  const normalized = value?.trim().toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return normalized || fallback;
}

function previousPayloadByIdentity(previous: SourceLastGoodState<RomaniaCollectedProduct> | null): Map<string, RomaniaCollectedProduct> {
  return new Map((previous?.snapshot.items ?? []).flatMap((item) => item.payload ? [[item.identity, item.payload] as const] : []));
}

function mergeGallery(current: RomaniaCollectedProduct, previous?: RomaniaCollectedProduct): RomaniaCollectedProduct {
  if (!previous) return current;
  return { ...current, images: [...new Set([...current.images, ...previous.images])] };
}

export function toPapuceiCatalogItems(
  staging: RomaniaSourceStagingResult,
  previous: SourceLastGoodState<RomaniaCollectedProduct> | null = null,
): SourceCatalogItem<RomaniaCollectedProduct>[] {
  const prior = previousPayloadByIdentity(previous);
  return staging.products.map((product) => {
    const payload = mergeGallery(product, prior.get(product.source_product_id));
    return {
      identity: product.source_product_id,
      modelIdentity: product.model_key,
      colorIdentity: key(product.color, product.source_product_id),
      inStock: true,
      price: product.current_price,
      currency: product.currency,
      payload,
    };
  });
}

export function createPapuceiRefreshPlan(
  staging: RomaniaSourceStagingResult,
  previous: SourceLastGoodState<RomaniaCollectedProduct> | null = null,
): SourceRefreshPlan<RomaniaCollectedProduct> {
  const reportedTotal = staging.coverage.source_total ?? 0;
  const sourceTotal = Math.max(reportedTotal, PAPUCEI_VALIDATED_CATALOG_FLOOR);
  const sourceMatches = staging.source.id === PAPUCEI_REFRESH_SOURCE_ID && staging.coverage.source_id === PAPUCEI_REFRESH_SOURCE_ID;
  return createSourceRefreshPlan({
    sourceId: PAPUCEI_REFRESH_SOURCE_ID,
    attemptedAt: staging.coverage.last_attempt_at,
    runnerStarted: true,
    sourceAvailable: sourceMatches && !staging.coverage.source_unavailable,
    collectError: staging.coverage.status === "source_unavailable" ? staging.coverage.note : null,
    fullCatalog: sourceMatches && staging.publishable && staging.coverage.pagination_complete && staging.failed_product_urls.length === 0,
    sourceTotal,
    items: toPapuceiCatalogItems(staging, previous),
    minCoveragePercent: 100,
    maxDropPercent: 40,
  }, previous);
}

export function createPapuceiLegacyBaselinePlan(
  legacy: RomaniaSourceStagingResult,
): SourceRefreshPlan<RomaniaCollectedProduct> {
  return createPapuceiRefreshPlan(legacy, null);
}
