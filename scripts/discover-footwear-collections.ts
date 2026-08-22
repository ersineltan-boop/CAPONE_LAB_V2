import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { discoverActiveBrandCollections } from "../src/collector/runFootwearBackfill";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_PATH = join(ROOT, "data", "multibrand", "footwear-collection-discovery-report.json");

const { discoveryRows } = await discoverActiveBrandCollections();

const report = {
  generatedAt: new Date().toISOString(),
  activeBrands: discoveryRows.length,
  verifiedOrAutoDiscovered: discoveryRows.filter(
    (row) => row.status === "VERIFIED" || row.status === "AUTO_DISCOVERED",
  ).length,
  notFoundBrands: discoveryRows.filter((row) => row.status === "NOT_FOUND").map((row) => row.brand),
  needsManualConfigBrands: discoveryRows
    .filter((row) => row.status === "NEEDS_MANUAL_CONFIG")
    .map((row) => row.brand),
  brands: discoveryRows,
};

await mkdir(dirname(REPORT_PATH), { recursive: true });
await writeFile(REPORT_PATH, JSON.stringify(report, null, 2), "utf-8");

console.log("\n=== CAPONE Footwear Collection Discovery ===");
console.log(`Active brands probed: ${report.activeBrands}`);
console.log(`VERIFIED/AUTO_DISCOVERED: ${report.verifiedOrAutoDiscovered}`);
console.log(`NOT_FOUND: ${report.notFoundBrands.length}`);
console.log(`NEEDS_MANUAL_CONFIG: ${report.needsManualConfigBrands.length}`);
console.log(`Report: ${REPORT_PATH}`);

for (const row of discoveryRows) {
  console.log(
    `${row.brand}: ${row.status} → ${row.footwearCollectionPath ?? "—"} (${row.footwearCollectionHandle ?? "—"})`,
  );
}
