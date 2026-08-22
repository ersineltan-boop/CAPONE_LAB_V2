import { isFootwearCollectionPath } from "./footwearGate";

const FULL_CATALOG_ROOT =
  /shop-all|view-all|all-shoes|all-footwear|shoes-view-all|womens-shoes|women-shoes|all-styles|shoes-all/i;

const ROOT_HANDLE = /\/collections\/(all|shoes|footwear|women|womens)\/?$/i;

export function isFullCatalogRootPath(path: string): boolean {
  const normalized = path.trim().toLowerCase();
  if (!normalized) return false;
  return FULL_CATALOG_ROOT.test(normalized) || ROOT_HANDLE.test(normalized);
}

export function normalizeCollectionPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return trimmed;
  try {
    if (trimmed.startsWith("http")) {
      return new URL(trimmed).pathname.replace(/\/$/, "") || "/";
    }
  } catch {
    /* keep raw */
  }
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.replace(/\/$/, "") || "/";
}

export function mergeFullCoverageCollectionPaths(input: {
  persistedPaths?: readonly string[];
  collectionPaths?: readonly string[];
  discoveredPaths?: readonly string[];
  newArrivalPaths?: readonly string[];
}): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  const push = (path: string | null | undefined) => {
    if (!path) return;
    const normalized = normalizeCollectionPath(path);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) return;
    seen.add(key);
    merged.push(normalized);
  };

  for (const path of input.collectionPaths ?? []) {
    if (isFullCatalogRootPath(path) || isFootwearCollectionPath(path)) push(path);
  }
  for (const path of input.persistedPaths ?? []) push(path);
  for (const path of input.discoveredPaths ?? []) push(path);
  for (const path of input.newArrivalPaths ?? []) push(path);
  for (const path of input.collectionPaths ?? []) push(path);

  return merged;
}

export const LEGACY_SAMPLE_PRODUCT_CAP = 100;
export const LEGACY_BACKFILL_CAP = 100;
export const LEGACY_COLLECTION_PAGE_CAP = 5;
export const FULL_COLLECTION_PAGE_CAP = 80;
export const FULL_PRODUCTS_PER_PAGE = 250;
