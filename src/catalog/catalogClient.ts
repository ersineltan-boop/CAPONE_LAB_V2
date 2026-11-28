import type {
  CatalogIdIndex,
  CatalogShard,
  CatalogSummary,
} from "./types";
import { CATALOG_PUBLIC_BASE } from "./types";
import type { VisualBasicCategoryId } from "../visual/basicCategories";
import type { VisualCard, VisualSearchIndex, VisualShard, VisualSummary } from "../visual/types";
import { filterVisualCards } from "../visual/buildVisualDelivery";
import type { BrandPriceSegmentFilter } from "../brands/brandPriceSegments";
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

export async function loadVisualResults(categoryId: VisualBasicCategoryId, filters: {
  query: string; onlyNew: boolean; segment: BrandPriceSegmentFilter;
}, limit: number): Promise<{ cards: VisualCard[]; total: number }> {
  const summary = await loadVisualSummary();
  const size = summary.pageSize;
  if (!size) {
    const cards = filterVisualCards((await loadVisualShard(categoryId)).cards, filters.query, filters);
    return { cards: cards.slice(0, limit), total: cards.length };
  }
  if (!Number.isSafeInteger(size) || size < 1) throw new Error("Invalid Visual page size");
  const category = summary.categories.find(item => item.id === categoryId);
  if (!category) throw new Error(`Missing Visual category: ${categoryId}`);
  const query = filters.query.trim().toLowerCase();
  const filtered = Boolean(query || filters.onlyNew || filters.segment !== "all");
  const matches: number[] = [];
  let total = category.count;
  if (filtered) {
    const index = await loadJson<VisualSearchIndex>(`visual/${categoryId}-index.json`);
    if (index.id !== categoryId || index.rows.length !== category.count) throw new Error("Invalid Visual search index");
    total = 0;
    index.rows.forEach(([brand, name, segment, isNew], position) => {
      if ((filters.onlyNew && !isNew) || (filters.segment !== "all" && filters.segment !== segment) ||
          (query && !brand.includes(query) && !name.includes(query))) return;
      if (matches.length < limit) matches.push(position);
      total++;
    });
  } else {
    for (let position = 0; position < Math.min(limit, total); position++) matches.push(position);
  }
  const pages = [...new Set(matches.map(position => Math.floor(position / size)))];
  const entries = await Promise.all(pages.map(async number => {
    const page = await loadJson<VisualShard>(`visual/${categoryId}-${number}.json`);
    if (page.id !== categoryId || page.cards.length !== Math.min(size, category.count - number * size)) {
      throw new Error(`Invalid Visual page: ${categoryId}-${number}`);
    }
    return [number, page.cards] as const;
  }));
  const byPage = new Map(entries);
  return { cards: matches.map(position => byPage.get(Math.floor(position / size))![position % size]!), total };
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
