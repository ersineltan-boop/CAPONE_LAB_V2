import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { globalDedupe } from "./dedupe";
import { mergeProductCatalog } from "./mergeProducts";
import {
  loadCollectState,
  saveCollectState,
  updateBrandCollectState,
  type CollectStateFile,
} from "./collectState";
import { discoverVerifiedFootwearCollections } from "./discoverFootwearCollections";
import { collectBrandByCollectorType } from "../registry/collection/collectByType";
import { resolveBrandBaseUrl } from "../registry/collection/brandToCollector";
import { buildBrandRegistryFromUniverseData } from "../registry/build/buildBrandRegistry";
import { convertUniverseToRegistryEntries } from "../registry/build/convertBrandUniverse";
import type { BrandRegistryEntry } from "../registry/types/brand";
import type { BrandUniverseFile } from "../registry/build/types";
import type { PilotProduct } from "./types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUTPUT_DIR = join(ROOT, "data", "multibrand");
const UNIVERSE_FILE = join(ROOT, "data", "registry", "brand-universe.json");
const BRANDS_TS_FILE = join(ROOT, "src", "registry", "data", "brands.ts");
const COLLECT_STATE_FILE = join(OUTPUT_DIR, "collect-state.json");
const PILOT_PRODUCTS_FILE = join(ROOT, "data", "pilot", "products.json");

export interface BrandDiscoveryReportRow {
  brand: string;
  status: string;
  footwearCollectionPath: string | null;
  footwearCollectionUrl: string | null;
  footwearCollectionHandle: string | null;
  topCandidate?: {
    path: string;
    acceptedCount: number;
    sampleSize: number;
    footwearRatio: number;
    womensScore: number;
    qualityStatus: string;
  };
  candidateCount: number;
}

export interface FootwearBackfillReport {
  generatedAt: string;
  activeBrands: number;
  verifiedOrAutoDiscovered: number;
  notFoundBrands: string[];
  needsManualConfigBrands: string[];
  discovery: BrandDiscoveryReportRow[];
  productsBefore: number;
  productsAfter: number;
  modelFamiliesAfter?: number;
  brandsAtBackfillLimit: string[];
  incrementalTrackingReady: boolean;
  brandStats: Array<{
    brand: string;
    productsBefore: number;
    productsAfter: number;
    modelsAfter?: number;
    collectionPath: string | null;
    collectionUrl: string | null;
    discoveryStatus: string | null;
    collected: number;
    hitBackfillLimit: boolean;
    catalogFootwearCount: number;
  }>;
}

async function loadJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function pilotProductsForBrand(products: PilotProduct[], brand: string): PilotProduct[] {
  return products.filter(
    (product) => product.brand.trim().toUpperCase() === brand.trim().toUpperCase(),
  );
}

async function rebuildRegistryFromUniverse(): Promise<void> {
  const universe = await loadJson<BrandUniverseFile>(UNIVERSE_FILE, {
    version: 1,
    brands: [],
  });
  const result = buildBrandRegistryFromUniverseData({ universeFile: universe });
  if (!result.ok || !result.brandsTsContent) {
    throw new Error(
      `Registry rebuild failed: ${result.report.validationErrors.join("; ")}`,
    );
  }
  await writeFile(BRANDS_TS_FILE, result.brandsTsContent, "utf-8");
}

async function loadActiveRegistryEntries(): Promise<BrandRegistryEntry[]> {
  const universe = await loadJson<BrandUniverseFile>(UNIVERSE_FILE, {
    version: 1,
    brands: [],
  });
  return convertUniverseToRegistryEntries({ universe: universe.brands }).entries;
}

