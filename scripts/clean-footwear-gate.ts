import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { applyFootwearGateToProducts } from "../src/collector/footwearGateReport";
import type { PilotProduct } from "../src/collector/types";
import { runMultibrandAnalysis } from "../src/analysis/runMultibrandAnalysis";
import { brandEntries } from "../src/registry/data/brands";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MULTIBRAND_DIR = join(ROOT, "data", "multibrand");
const PRODUCTS_FILE = join(MULTIBRAND_DIR, "products.json");
const BACKUP_FILE = join(MULTIBRAND_DIR, "products.pre-footwear-gate.json");
const REPORT_FILE = join(MULTIBRAND_DIR, "footwear-gate-report.json");

const raw = JSON.parse(await readFile(PRODUCTS_FILE, "utf-8")) as PilotProduct[];

try {
  await copyFile(PRODUCTS_FILE, BACKUP_FILE);
} catch {
  await writeFile(BACKUP_FILE, JSON.stringify(raw, null, 2), "utf-8");
}

const { accepted, report } = applyFootwearGateToProducts(raw);

const needsFootwearConfigBrands = brandEntries
  .filter((entry) => entry.collectionStatus === "NEEDS_FOOTWEAR_CONFIG")
  .map((entry) => entry.brand);

report.needsFootwearConfigBrands = needsFootwearConfigBrands;
report.footwearCollectionDiscoveredBrands = brandEntries.filter(
  (entry) => entry.collectionDiscoveryStatus === "VERIFIED",
).length;

await mkdir(MULTIBRAND_DIR, { recursive: true });
await writeFile(PRODUCTS_FILE, JSON.stringify(accepted, null, 2), "utf-8");
await writeFile(REPORT_FILE, JSON.stringify(report, null, 2), "utf-8");

await runMultibrandAnalysis();

console.log("\n=== CAPONE Footwear Gate Clean ===");
console.log(`Before: ${report.totalBefore}`);
console.log(`After: ${report.totalAfter}`);
console.log(`Excluded non-footwear: ${report.excludedNonFootwear}`);
console.log(`Excluded uncertain: ${report.excludedUncertain}`);
console.log(`Backup: data/multibrand/products.pre-footwear-gate.json`);
console.log(`Report: data/multibrand/footwear-gate-report.json`);

const spotlight = [
  "THE ROW",
  "KHAITE",
  "TOTEME",
  "LEMAIRE",
  "DRIES VAN NOTEN",
  "PROENZA SCHOULER",
];
for (const brand of spotlight) {
  const row = report.brands.find((item) => item.brand === brand);
  if (!row) continue;
  console.log(
    `${brand}: ${row.collectedBefore} -> ${row.acceptedFootwear} footwear (${row.excludedNonFootwear} non-footwear, ${row.excludedUncertain} uncertain)`,
  );
}
