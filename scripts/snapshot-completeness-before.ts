import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getCollectableBrands, loadBrandRegistry } from "../src/registry";
import { loadMarketplaceRegistry } from "../src/registry/data/marketplaces";
import type { PilotProduct } from "../src/collector/types";
import type { ModelFamily } from "../src/modelFamily/types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const products = JSON.parse(
  await readFile(join(ROOT, "data", "multibrand", "products.json"), "utf-8"),
) as PilotProduct[];
const families = JSON.parse(
  await readFile(join(ROOT, "data", "multibrand", "model-families.json"), "utf-8"),
) as ModelFamily[];

const byBrand: Record<string, number> = {};
const bySource: Record<string, number> = {};
let verifiedNew = 0;
for (const product of products) {
  byBrand[product.brand] = (byBrand[product.brand] ?? 0) + 1;
  bySource[product.source] = (bySource[product.source] ?? 0) + 1;
  if (product.isNewArrivalsCollection || product.hasNewBadge) verifiedNew += 1;
}

const famByBrand: Record<string, number> = {};
let multiColor = 0;
for (const family of families) {
  famByBrand[family.brand] = (famByBrand[family.brand] ?? 0) + 1;
  if ((family.variants ?? []).length > 1 || family.variantCount > 1) multiColor += 1;
}

const registry = loadBrandRegistry();
const collectable = getCollectableBrands(registry.all());
const marketplaces = loadMarketplaceRegistry();

const report = {
  generatedAt: new Date().toISOString(),
  productCount: products.length,
  familyCount: families.length,
  activeBrands: registry.all().filter((entry) => entry.isActive).length,
  collectableBrands: collectable.map((entry) => entry.id),
  activeMarketplaces: marketplaces.filter((entry) => entry.isActive).map((entry) => entry.id),
  byBrand,
  bySource,
  famByBrand,
  multiColor,
  verifiedNew,
};

await writeFile(
  join(ROOT, "data", "registry", "completeness-before.json"),
  JSON.stringify(report, null, 2),
  "utf-8",
);

console.log(`products ${products.length} families ${families.length} multiColor ${multiColor} verifiedNew ${verifiedNew}`);
console.log(`active brands ${report.activeBrands} collectable ${collectable.length}`);
console.log(`collectable: ${collectable.map((entry) => entry.brand).join(", ")}`);
console.log("byBrand:");
for (const [brand, count] of Object.entries(byBrand).sort(([a], [b]) => a.localeCompare(b))) {
  console.log(`  ${brand}: ${count} products / ${famByBrand[brand] ?? 0} families`);
}
