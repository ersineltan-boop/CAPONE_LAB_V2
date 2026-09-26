import { normalizeBrandId, normalizeBrandName } from "../registry/build/normalize";
import type { BrandUniverseEntry } from "../registry/build/types";

export const APPROVED_DISCOVERY_SOURCES = new Set([
  "farfetch",
  "level-shoes",
  "free-people",
  "the-webster",
]);

export const EXCLUDED_DISCOVERY_BRAND_IDS = new Set([
  "adidas",
  "nike",
  "converse",
  "hoka",
  "hoka-one-one",
  "on",
  "on-running",
]);

const EXCLUDED_DISCOVERY_BRAND_PREFIXES = [
  "adidas-",
  "nike-",
  "converse-",
  "hoka-",
  "on-running-",
];

function isExcludedDiscoveryBrand(id: string): boolean {
  return (
    EXCLUDED_DISCOVERY_BRAND_IDS.has(id) ||
    EXCLUDED_DISCOVERY_BRAND_PREFIXES.some((prefix) => id.startsWith(prefix))
  );
}

export interface MarketplaceBrandEvidence {
  source?: string | null;
  brand?: string | null;
  productUrl?: string | null;
}

export interface DiscoveredBrandCandidate {
  id: string;
  brand: string;
  status: "DISCOVERED_NEEDS_OFFICIAL_SOURCE";
  marketplaceSources: string[];
  productCount: number;
  sampleProductUrl: string | null;
}

export interface BrandDiscoveryReport {
  version: 1;
  generatedAt: string;
  sourcePolicy: "APPROVED_MARKETPLACES_ONLY";
  candidates: DiscoveredBrandCandidate[];
}

export function discoverMarketplaceBrandCandidates(
  products: readonly MarketplaceBrandEvidence[],
  universe: readonly BrandUniverseEntry[],
  generatedAt = new Date().toISOString(),
): BrandDiscoveryReport {
  const existingIds = new Set(universe.map((entry) => entry.id));
  const existingNames = new Set(universe.map((entry) => normalizeBrandName(entry.brand)));
  const evidence = new Map<
    string,
    { brand: string; sources: Set<string>; productUrls: Set<string>; sampleProductUrl: string | null }
  >();

  for (const product of products) {
    const source = product.source?.trim().toLowerCase() ?? "";
    const brand = normalizeBrandName(product.brand ?? "");
    const id = normalizeBrandId(brand);
    if (!APPROVED_DISCOVERY_SOURCES.has(source) || !id) continue;
    if (isExcludedDiscoveryBrand(id)) continue;
    if (existingIds.has(id) || existingNames.has(brand)) continue;

    const current = evidence.get(id) ?? {
      brand,
      sources: new Set<string>(),
      productUrls: new Set<string>(),
      sampleProductUrl: null,
    };
    current.sources.add(source);
    if (product.productUrl) {
      current.productUrls.add(product.productUrl);
      current.sampleProductUrl ??= product.productUrl;
    }
    evidence.set(id, current);
  }

  const candidates = [...evidence.entries()]
    .map(([id, item]): DiscoveredBrandCandidate => ({
      id,
      brand: item.brand,
      status: "DISCOVERED_NEEDS_OFFICIAL_SOURCE",
      marketplaceSources: [...item.sources].sort(),
      productCount: item.productUrls.size,
      sampleProductUrl: item.sampleProductUrl,
    }))
    .filter((candidate) => candidate.productCount >= 2)
    .sort(
      (a, b) =>
        b.marketplaceSources.length - a.marketplaceSources.length ||
        b.productCount - a.productCount ||
        a.brand.localeCompare(b.brand, "tr"),
    );

  return {
    version: 1,
    generatedAt,
    sourcePolicy: "APPROVED_MARKETPLACES_ONLY",
    candidates,
  };
}
