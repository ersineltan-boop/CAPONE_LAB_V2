import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { collectFarfetch, FARFETCH_ID } from "../src/collector/farfetch";
import { FREE_PEOPLE_ID } from "../src/collector/freePeople";
import { collectLevelShoes, LEVEL_SHOES_ID } from "../src/collector/levelShoes";
import { globalDedupe } from "../src/collector/dedupe";
import { mergeCatalogPreservingFailedSources } from "../src/collector/mergeProducts";
import type { PilotProduct } from "../src/collector/types";
import type { MarketplacePilotState } from "../src/registry/data/marketplaces";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTS = join(ROOT, "data", "multibrand", "products.json");
const PILOT = join(ROOT, "data", "registry", "marketplace-pilot.json");
const REPORT = join(ROOT, "data", "registry", "marketplace-expansion-report.json");

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const body = JSON.stringify(value, null, 2);
  const tmp = `${path}.${process.pid}.tmp`;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await writeFile(tmp, body, "utf-8");
      try {
        await unlink(path);
      } catch {
        // ignore
      }
      await rename(tmp, path);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  await writeFile(path, body, "utf-8");
}

async function loadJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

const products = await loadJson<PilotProduct[]>(PRODUCTS, []);
const failed = new Set<string>();
const report: Record<string, unknown> = { generatedAt: new Date().toISOString() };

console.log("Rechecking Level Shoes...");
const level = await collectLevelShoes({ maxPagesPerListing: 80, enrichDetails: false });
report.levelShoes = {
  products: level.products.length,
  coverageStatus: level.coverageStatus,
  errors: level.errors,
  paginationExhausted: level.paginationExhausted,
  sourceReportedProductCount: level.sourceReportedProductCount,
};
if (level.products.length === 0) failed.add(LEVEL_SHOES_ID);

console.log("Collecting Farfetch...");
const farfetch = await collectFarfetch({ maxPagesPerListing: 80 });
report.farfetch = {
  products: farfetch.products.length,
  coverageStatus: farfetch.coverageStatus,
  blocked: farfetch.blocked,
  errors: farfetch.errors,
  paginationExhausted: farfetch.paginationExhausted,
  listingsCrawled: farfetch.listingsCrawled,
};
if (farfetch.products.length === 0) failed.add(FARFETCH_ID);

console.log("Free People live collector remains staging-only; leaving any existing free-people catalog rows in place.");
report.freePeople = {
  products: products.filter((product) => product.source === FREE_PEOPLE_ID).length,
  coverageStatus: "ACTIVE",
  blocked: false,
  blocker:
    "Live Playwright collect stays staging-only (npm run collect:free-people-staging). Production updates use npm run merge:free-people-staging.",
  errors: [],
};

const incoming = [
  ...(level.products.length > 0 ? level.products : []),
  ...(farfetch.products.length > 0 ? farfetch.products : []),
];
const merged = globalDedupe(mergeCatalogPreservingFailedSources(products, incoming, failed));

const activeMarketplaceIds = ["level-shoes"];
if (farfetch.products.length > 0) activeMarketplaceIds.push("farfetch");
if (products.some((product) => product.source === FREE_PEOPLE_ID)) {
  activeMarketplaceIds.push(FREE_PEOPLE_ID);
}

const pilot: MarketplacePilotState = {
  activePilotId: "level-shoes",
  activeMarketplaceIds,
  mytheresaStatus: "NEEDS_BROWSER_OR_ADAPTER",
  notes:
    farfetch.products.length > 0
      ? "Level Shoes + Farfetch after successful collection. Free People is merged separately from staging."
      : "Level Shoes remains the active marketplace. Farfetch was not activated. Free People is merged separately from staging.",
};

await writeJson(PRODUCTS, merged);
await writeJson(PILOT, pilot);
if (level.products.length > 0) {
  await writeJson(join(ROOT, "data", "multibrand", "level-shoes-coverage.json"), level);
}
if (farfetch.products.length > 0) {
  await writeJson(join(ROOT, "data", "multibrand", "farfetch-coverage.json"), farfetch);
}
await writeJson(REPORT, report);

console.log(JSON.stringify(report, null, 2));
console.log(`Products: ${merged.length}`);
console.log(`Active marketplace ids: ${activeMarketplaceIds.join(", ")}`);