export async function discoverActiveBrandCollections(): Promise<{
  discoveryRows: BrandDiscoveryReportRow[];
}> {
  const universe = await loadJson<BrandUniverseFile>(UNIVERSE_FILE, {
    version: 1,
    brands: [],
  });
  const activeBrands = (await loadActiveRegistryEntries()).filter(
    (entry) => entry.isActive && entry.collectionStatus === "READY_AUTOMATIC",
  );
  const discoveryRows: BrandDiscoveryReportRow[] = [];

  for (const entry of activeBrands) {
    const baseUrl = resolveBrandBaseUrl(entry);
    if (!baseUrl) {
      discoveryRows.push({
        brand: entry.brand,
        status: "NOT_FOUND",
        footwearCollectionPath: null,
        footwearCollectionUrl: null,
        footwearCollectionHandle: null,
        candidateCount: 0,
      });
      continue;
    }

    console.log(`Discovering footwear collection for ${entry.brand}...`);
    const discovered = await discoverVerifiedFootwearCollections({ baseUrl });
    const top = discovered.candidates[0];

    discoveryRows.push({
      brand: entry.brand,
      status: discovered.status,
      footwearCollectionPath: discovered.verifiedPaths[0] ?? null,
      footwearCollectionUrl: discovered.urls[0] ?? null,
      footwearCollectionHandle: discovered.handles[0] ?? null,
      topCandidate: top
        ? {
            path: top.path,
            acceptedCount: top.acceptedCount,
            sampleSize: top.sampleSize,
            footwearRatio: top.footwearRatio,
            womensScore: top.womensScore,
            qualityStatus: top.qualityStatus,
          }
        : undefined,
      candidateCount: discovered.candidates.length,
    });

    const universeEntry = universe.brands.find((row) => row.id === entry.id);
    if (!universeEntry) continue;

    universeEntry.backfillLimit = universeEntry.backfillLimit ?? 100;

    if (discovered.verifiedPaths.length > 0) {
      universeEntry.footwearCollectionUrls = discovered.urls;
      universeEntry.footwearCollectionHandles = discovered.handles;
      universeEntry.collectionDiscoveryStatus = discovered.status;
    } else {
      universeEntry.collectionDiscoveryStatus = discovered.status;
      universeEntry.footwearCollectionUrls = [];
      universeEntry.footwearCollectionHandles = [];
      universeEntry.collectionStatus = "NEEDS_FOOTWEAR_CONFIG";
    }
  }

  universe.generatedAt = new Date().toISOString();
  await writeFile(UNIVERSE_FILE, JSON.stringify(universe, null, 2), "utf-8");
  await rebuildRegistryFromUniverse();

  return { discoveryRows };
}

