import type {
  CatalogIdIndex,
  CatalogShard,
  CatalogSummary,
} from "./types";
import { CATALOG_PUBLIC_BASE } from "./types";
import type { VisualBasicCategoryId } from "../visual/basicCategories";
import type { VisualShard, VisualSummary } from "../visual/types";
import type { ModelFamily } from "../modelFamily/types";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const cache = new Map<string, Promise<unknown>>();
let catalogFetch: FetchLike = (input, init) => fetch(input, init);

export function setCatalogFetch(next: FetchLike): void {
  catalogFetch = next;
}

export function resetCatalogCache(): void {
  cache.clear();
}

export function catalogUrl(path: string): string {
  const base = CATALOG_PUBLIC_BASE.replace(/\/$/, "");
  return `${base}/${path.replace(/^\//, "")}`;
}

async function loadJson<T>(path: string): Promise<T> {
  const url = catalogUrl(path);
  const cached = cache.get(url);
  if (cached) return cached as Promise<T>;

  const pending = catalogFetch(url).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Catalog request failed: ${response.status} ${url}`);
    }
    return (await response.json()) as T;
  });
  cache.set(url, pending);
  pending.catch(() => {
    cache.delete(url);
  });
  return pending;
}

export function loadCatalogSummary(): Promise<CatalogSummary> {
  return loadJson<CatalogSummary>("summary.json");
}

export function loadBrandShard(brandId: string): Promise<CatalogShard> {
  return loadJson<CatalogShard>(`brands/${brandId}.json`);
}

export function loadMarketplaceShard(sourceId: string): Promise<CatalogShard> {
  return loadJson<CatalogShard>(`marketplaces/${sourceId}.json`);
}

export function loadCatalogIdIndex(): Promise<CatalogIdIndex> {
  return loadJson<CatalogIdIndex>("id-index.json");
}

export function loadVisualSummary(): Promise<VisualSummary> {
  return loadJson<VisualSummary>("visual-summary.json");
}

export function loadVisualShard(categoryId: VisualBasicCategoryId): Promise<VisualShard> {
  return loadJson<VisualShard>(`visual/${categoryId}.json`);
}

export async function loadFamilyById(modelFamilyId: string): Promise<ModelFamily | null> {
  const index = await loadCatalogIdIndex();
  const locator = index.families[modelFamilyId];
  if (!locator) return null;
  if (locator.brandId) {
    const shard = await loadBrandShard(locator.brandId);
    return shard.families.find((family) => family.modelFamilyId === modelFamilyId) ?? null;
  }
  if (locator.marketplaceId) {
    const shard = await loadMarketplaceShard(locator.marketplaceId);
    return shard.families.find((family) => family.modelFamilyId === modelFamilyId) ?? null;
  }
  return null;
}

export async function loadShardsForSavedIds(
  savedIds: string[],
): Promise<CatalogShard[]> {
  if (savedIds.length === 0) return [];
  const index = await loadCatalogIdIndex();
  const brandIds = new Set<string>();
  const marketplaceIds = new Set<string>();
  for (const id of savedIds) {
    const locator = index.families[id];
    if (!locator) continue;
    if (locator.brandId) brandIds.add(locator.brandId);
    else if (locator.marketplaceId) marketplaceIds.add(locator.marketplaceId);
  }
  const shards = await Promise.all([
    ...[...brandIds].map((id) => loadBrandShard(id)),
    ...[...marketplaceIds].map((id) => loadMarketplaceShard(id)),
  ]);
  return shards;
}
