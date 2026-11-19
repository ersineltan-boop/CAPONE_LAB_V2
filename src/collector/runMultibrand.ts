import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildSourceReport, globalDedupe } from "./dedupe";
import { createLegacyProductCatalogStore, type ProductCatalogStore } from "./sourceProductArchive";
import { mergeCatalogPreservingFailedSources } from "./mergeProducts";
import {
  loadCollectState,
  saveCollectState,
  updateBrandCollectState,
} from "./collectState";
import { loadBrandRegistry } from "../registry";
import {
  brandToPilotSourceConfig,
  getCollectableBrands,
} from "../registry/collection/brandToCollector";
import type { BrandRegistryEntry } from "../registry/types/brand";
import { collectBrandByCollectorType } from "../registry/collection/collectByType";
import type { CollectionReport, PilotProduct, SourceCollectionReport } from "./types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUTPUT_DIR = join(ROOT, "data", "multibrand");
const PILOT_PRODUCTS_FILE = join(ROOT, "data", "pilot", "products.json");

async function loadPilotProducts(): Promise<PilotProduct[]> {
  try {
    const raw = await readFile(PILOT_PRODUCTS_FILE, "utf-8");
    return JSON.parse(raw) as PilotProduct[];
  } catch {
    return [];
  }
}

function pilotProductsForBrand(
  products: PilotProduct[],
  brand: string,
): PilotProduct[] {
  return products.filter((product) => product.brand === brand);
}

/** Undefined means the full registry set; an explicit empty list means none. */
export function selectRequestedCollectableBrands(
  entries: readonly BrandRegistryEntry[],
  brandIds?: readonly string[],
): BrandRegistryEntry[] {
  const collectable = getCollectableBrands(entries);
  if (brandIds === undefined) return collectable;
  const wanted = new Set(brandIds.map((id) => id.trim().toLowerCase()).filter(Boolean));
  return collectable.filter(
    (entry) => wanted.has(entry.id.toLowerCase()) || wanted.has(entry.brand.trim().toLowerCase()),
  );
}

