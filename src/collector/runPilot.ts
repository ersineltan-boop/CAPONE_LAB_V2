import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { collectShopifyCollectionProducts } from "./shopify";
import { PILOT_SOURCES } from "./sources";
import type { CollectionReport, PilotProduct, SourceCollectionReport } from "./types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUTPUT_DIR = join(ROOT, "data", "pilot");

function globalDedupe(products: PilotProduct[]): PilotProduct[] {
  const seen = new Set<string>();
  const result: PilotProduct[] = [];

  for (const product of products) {
    const key = product.productUrl.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(product);
  }

  return result;
}

function buildSourceReport(
  source: string,
  discoveredLinks: number,
  products: PilotProduct[],
  errors: string[],
): SourceCollectionReport {
  const withImages = products.filter((p) => Boolean(p.imageUrl)).length;
  const withMaterial = products.filter((p) => Boolean(p.material)).length;

  let status: SourceCollectionReport["status"] = "failed";
  if (products.length > 0 && errors.length === 0) status = "success";
  else if (products.length > 0) status = "partial";

  return {
    source,
    status,
    discoveredProductLinks: discoveredLinks,
    parsedProducts: products.length,
    productsWithImages: withImages,
    productsWithMaterial: withMaterial,
    errors,
  };
}

export async function runPilotCollection(): Promise<CollectionReport> {
  const runStartedAt = new Date().toISOString();
  const allProducts: PilotProduct[] = [];
  const sourceReports: SourceCollectionReport[] = [];

  for (const sourceConfig of PILOT_SOURCES) {
    console.log(`Collecting ${sourceConfig.brand}...`);

    try {
      const { products, discoveredLinks, errors } =
        await collectShopifyCollectionProducts(sourceConfig);

      allProducts.push(...products);
      sourceReports.push(
        buildSourceReport(
          sourceConfig.brand,
          discoveredLinks.size,
          products,
          errors,
        ),
      );

      console.log(
        `  → ${products.length} products (${discoveredLinks.size} links discovered)`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sourceReports.push({
        source: sourceConfig.brand,
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

  const deduped = globalDedupe(allProducts);
  const runFinishedAt = new Date().toISOString();

  const report: CollectionReport = {
    runStartedAt,
    runFinishedAt,
    totalProducts: deduped.length,
    sources: sourceReports,
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

  return report;
}
