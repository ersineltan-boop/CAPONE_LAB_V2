import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { collectLevelShoes, LEVEL_SHOES_ID } from "../src/collector/levelShoes";
import { globalDedupe } from "../src/collector/dedupe";
import { mergeProductCatalog } from "../src/collector/mergeProducts";
import type { PilotProduct } from "../src/collector/types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTS = join(ROOT, "data", "multibrand", "products.json");
const COVERAGE = join(ROOT, "data", "multibrand", "level-shoes-coverage.json");

async function loadExisting(): Promise<PilotProduct[]> {
  try {
    return JSON.parse(await readFile(PRODUCTS, "utf-8")) as PilotProduct[];
  } catch {
    return [];
  }
}

const enrichDetails = process.argv.includes("--enrich-details");

async function main() {
  console.log("Collecting Level Shoes women's footwear...");
  const collected = await collectLevelShoes({
    maxPagesPerListing: 80,
    enrichDetails,
    maxDetailPages: enrichDetails ? 2500 : 0,
  });
  const existing = await loadExisting();
  const priorLevel = existing.filter((product) => product.source === LEVEL_SHOES_ID);
  const others = existing.filter((product) => product.source !== LEVEL_SHOES_ID);
  const incoming =
    collected.coverageStatus === "FAILED" || collected.products.length === 0
      ? priorLevel
      : collected.products;
  const merged = globalDedupe(mergeProductCatalog(others, incoming));
  await mkdir(dirname(PRODUCTS), { recursive: true });
  await writeFile(PRODUCTS, JSON.stringify(merged, null, 2), "utf-8");
  const { products: _products, ...coverageMeta } = collected;
  await writeFile(
    COVERAGE,
    JSON.stringify({ ...coverageMeta, collectedProductCount: collected.products.length }, null, 2),
    "utf-8",
  );

  console.log("\n=== LEVEL SHOES coverage ===");
  console.log(`Method: ${collected.method}`);
  console.log(`Categories: ${collected.categoriesDiscovered.map((item) => item.name).join(", ")}`);
  console.log(`Pages: ${collected.pagesTraversed}`);
  console.log(`Raw/unique: ${collected.rawProductUrls}/${collected.uniqueSourceProducts}`);
  console.log(`Verified-new: ${collected.verifiedNewProducts}`);
  console.log(`Brands: ${collected.brands.length}`);
  console.log(`Status: ${collected.coverageStatus}`);
  console.log(`Limitation: ${collected.remainingLimitation}`);
  if (collected.errors.length > 0) console.log("Errors:", collected.errors);
  console.log(`Catalog products.json total: ${merged.length}`);
}

main();