export async function runMultibrandCollection(
  options: {
    mode?: "legacy" | "backfill" | "incremental" | "full";
    brandIds?: readonly string[];
    outputDirectory?: string;
    catalog?: ProductCatalogStore;
    acceptSource?: (report: SourceCollectionReport) => boolean;
  } = {},
): Promise<CollectionReport> {
  const runStartedAt = new Date().toISOString();
  const incomingProducts: PilotProduct[] = [];
  const sourceReports: SourceCollectionReport[] = [];
  const pilotProducts = await loadPilotProducts();
  const output = options.outputDirectory ?? OUTPUT_DIR;
  const catalog = options.catalog ?? createLegacyProductCatalogStore(output);
  const existingProducts = await catalog.read<PilotProduct>("products").catch((error) => {
    if (!options.catalog && error.code === "ENOENT") return [];
    throw error;
  });
  const registry = loadBrandRegistry();
  const collectableBrands = selectRequestedCollectableBrands(registry.all(), options.brandIds);
  const seenBrands = new Set<string>();
  const mode = options.mode ?? "full";
  const stateFile = join(output, "collect-state.json");
  let collectState = await loadCollectState(stateFile);
  const acceptedSources = new Set<string>();
  if (options.acceptSource && (mode !== "full" || !options.brandIds?.length)) {
    throw new Error("Scoped catalog refresh requires explicit brands in full mode");
  }

  console.log(
    `Registry-driven collection (${mode}): ${collectableBrands.length} active brand(s)`,
  );

  for (const entry of collectableBrands) {
    const brandKey = entry.brand.trim().toUpperCase();
    if (seenBrands.has(brandKey)) {
      sourceReports.push({
        source: entry.brand,
        status: "failed",
        discoveredProductLinks: 0,
        parsedProducts: 0,
        productsWithImages: 0,
        productsWithMaterial: 0,
        errors: ["Duplicate brand skipped"],
      });
      continue;
    }
    seenBrands.add(brandKey);

    if (entry.preferPilotCache && mode !== "full") {
      const cached = pilotProductsForBrand(pilotProducts, entry.brand);
      if (cached.length > 0) {
        incomingProducts.push(...cached);
        sourceReports.push(
          buildSourceReport(entry.brand, cached.length, cached, [], "pilot-cache"),
        );
        console.log(`Using cached pilot data for ${entry.brand}: ${cached.length} products`);
        continue;
      }
    }

    const config = brandToPilotSourceConfig(entry);
    if (!config) {
      sourceReports.push({
        source: entry.brand,
        status: "failed",
        discoveredProductLinks: 0,
        parsedProducts: 0,
        productsWithImages: 0,
        productsWithMaterial: 0,
        errors: ["Registry entry missing base URL"],
      });
      continue;
    }

    console.log(
      `Collecting ${entry.brand} via ${entry.collectorType} (${entry.collectionStatus})...`,
    );

    try {
      const collected = await collectBrandByCollectorType(entry, { mode });
      const {
        products,
        discoveredLinks,
        errors,
        method,
        hitBackfillLimit,
        catalogFootwearCount,
      } = collected;

      const report = buildSourceReport(
        entry.brand,
        discoveredLinks.size,
        products,
        errors,
        method,
      );
      report.hitLegacyCap = Boolean(hitBackfillLimit);
      report.footwearRoots = config.collectionPaths;
      if (typeof catalogFootwearCount === "number") {
        report.rawProductUrlsDiscovered = discoveredLinks.size;
        report.duplicateCount = Math.max(0, discoveredLinks.size - products.length);
      }
      if ("pagesTraversed" in collected && typeof collected.pagesTraversed === "number") {
        report.pagesTraversed = collected.pagesTraversed;
      }
      if (
        "paginationExhausted" in collected &&
        typeof collected.paginationExhausted === "boolean"
      ) {
        report.paginationExhausted = collected.paginationExhausted;
      }
      if ("hitCollectionCrawlCap" in collected && collected.hitCollectionCrawlCap === true) {
        report.hitCollectionCrawlCap = true;
        report.hitLegacyCap = true;
      }
      if (
        "collectionsCrawled" in collected &&
        Array.isArray(collected.collectionsCrawled)
      ) {
        report.collectionsCrawled = collected.collectionsCrawled as string[];
        report.footwearRoots = collected.collectionsCrawled as string[];
      }
      if (
        "sourceReportedProductCount" in collected &&
        (typeof collected.sourceReportedProductCount === "number" ||
          collected.sourceReportedProductCount === null)
      ) {
        report.sourceReportedProductCount = collected.sourceReportedProductCount as
          | number
          | null;
      }
      if (options.acceptSource) {
        if (!options.acceptSource(report)) {
          sourceReports.push(report);
          continue;
        }
        if (products.some(row => row.source !== entry.id)) throw new Error(`Unexpected source in ${entry.id} refresh`);
        acceptedSources.add(entry.id);
      }
      sourceReports.push(report);
      incomingProducts.push(...products);

      collectState = updateBrandCollectState({
        state: collectState,
        brand: entry.brand,
        productUrls: products.map((product) => product.productUrl),
        footwearCollectionPath: entry.footwearCollectionUrls?.[0]
          ? entry.footwearCollectionUrls[0]
          : null,
        footwearCollectionUrl: entry.footwearCollectionUrls?.[0] ?? null,
        collectionDiscoveryStatus: entry.collectionDiscoveryStatus ?? null,
        backfillLimit: entry.backfillLimit ?? 100,
        hitBackfillLimit: false,
      });

      console.log(
        `  → ${products.length} products via ${method} (${discoveredLinks.size} links discovered)`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sourceReports.push({
        source: entry.brand,
        status: "failed",
        discoveredProductLinks: 0,
        parsedProducts: 0,
        productsWithImages: 0,
        productsWithMaterial: 0,
        errors: [message],
      });
      console.error(`  → failed: ${message}`);
    }
  }

  const failedBrandKeys = new Set(
    sourceReports
      .filter((report) => report.status === "failed")
      .map((report) => report.source.trim().toUpperCase()),
  );

  const deduped = options.acceptSource
    ? [...existingProducts.filter(product => !acceptedSources.has(product.source)),
      ...globalDedupe(mergeCatalogPreservingFailedSources(
        existingProducts.filter(product => acceptedSources.has(product.source)), incomingProducts, failedBrandKeys))]
    : globalDedupe(mergeCatalogPreservingFailedSources(existingProducts, incomingProducts, failedBrandKeys));
  const runFinishedAt = new Date().toISOString();
  const failedBrands = sourceReports
    .filter((report) => report.status === "failed")
    .map((report) => report.source);

  const report: CollectionReport = {
    runStartedAt,
    runFinishedAt,
    totalProducts: deduped.length,
    sources: sourceReports,
    failedBrands,
    successfulBrands: sourceReports
      .filter((report) => report.status !== "failed")
      .map((report) => report.source),
  };

  await mkdir(output, { recursive: true });
  if (!options.acceptSource || acceptedSources.size) await catalog.write("products", deduped);
  await writeFile(
    join(output, "collection-report.json"),
    JSON.stringify(report, null, 2),
    "utf-8",
  );
  await saveCollectState(stateFile, collectState);

  return report;
}
