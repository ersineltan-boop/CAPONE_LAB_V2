import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fetchJson, sleep } from "../src/collector/http";
import {
  buildModelFamilySortIndex,
  computeModelFamilyDateStats,
  sortModelFamilies,
} from "../src/components/visualWall/modelFamilySort";
import { extractShopifyProductDates } from "../src/productDates/shopifyDates";
import { loadProductDateEnrichment } from "../src/productDates/loadEnrichment";
import { mergeProductDatesBatch } from "../src/productDates/merge";
import type { ProductDateEnrichmentEntry, ProductDateEnrichmentSidecar } from "../src/productDates/types";
import type { AnalyzedProduct } from "../src/types/marketAnalysis";
import { loadModelFamilies } from "../src/modelFamily/dataset";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MULTIBRAND_DIR = join(ROOT, "data", "multibrand");

interface ShopifyProductJson {
  product?: {
    published_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  };
}

function hasAnyDate(entry: ProductDateEnrichmentEntry): boolean {
  return Boolean(entry.publishedAt || entry.createdAt || entry.updatedAt);
}

function needsFetch(
  existing: ProductDateEnrichmentEntry | undefined,
): boolean {
  if (!existing) return true;
  return !existing.publishedAt && !existing.createdAt;
}

async function loadSnapshotFirstSeen(): Promise<Map<string, string>> {
  const index = new Map<string, string>();
  const historyDir = join(ROOT, "data", "history");

  let entries: string[] = [];
  try {
    const { readdir } = await import("node:fs/promises");
    entries = await readdir(historyDir);
  } catch {
    return index;
  }

  for (const entry of entries) {
    const snapshotPath = join(historyDir, entry, "products.json");
    try {
      const raw = await readFile(snapshotPath, "utf-8");
      const products = JSON.parse(raw) as Array<{
        productUrl: string;
        firstSeen: string;
      }>;
      for (const product of products) {
        const existing = index.get(product.productUrl);
        if (
          !existing ||
          Date.parse(product.firstSeen) < Date.parse(existing)
        ) {
          index.set(product.productUrl, product.firstSeen);
        }
      }
    } catch {
      // skip missing snapshots
    }
  }

  return index;
}

const productsPath = join(MULTIBRAND_DIR, "products.json");
const sidecarPath = join(MULTIBRAND_DIR, "product-date-enrichment.json");
const analyzedPath = join(MULTIBRAND_DIR, "analyzed-products.json");

const products = JSON.parse(await readFile(productsPath, "utf-8")) as Array<{
  productUrl: string;
  discoveredAt: string;
}>;

const existing = await loadProductDateEnrichment(sidecarPath);
const sidecar: ProductDateEnrichmentSidecar = { ...existing };
const errors: string[] = [];

let fetched = 0;
let skipped = 0;

for (const product of products) {
  if (!needsFetch(sidecar[product.productUrl])) {
    skipped += 1;
    continue;
  }

  const jsonUrl = `${product.productUrl.replace(/\/$/, "")}.json`;
  const result = await fetchJson<ShopifyProductJson>(jsonUrl, 700);

  if (result.ok && result.data?.product) {
    const dates = extractShopifyProductDates(result.data.product);
    if (dates.publishedAt || dates.createdAt || dates.updatedAt) {
      sidecar[product.productUrl] = {
        ...dates,
        enrichedAt: new Date().toISOString(),
      };
    } else {
      errors.push(`No Shopify dates in response for ${jsonUrl}`);
    }
  } else {
    errors.push(result.error ?? `Failed ${jsonUrl}`);
  }

  fetched += 1;
  await sleep(200);
}

await mkdir(MULTIBRAND_DIR, { recursive: true });
await writeFile(sidecarPath, JSON.stringify(sidecar, null, 2), "utf-8");

const mergedProducts = mergeProductDatesBatch(products, sidecar);
const withPublishedAt = mergedProducts.filter((product) => product.publishedAt).length;
const withCreatedAt = mergedProducts.filter((product) => product.createdAt).length;

const families = await loadModelFamilies();
const analyzed = JSON.parse(await readFile(analyzedPath, "utf-8")) as AnalyzedProduct[];
const mergedAnalyzed = mergeProductDatesBatch(analyzed, sidecar);
const productByUrl = new Map(
  mergedAnalyzed.map((product) => [product.productUrl, product]),
);
const firstSeenByUrl = await loadSnapshotFirstSeen();

const sortIndex = buildModelFamilySortIndex(
  families,
  productByUrl,
  firstSeenByUrl,
);
const familyStats = computeModelFamilyDateStats(sortIndex);
const sortedFamilies = sortModelFamilies(families, sortIndex, "NEWEST");

console.log("\n=== CAPONE LAB Product Date Enrichment ===");
console.log(`Products in catalog: ${products.length}`);
console.log(`Fetched this run: ${fetched}`);
console.log(`Reused from sidecar: ${skipped}`);
console.log(`Sidecar entries with dates: ${Object.values(sidecar).filter(hasAnyDate).length}`);
console.log(`Products with publishedAt: ${withPublishedAt}`);
console.log(`Products with createdAt: ${withCreatedAt}`);
console.log(`Model families with real date (published/created): ${familyStats.withPublishedOrCreatedAt}`);
console.log(`Model families on firstSeen fallback: ${familyStats.withFirstSeenFallback}`);
console.log(`Model families unknown date: ${familyStats.unknown}`);
console.log("\nTop 15 newest Model Families:");
for (const family of sortedFamilies.slice(0, 15)) {
  const meta = sortIndex.get(family.modelFamilyId);
  console.log(
    `- ${family.brand} · ${family.canonicalName} · ${meta?.displayDate ?? "—"} · ${meta?.source ?? "unknown"}`,
  );
}
if (errors.length > 0) {
  console.log(`\nFetch errors: ${errors.length}`);
  for (const error of errors.slice(0, 5)) {
    console.log(`  ${error}`);
  }
  if (errors.length > 5) {
    console.log(`  ... and ${errors.length - 5} more`);
  }
}
