import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildSourceReport, globalDedupe } from "./dedupe";
import { mergeProductCatalog } from "./mergeProducts";
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
import { collectBrandByCollectorType } from "../registry/collection/collectByType";
import type { CollectionReport, PilotProduct, SourceCollectionReport } from "./types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUTPUT_DIR = join(ROOT, "data", "multibrand");
const PILOT_PRODUCTS_FILE = join(ROOT, "data", "pilot", "products.json");
const COLLECT_STATE_FILE = join(OUTPUT_DIR, "collect-state.json");

async function loadExistingMultibrandProducts(): Promise<PilotProduct[]> {
  try {
    const raw = await readFile(join(OUTPUT_DIR, "products.json"), "utf-8");
    return JSON.parse(raw) as PilotProduct[];
  } catch {
    return [];
  }
}

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

export async function runMultibrandCollection(
  options: { mode?: "legacy" | "backfill" | "incremental" | "full" } = {},
): Promise<CollectionReport> {
  const runStartedAt = new Date().toISOString();
  const incomingProducts: PilotProduct[] = [];
  const sourceReports: SourceCollectionReport[] = [];
  const pilotProducts = await loadPilotProducts();
  const existingProducts = await loadExistingMultibrandProducts();
  const registry = loadBrandRegistry();
  const collectableBrands = getCollectableBrands(registry.all());
  const seenBrands = new Set<string>();
  const mode = options.mode ?? "full";
  let collectState = await loadCollectState(COLLECT_STATE_FILE);

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

      incomingProducts.push(...products);
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
      if (
        "sourceReportedProductCount" in collected &&
        (typeof collected.sourceReportedProductCount === "number" ||
          collected.sourceReportedProductCount === null)
      ) {
        report.sourceReportedProductCount = collected.sourceReportedProductCount as
          | number
          | null;
      }
      sourceReports.push(report);

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

  const preservedFromFailed =
    failedBrandKeys.size > 0
      ? existingProducts.filter((product) =>
          failedBrandKeys.has(product.brand.trim().toUpperCase()),
        )
      : [];

  const mergedExisting = existingProducts.filter(
    (product) => !failedBrandKeys.has(product.brand.trim().toUpperCase()),
  );

  const deduped = globalDedupe(
    mergeProductCatalog(mergedExisting, [...incomingProducts, ...preservedFromFailed]),
  );
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

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    join(OUTPUT_DIR, "products.json"),
    JSON.stringify(deduped, null, 2),
    "utf-8",
  );
  await writeFile(
    join(OUTPUT_DIR, "collection-report.json"),
    JSON.stringify(report, null, 2),
    "utf-8",
  );
  await saveCollectState(COLLECT_STATE_FILE, collectState);

  return report;
}
