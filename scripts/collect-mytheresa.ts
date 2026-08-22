import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { collectMytheresaProducts } from "../src/collector/mytheresa";
import { mergeProductCatalog } from "../src/collector/mergeProducts";
import type { PilotProduct } from "../src/collector/types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = join(ROOT, "data", "multibrand");
const PRODUCTS_FILE = join(OUTPUT_DIR, "products.json");
const REPORT_FILE = join(OUTPUT_DIR, "mytheresa-collection-report.json");

async function loadExisting(): Promise<PilotProduct[]> {
  try {
    return JSON.parse(await readFile(PRODUCTS_FILE, "utf-8")) as PilotProduct[];
  } catch {
    return [];
  }
}

async function main() {
  console.log("\n=== CAPONE Mytheresa Collection ===");
  const result = await collectMytheresaProducts({ maxPagesPerCategory: 5 });
  const existing = await loadExisting();
  const withoutMytheresa = existing.filter((product) => product.source !== "mytheresa");
  const merged = mergeProductCatalog(withoutMytheresa, result.products);

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(PRODUCTS_FILE, JSON.stringify(merged, null, 2), "utf-8");
  await writeFile(
    REPORT_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        productsCollected: result.products.length,
        categories: result.categories,
        paginationStatus: result.paginationStatus,
        errors: result.errors,
      },
      null,
      2,
    ),
    "utf-8",
  );

  console.log(`Mytheresa products collected: ${result.products.length}`);
  console.log(`Merged catalog size: ${merged.length}`);
  console.log(`Errors: ${result.errors.length}`);
  console.log(`Report: ${REPORT_FILE}`);
}

main();
