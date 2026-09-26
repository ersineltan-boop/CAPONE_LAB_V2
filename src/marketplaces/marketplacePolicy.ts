import type { ModelFamily } from "../modelFamily/types";
import type { SourceSighting } from "../taxonomy/types";

const CANONICAL_SOURCE_IDS = [
  "mytheresa", "ssense", "24s", "luisaviaroma", "farfetch",
  "net-a-porter", "moda-operandi", "browns", "level-shoes", "free-people",
  "amazon", "emag", "trendyol", "otto",
] as const;

const SOURCE_ID_ALIASES = new Map(
  CANONICAL_SOURCE_IDS.map((sourceId) => [sourceId.replace(/-/g, ""), sourceId]),
);

export function normalizeMarketplaceSourceId(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return SOURCE_ID_ALIASES.get(normalized.replace(/-/g, "")) ?? normalized;
}

class CanonicalSourceIdSet extends Set<string> {
  override has(value: string): boolean {
    return super.has(normalizeMarketplaceSourceId(value));
  }
}

export const MARKETPLACE_SOURCE_IDS = new CanonicalSourceIdSet([
  "mytheresa", "ssense", "24s", "luisaviaroma", "farfetch",
  "net-a-porter", "moda-operandi", "browns", "level-shoes", "free-people",
]);

export const EXCLUDED_MARKETPLACE_SOURCE_IDS = new CanonicalSourceIdSet([
  "amazon", "emag", "trendyol", "otto",
]);

export const EXCLUDED_MARKETPLACE_BRANDS = new Set([
  "ADIDAS", "NIKE", "CONVERSE", "HOKA", "HOKA ONE ONE", "ON", "ON RUNNING",
]);

const TECHNICAL_SNEAKER_TERMS = [
  "RUNNING", "RUNNER", "TRAIL", "RACE", "RACING", "WALKING", "HIKING",
  "TREKKING", "PERFORMANCE", "GORE TEX", "GORETEX", "KOSU", "YURUYUS",
] as const;

export const MARKETPLACE_PRESENTATION_POLICY = Object.freeze({
  showPrice: false as const,
  preserveSourceSightings: true as const,
  mergeAcrossMarketplaces: false as const,
});

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLocaleUpperCase("en-US")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

export function isMarketplaceSource(sourceId: string): boolean {
  return MARKETPLACE_SOURCE_IDS.has(sourceId) || isExcludedMarketplaceSource(sourceId);
}

export function isExcludedMarketplaceSource(sourceId: string): boolean {
  return EXCLUDED_MARKETPLACE_SOURCE_IDS.has(sourceId);
}

export function isExcludedMarketplaceBrand(brand: string): boolean {
  const normalized = normalizeToken(brand);
  if (EXCLUDED_MARKETPLACE_BRANDS.has(normalized)) return true;
  return ["ADIDAS ", "NIKE ", "CONVERSE ", "HOKA ", "ON RUNNING "].some(
    (prefix) => normalized.startsWith(prefix),
  );
}

export function isExplicitTechnicalSneaker(family: ModelFamily): boolean {
  const category = family.primaryCategory ?? family.taxonomy?.primaryCategory ?? family.category;
  if (category !== "SNEAKER") return false;
  const text = normalizeToken(
    [family.canonicalName, ...family.variants.map((variant) => variant.title)].join(" "),
  );
  return TECHNICAL_SNEAKER_TERMS.some((term) => text.includes(term));
}

export function isFashionMarketplaceFamily(family: ModelFamily): boolean {
  return !isExcludedMarketplaceBrand(family.brand) && !isExplicitTechnicalSneaker(family);
}

export function marketplaceSourceSightings(
  family: ModelFamily,
  marketplaceId: string,
): SourceSighting[] {
  const sourceId = normalizeMarketplaceSourceId(marketplaceId);
  return (family.sourceSightings ?? []).filter(
    (sighting) => normalizeMarketplaceSourceId(sighting.sourceId) === sourceId,
  );
}
