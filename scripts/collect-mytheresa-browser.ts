import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { collectMytheresaWithBrowser } from "../src/collector/mytheresaBrowser";
import { mergeProductCatalog } from "../src/collector/mergeProducts";
import type { PilotProduct } from "../src/collector/types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = join(ROOT, "data", "multibrand");
const PRODUCTS_FILE = join(OUTPUT_DIR, "products.json");
const REPORT_FILE = join(OUTPUT_DIR, "mytheresa-browser-report.json");
const PILOT_STATE_FILE = join(ROOT, "data", "registry", "marketplace-pilot.json");

async function loadExisting(): Promise<PilotProduct[]> {
  try {
    return JSON.parse(await readFile(PRODUCTS_FILE, "utf-8")) as PilotProduct[];
  } catch {
    return [];
  }
}

async function main() {
  console.log("\n=== CAPONE Mytheresa Browser Collection ===");
  const result = await collectMytheresaWithBrowser({ headless: true, maxPagesPerCategory: 6 });
  const existing = await loadExisting();
  const withoutMytheresa = existing.filter((product) => product.source !== "mytheresa");
  const merged =
    result.products.length > 0
      ? mergeProductCatalog(withoutMytheresa, result.products)
      : existing;

  await mkdir(OUTPUT_DIR, { recursive: true });
  if (result.products.length > 0) {
    await writeFile(PRODUCTS_FILE, JSON.stringify(merged, null, 2), "utf-8");
  }
  await writeFile(
    REPORT_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        status: result.status,
        productsCollected: result.products.length,
        pagesVisited: result.pagesVisited,
        errors: result.errors,
      },
      null,
      2,
    ),
    "utf-8",
  );

  const mytheresaStatus =
    result.status === "COLLECTED" ? "ACTIVE" : "NEEDS_BROWSER_OR_ADAPTER";
  await mkdir(dirname(PILOT_STATE_FILE), { recursive: true });
  await writeFile(
    PILOT_STATE_FILE,
    JSON.stringify(
      {
        activePilotId: result.status === "COLLECTED" ? "mytheresa" : "mytheresa",
        mytheresaStatus,
        notes:
          result.status === "COLLECTED"
            ? "Mytheresa browser collection succeeded"
            : "BLOCKED / NEEDS_BROWSER_OR_ADAPTER",
      },
      null,
      2,
    ),
    "utf-8",
  );

  console.log(`Status: ${result.status}`);
  console.log(`Products: ${result.products.length}`);
  console.log(`Pages visited: ${result.pagesVisited}`);
  console.log(`Errors: ${result.errors.length}`);
  if (result.status !== "COLLECTED") {
    process.exitCode = 2;
  }
}

main();
