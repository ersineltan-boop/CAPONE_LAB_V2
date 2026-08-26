import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { stripConfirmedNonFootwear } from "../src/collector/stripNonFootwearCatalog";
import type { PilotProduct } from "../src/collector/types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTS_PATH = join(ROOT, "data", "multibrand", "products.json");
const REPORT_PATH = join(ROOT, "data", "multibrand", "non-footwear-removed.json");

const products = JSON.parse(await readFile(PRODUCTS_PATH, "utf-8")) as PilotProduct[];
const { kept, removed } = stripConfirmedNonFootwear(products);

await writeFile(PRODUCTS_PATH, `${JSON.stringify(kept)}\n`, "utf-8");
await writeFile(
  REPORT_PATH,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), removedCount: removed.length, removed }, null, 2)}\n`,
  "utf-8",
);

console.log(`products before: ${products.length}`);
console.log(`products after: ${kept.length}`);
console.log(`removed non-footwear: ${removed.length}`);
for (const item of removed) {
  console.log(`- [${item.source}] ${item.brand} | ${item.productName} | ${item.matchedSignal}`);
}
