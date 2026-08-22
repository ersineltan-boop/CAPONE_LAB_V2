import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { globalDedupe } from "../src/collector/dedupe";
import { mergeProductCatalog } from "../src/collector/mergeProducts";
import { collectShopifyFootwearBackfill } from "../src/collector/shopify";
import { TOTEME_BRAND_ID, emptyTotemeCollectStats } from "../src/collector/totemeFootwear";
import type { PilotProduct } from "../src/collector/types";
import { brandToPilotSourceConfig, loadBrandRegistry } from "../src/registry";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTS = join(ROOT, "data", "multibrand", "products.json");
const COVERAGE = join(ROOT, "data", "multibrand", "toteme-coverage.json");

async function loadExisting(): Promise<PilotProduct[]> {
  try {
    return JSON.parse(await readFile(PRODUCTS, "utf-8")) as PilotProduct[];
  } catch {
    return [];
  }
}

async function main() {
  const registry = loadBrandRegistry();
  const entry = registry.get(TOTEME_BRAND_ID);
  if (!entry) {
    throw new Error("TOTEME is not in the brand registry");
  }
  const config = brandToPilotSourceConfig(entry);
  if (!config) {
    throw new Error("TOTEME is missing a collectable official URL");
  }

  console.log("Collecting TOTEME women's footwear only...");
  const collected = await collectShopifyFootwearBackfill({
    ...config,
    collectMode: "full",
  });
  const stats = collected.totemeStats ?? emptyTotemeCollectStats();
  const existing = await loadExisting();
  const priorToteme = existing.filter((product) => product.source === TOTEME_BRAND_ID);
  const others = existing.filter((product) => product.source !== TOTEME_BRAND_ID);

  if (collected.products.length === 0) {
    console.error("TOTEME recrawl returned zero footwear products; prior catalog left unchanged.");
    if (collected.errors.length > 0) console.error(collected.errors.join("\n"));
    process.exitCode = 1;
    return;
  }

  const merged = globalDedupe(mergeProductCatalog(others, collected.products));
  await mkdir(dirname(PRODUCTS), { recursive: true });
  await writeFile(PRODUCTS, JSON.stringify(merged, null, 2), "utf-8");

  try {
    const reportPath = join(ROOT, "data", "multibrand", "collection-report.json");
    const report = JSON.parse(await readFile(reportPath, "utf-8")) as {
      sources?: Array<{
        source: string;
        parsedProducts?: number;
        sourceReportedProductCount?: number | null;
        paginationExhausted?: boolean;
        collectionsCrawled?: string[];
        footwearRoots?: string[];
        errors?: string[];
      }>;
    };
    const totemeReport = report.sources?.find((source) => source.source.trim().toUpperCase() === "TOTEME");
    if (totemeReport) {
      totemeReport.parsedProducts = collected.products.length;
      totemeReport.sourceReportedProductCount = collected.sourceReportedProductCount;
      totemeReport.paginationExhausted = collected.paginationExhausted;
      totemeReport.collectionsCrawled = collected.collectionsCrawled;
      totemeReport.footwearRoots = collected.collectionsCrawled;
      totemeReport.errors = collected.errors;
      await writeFile(reportPath, JSON.stringify(report, null, 2), "utf-8");
    }
  } catch {
    /* coverage can still use toteme-coverage.json */
  }
  await writeFile(
    COVERAGE,
    JSON.stringify(
      {
        collectedAt: new Date().toISOString(),
        rawProductsSeen: stats.rawProductsSeen,
        footwearAccepted: stats.footwearAccepted,
        apparelRejected: stats.apparelRejected,
        bagsAccessoriesRejected: stats.bagsAccessoriesRejected,
        uncertainRejected: stats.uncertainRejected,
        catalogProductsWritten: collected.products.length,
        priorTotemeProducts: priorToteme.length,
        collectionsCrawled: collected.collectionsCrawled ?? stats.collectionsCrawled,
        auditCollections: stats.auditCollections,
        shoesAdminProductCount: stats.shoesAdminProductCount,
        shoesPublishedProductCount: stats.shoesPublishedProductCount,
        sourceReportedProductCount: collected.sourceReportedProductCount,
        paginationExhausted: collected.paginationExhausted,
        errors: collected.errors,
      },
      null,
      2,
    ),
    "utf-8",
  );

  console.log("\n=== TOTEME recrawl ===");
  console.log(`raw products seen: ${stats.rawProductsSeen}`);
  console.log(`footwear accepted: ${stats.footwearAccepted}`);
  console.log(`apparel rejected: ${stats.apparelRejected}`);
  console.log(`bags/accessories rejected: ${stats.bagsAccessoriesRejected}`);
  console.log(`uncertain rejected: ${stats.uncertainRejected}`);
  console.log(`catalog products written: ${collected.products.length}`);
  console.log(`shoes admin products_count: ${stats.shoesAdminProductCount ?? "-"}`);
  console.log(`shoes published products.json unique: ${stats.shoesPublishedProductCount ?? "-"}`);
  console.log(`coverage reported total (published shoes): ${collected.sourceReportedProductCount ?? "-"}`);
  console.log(`prior official TOTEME products replaced: ${priorToteme.length}`);
  console.log(`collections crawled: ${(collected.collectionsCrawled ?? []).join(", ") || "(none)"}`);
  console.log(`audit collections: ${stats.auditCollections.join(", ") || "(none)"}`);
  console.log(`catalog products.json total: ${merged.length}`);
  if (collected.errors.length > 0) console.log("Errors:", collected.errors);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`TOTEME collection aborted: ${message}`);
  process.exit(1);
});