export async function runFootwearBackfillCollect(input?: {
  skipDiscovery?: boolean;
}): Promise<FootwearBackfillReport> {
  const existingProducts = await loadJson<PilotProduct[]>(
    join(OUTPUT_DIR, "products.json"),
    [],
  );
  const backupPath = join(OUTPUT_DIR, "products.pre-backfill.json");
  try {
    await copyFile(join(OUTPUT_DIR, "products.json"), backupPath);
  } catch {
    await writeFile(backupPath, JSON.stringify(existingProducts, null, 2), "utf-8");
  }

  let discoveryRows: BrandDiscoveryReportRow[] = [];
  if (!input?.skipDiscovery) {
    const discovery = await discoverActiveBrandCollections();
    discoveryRows = discovery.discoveryRows;
  } else {
    for (const entry of await loadActiveRegistryEntries()) {
      if (!entry.isActive) continue;
      discoveryRows.push({
        brand: entry.brand,
        status: entry.collectionDiscoveryStatus ?? "UNKNOWN",
        footwearCollectionPath: entry.footwearCollectionUrls?.[0]
          ? safePathname(entry.footwearCollectionUrls[0])
          : null,
        footwearCollectionUrl: entry.footwearCollectionUrls?.[0] ?? null,
        footwearCollectionHandle: entry.footwearCollectionHandles?.[0] ?? null,
        candidateCount: 0,
      });
    }
  }

  const activeReady = (await loadActiveRegistryEntries()).filter(
    (entry) => entry.isActive && entry.collectionStatus === "READY_AUTOMATIC",
  );
  const pilotProducts = await loadJson<PilotProduct[]>(PILOT_PRODUCTS_FILE, []);
  let collectState = await loadCollectState(COLLECT_STATE_FILE);
  const incomingProducts: PilotProduct[] = [];
  const brandStats: FootwearBackfillReport["brandStats"] = [];
  const brandsAtBackfillLimit: string[] = [];

  for (const entry of activeReady) {
    const beforeCount = pilotProductsForBrand(existingProducts, entry.brand).length;

    if (entry.preferPilotCache) {
      const cached = pilotProductsForBrand(pilotProducts, entry.brand);
      if (cached.length > 0) {
        incomingProducts.push(...cached);
        brandStats.push({
          brand: entry.brand,
          productsBefore: beforeCount,
          productsAfter: beforeCount,
          collectionPath: entry.footwearCollectionUrls?.[0]
            ? safePathname(entry.footwearCollectionUrls[0])
            : null,
          collectionUrl: entry.footwearCollectionUrls?.[0] ?? null,
          discoveryStatus: entry.collectionDiscoveryStatus ?? null,
          collected: cached.length,
          hitBackfillLimit: false,
          catalogFootwearCount: cached.length,
        });
        continue;
      }
    }

    if (
      entry.collectionDiscoveryStatus !== "VERIFIED" &&
      entry.collectionDiscoveryStatus !== "AUTO_DISCOVERED"
    ) {
      brandStats.push({
        brand: entry.brand,
        productsBefore: beforeCount,
        productsAfter: beforeCount,
        collectionPath: null,
        collectionUrl: null,
        discoveryStatus: entry.collectionDiscoveryStatus ?? "NOT_FOUND",
        collected: 0,
        hitBackfillLimit: false,
        catalogFootwearCount: 0,
      });
      continue;
    }

    if (!isCollectableBrandEntry(entry)) continue;

    console.log(`Backfill collect ${entry.brand}...`);
    try {
      const result = await collectBrandByCollectorType(entry, { mode: "backfill" });
      incomingProducts.push(...result.products);

      if (result.hitBackfillLimit) brandsAtBackfillLimit.push(entry.brand);

      collectState = updateBrandCollectState({
        state: collectState,
        brand: entry.brand,
        productUrls: result.products.map((product) => product.productUrl),
        footwearCollectionPath: result.footwearCollectionPath ?? null,
        footwearCollectionUrl: result.footwearCollectionUrl ?? null,
        collectionDiscoveryStatus:
          result.discoveryStatus ?? entry.collectionDiscoveryStatus ?? null,
        backfillLimit: entry.backfillLimit ?? 100,
        hitBackfillLimit: Boolean(result.hitBackfillLimit),
      });

      brandStats.push({
        brand: entry.brand,
        productsBefore: beforeCount,
        productsAfter: beforeCount,
        collectionPath: result.footwearCollectionPath ?? null,
        collectionUrl: result.footwearCollectionUrl ?? null,
        discoveryStatus: result.discoveryStatus ?? entry.collectionDiscoveryStatus ?? null,
        collected: result.products.length,
        hitBackfillLimit: Boolean(result.hitBackfillLimit),
        catalogFootwearCount: result.catalogFootwearCount ?? result.products.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  failed: ${message}`);
      brandStats.push({
        brand: entry.brand,
        productsBefore: beforeCount,
        productsAfter: beforeCount,
        collectionPath: null,
        collectionUrl: null,
        discoveryStatus: entry.collectionDiscoveryStatus ?? null,
        collected: 0,
        hitBackfillLimit: false,
        catalogFootwearCount: 0,
      });
    }
  }

  const merged = globalDedupe(mergeProductCatalog(existingProducts, incomingProducts));
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(join(OUTPUT_DIR, "products.json"), JSON.stringify(merged, null, 2), "utf-8");
  await saveCollectState(COLLECT_STATE_FILE, collectState);

  for (const stat of brandStats) {
    stat.productsAfter = pilotProductsForBrand(merged, stat.brand).length;
  }

  const verifiedOrAutoDiscovered = discoveryRows.filter(
    (row) => row.status === "VERIFIED" || row.status === "AUTO_DISCOVERED",
  ).length;

  return {
    generatedAt: new Date().toISOString(),
    activeBrands: activeReady.length,
    verifiedOrAutoDiscovered,
    notFoundBrands: discoveryRows
      .filter((row) => row.status === "NOT_FOUND")
      .map((row) => row.brand),
    needsManualConfigBrands: discoveryRows
      .filter((row) => row.status === "NEEDS_MANUAL_CONFIG")
      .map((row) => row.brand),
    discovery: discoveryRows,
    productsBefore: existingProducts.length,
    productsAfter: merged.length,
    brandsAtBackfillLimit,
    incrementalTrackingReady: true,
    brandStats,
  };
}

function safePathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function isCollectableBrandEntry(entry: {
  isActive: boolean;
  collectionStatus: string;
  collectorType: string;
  officialUrl: string | null;
  collectionUrl?: string | null;
}): boolean {
  if (!entry.isActive) return false;
  if (entry.collectionStatus !== "READY_AUTOMATIC") return false;
  if (entry.collectorType === "LINK_ONLY") return false;
  if (entry.collectorType === "UNSUPPORTED") return false;
  if (entry.collectorType === "CUSTOM_ADAPTER") return false;
  return resolveBrandBaseUrl(entry as Parameters<typeof resolveBrandBaseUrl>[0]) !== null;
}

export async function loadCollectStateFile(): Promise<CollectStateFile> {
  return loadCollectState(COLLECT_STATE_FILE);
}
