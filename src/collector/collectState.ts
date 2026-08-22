import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

import { normalizeProductUrl } from "./mergeProducts";

export interface BrandCollectStateEntry {
  brand: string;
  lastCollectAt: string;
  footwearCollectionPath: string | null;
  footwearCollectionUrl: string | null;
  collectionDiscoveryStatus: string | null;
  knownProductUrls: string[];
  backfillLimit: number;
  hitBackfillLimit: boolean;
}

export interface CollectStateFile {
  version: 1;
  updatedAt: string;
  brands: Record<string, BrandCollectStateEntry>;
}

export function emptyCollectState(): CollectStateFile {
  return { version: 1, updatedAt: new Date().toISOString(), brands: {} };
}

export async function loadCollectState(path: string): Promise<CollectStateFile> {
  try {
    const raw = JSON.parse(await readFile(path, "utf-8")) as CollectStateFile;
    if (raw.version !== 1 || !raw.brands) return emptyCollectState();
    return raw;
  } catch {
    return emptyCollectState();
  }
}

export async function saveCollectState(
  path: string,
  state: CollectStateFile,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2),
    "utf-8",
  );
}

export function brandStateKey(brand: string): string {
  return brand.trim().toUpperCase();
}

export function updateBrandCollectState(input: {
  state: CollectStateFile;
  brand: string;
  productUrls: string[];
  footwearCollectionPath: string | null;
  footwearCollectionUrl: string | null;
  collectionDiscoveryStatus: string | null;
  backfillLimit: number;
  hitBackfillLimit: boolean;
}): CollectStateFile {
  const key = brandStateKey(input.brand);
  const prior = input.state.brands[key];
  const mergedUrls = new Set<string>(prior?.knownProductUrls ?? []);

  for (const url of input.productUrls) {
    mergedUrls.add(normalizeProductUrl(url));
  }

  return {
    ...input.state,
    brands: {
      ...input.state.brands,
      [key]: {
        brand: input.brand,
        lastCollectAt: new Date().toISOString(),
        footwearCollectionPath: input.footwearCollectionPath,
        footwearCollectionUrl: input.footwearCollectionUrl,
        collectionDiscoveryStatus: input.collectionDiscoveryStatus,
        knownProductUrls: [...mergedUrls],
        backfillLimit: input.backfillLimit,
        hitBackfillLimit: input.hitBackfillLimit,
      },
    },
  };
}

export function filterNewProductUrls(
  state: CollectStateFile,
  brand: string,
  productUrls: string[],
): string[] {
  const key = brandStateKey(brand);
  const known = new Set((state.brands[key]?.knownProductUrls ?? []).map(normalizeProductUrl));
  return productUrls.filter((url) => !known.has(normalizeProductUrl(url)));
}
