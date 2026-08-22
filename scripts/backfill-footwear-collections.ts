import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { runFootwearBackfillCollect } from "../src/collector/runFootwearBackfill";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_PATH = join(ROOT, "data", "multibrand", "footwear-backfill-report.json");

const skipDiscovery = process.argv.includes("--skip-discovery");

const report = await runFootwearBackfillCollect({ skipDiscovery });

console.log("\nRebuilding model families...");
await execFileAsync("npm", ["run", "analyze:multibrand"], {
  cwd: ROOT,
  shell: true,
});
await execFileAsync("npm", ["run", "build:model-families"], {
  cwd: ROOT,
  shell: true,
});

const { loadModelFamilies } = await import("../src/modelFamily/dataset");
const families = await loadModelFamilies();
report.modelFamiliesAfter = families.length;

for (const stat of report.brandStats) {
  stat.modelsAfter = families.filter(
    (family) => family.brand.trim().toUpperCase() === stat.brand.trim().toUpperCase(),
  ).length;
}

await mkdir(dirname(REPORT_PATH), { recursive: true });
await writeFile(REPORT_PATH, JSON.stringify(report, null, 2), "utf-8");

console.log("\n=== CAPONE Footwear Backfill ===");
console.log(`Products: ${report.productsBefore} → ${report.productsAfter}`);
console.log(`Model families: ${report.modelFamiliesAfter}`);
console.log(
  `VERIFIED/AUTO_DISCOVERED brands: ${report.verifiedOrAutoDiscovered}/${report.activeBrands}`,
);
console.log(`Backfill limit hit: ${report.brandsAtBackfillLimit.length}`);
console.log(`Incremental tracking: ${report.incrementalTrackingReady ? "ready" : "no"}`);
console.log(`Report: ${REPORT_PATH}`);

const focus = [
  "THE ROW",
  "KHAITE",
  "TOTEME",
  "LEMAIRE",
  "DRIES VAN NOTEN",
  "PROENZA SCHOULER",
];
console.log("\nFocus brands:");
for (const brand of focus) {
  const row = report.discovery.find((entry) => entry.brand === brand);
  const stat = report.brandStats.find((entry) => entry.brand === brand);
  console.log(
    `${brand}: ${row?.status ?? "?"} | ${stat?.productsBefore ?? 0} → ${stat?.productsAfter ?? 0} products | ${stat?.modelsAfter ?? 0} models | ${row?.footwearCollectionPath ?? "—"}`,
  );
}
