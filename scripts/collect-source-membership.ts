import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { collectShopifyCollectionMembership } from "../src/collector/shopifyCollectionMembership";
import { FULL_COLLECTION_CRAWL_CAP } from "../src/collector/fullCoveragePaths";
import { globalDedupe } from "../src/collector/dedupe";
import { mergeProductCatalog } from "../src/collector/mergeProducts";
import type { PilotProduct } from "../src/collector/types";
import { loadBrandRegistry } from "../src/registry/data/index";
import { brandToPilotSourceConfig } from "../src/registry/collection/brandToCollector";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTS = join(ROOT, "data", "multibrand", "products.json");

async function loadExisting(): Promise<PilotProduct[]> {
  try {
    return JSON.parse(await readFile(PRODUCTS, "utf-8")) as PilotProduct[];
  } catch {
    return [];
  }
}

const requested = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));

async function main() {
  const registry = loadBrandRegistry();
  const ids = requested.length > 0 ? requested : ["jeffrey-campbell"];
  let catalog = await loadExisting();

  for (const id of ids) {
    const entry = registry.get(id);
    if (!entry) {
      console.error(`Unknown brand: ${id}`);
      continue;
    }
    const config = brandToPilotSourceConfig(entry);
    if (!config) {
      console.error(`No collector config for ${id}`);
      continue;
    }
    const known = catalog
      .filter((product) => product.brand.trim().toUpperCase() === entry.brand.trim().toUpperCase())
      .map((product) => product.productUrl);
    console.log(`\n=== Collection membership recrawl: ${entry.brand} ===`);
    const collected = await collectShopifyCollectionMembership(config, {
      knownProductUrls: known,
      maxCollections: FULL_COLLECTION_CRAWL_CAP,
    });
    console.log(`Discovered collections: ${collected.discoveredCollections.length}`);
    console.log(`Crawled footwear collections: ${collected.crawledCollections.length}`);
    console.log(
      collected.crawledCollections
        .map((item) => `${item.title} [${item.handle}] n=${item.productsCount}`)
        .join("\n"),
    );
    if (collected.skippedCollections.length > 0) {
      console.log(`Skipped (cap): ${collected.skippedCollections.map((item) => item.handle).join(", ")}`);
    }
    console.log(`Membership products: ${collected.products.length}`);
    console.log(`Pages: ${collected.pagesTraversed}`);
    if (collected.errors.length > 0) console.log("Errors:", collected.errors);

    const others = catalog.filter(
      (product) => product.brand.trim().toUpperCase() !== entry.brand.trim().toUpperCase(),
    );
    const keptBrand = catalog.filter(
      (product) => product.brand.trim().toUpperCase() === entry.brand.trim().toUpperCase(),
    );
    catalog = globalDedupe(mergeProductCatalog(others, mergeProductCatalog(keptBrand, collected.products)));
  }

  await mkdir(dirname(PRODUCTS), { recursive: true });
  await writeFile(PRODUCTS, JSON.stringify(catalog, null, 2), "utf-8");
  console.log(`\nWrote ${catalog.length} products to ${PRODUCTS}`);
}

main();
