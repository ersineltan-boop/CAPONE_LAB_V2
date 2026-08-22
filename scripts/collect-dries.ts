import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { collectDriesVanNoten, DRIES_BRAND_NAME } from "../src/collector/driesVanNoten";
import { globalDedupe } from "../src/collector/dedupe";
import { mergeProductCatalog } from "../src/collector/mergeProducts";
import type { PilotProduct } from "../src/collector/types";
import { loadBrandRegistry } from "../src/registry/data/index";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = join(ROOT, "data", "multibrand");

async function loadExisting(): Promise<PilotProduct[]> {
  try {
    return JSON.parse(await readFile(join(OUTPUT_DIR, "products.json"), "utf-8")) as PilotProduct[];
  } catch {
    return [];
  }
}

const registry = loadBrandRegistry();
const entry = registry.get("dries-van-noten");
if (!entry) {
  throw new Error("DRIES VAN NOTEN registry entry missing");
}

console.log("Collecting DRIES VAN NOTEN women's footwear (dedicated adapter)...");
const collected = await collectDriesVanNoten(entry);
const existing = await loadExisting();
const kept = existing.filter((product) => product.brand.trim().toUpperCase() !== DRIES_BRAND_NAME);
const merged = globalDedupe(mergeProductCatalog(kept, collected.products));

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(join(OUTPUT_DIR, "products.json"), JSON.stringify(merged, null, 2), "utf-8");

const uniqueUrls = new Set(collected.products.map((product) => product.productUrl));
const categories = new Map<string, number>();
for (const product of collected.products) {
  for (const category of product.sourceCategories ?? []) {
    categories.set(category.categoryName, (categories.get(category.categoryName) ?? 0) + 1);
  }
}
const verifiedNew = collected.products.filter((product) => product.isNewArrivalsCollection).length;

const coverage = {
  brand: DRIES_BRAND_NAME,
  collectedAt: new Date().toISOString(),
  footwearRoot: collected.footwearCollectionPath,
  footwearRootUrl: collected.footwearCollectionUrl,
  categoriesDiscovered: collected.sourceCategoriesCollected,
  categoryProductCounts: Object.fromEntries(categories),
  pagesTraversed: collected.pagesTraversed,
  rawProductUrls: collected.rawProductUrlsDiscovered,
  uniqueSourceProducts: uniqueUrls.size,
  verifiedNewProducts: verifiedNew,
  imagesRetained: collected.products.filter((product) => (product.images?.length ?? 0) > 0).length,
  paginationExhausted: collected.paginationExhausted,
  sourceReportedProductCount: collected.sourceReportedProductCount,
  errors: collected.errors,
  method: collected.method,
  coverageStatus:
    collected.products.length === 0
      ? "FAILED"
      : collected.errors.length > 0 ||
          (collected.sourceReportedProductCount != null &&
            uniqueUrls.size < collected.sourceReportedProductCount)
        ? "PARTIAL"
        : "FULL",
  remainingLimitation:
    collected.products.length === 0
      ? "No accessible women's footwear products were returned."
      : collected.sourceReportedProductCount != null &&
          uniqueUrls.size < collected.sourceReportedProductCount
        ? "Unique collected products are below the source-reported Women's Shoes count."
        : "Source has no public footwear sub-collections beyond Women's Shoes / Sneakers; type tags remain source-native.",
};

await writeFile(join(OUTPUT_DIR, "dries-coverage.json"), JSON.stringify(coverage, null, 2), "utf-8");

console.log("\n=== DRIES VAN NOTEN coverage ===");
console.log(`Root: ${coverage.footwearRoot}`);
console.log(`Categories: ${coverage.categoriesDiscovered.join(", ")}`);
console.log(`Pages: ${coverage.pagesTraversed}`);
console.log(`Raw URLs: ${coverage.rawProductUrls}`);
console.log(`Unique products: ${coverage.uniqueSourceProducts}`);
console.log(`Verified-new: ${coverage.verifiedNewProducts}`);
console.log(`Status: ${coverage.coverageStatus}`);
console.log(`Catalog products.json total: ${merged.length}`);
if (collected.errors.length > 0) {
  console.log("Errors:", collected.errors);
}
