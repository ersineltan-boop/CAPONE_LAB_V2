import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildBrandRegistryFromUniverseData } from "../src/registry/build/buildBrandRegistry";
import { emptyProbeCache } from "../src/registry/build/probeCache";
import type { BrandProbeCacheFile, BrandUniverseFile } from "../src/registry/build/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

async function loadProbeCacheFile(path: string): Promise<BrandProbeCacheFile> {
  try {
    const raw = JSON.parse(await readFile(path, "utf-8")) as BrandProbeCacheFile;
    if (raw.version !== 1 || !raw.entries) return emptyProbeCache();
    return raw;
  } catch {
    return emptyProbeCache();
  }
}

const universe = JSON.parse(
  await readFile(join(ROOT, "data", "registry", "brand-universe.json"), "utf-8"),
) as BrandUniverseFile;

const probeCache = await loadProbeCacheFile(
  join(ROOT, "data", "registry", "brand-probe-cache.json"),
);

const result = buildBrandRegistryFromUniverseData({ universeFile: universe, probeCache });

console.log("\n=== CAPONE Brand Universe Build ===");
console.log(`Success: ${result.ok}`);
console.log(`Registry entries: ${result.registryCount}`);
console.log(`Total brands: ${result.report.totalBrands}`);
console.log(`Active: ${result.report.activeBrands}`);
console.log(`Inactive: ${result.report.inactiveBrands}`);
console.log(`READY_AUTOMATIC: ${result.report.readyAutomatic}`);
console.log(`NEEDS_PROBE: ${result.report.needsProbe}`);
console.log(`NEEDS_CUSTOM_ADAPTER: ${result.report.needsCustomAdapter}`);
console.log(`FAILED: ${result.report.failed}`);
console.log(`Probe cache applied: ${result.report.probeCacheApplied}`);

if (result.report.validationErrors.length > 0) {
  console.log("\nValidation errors:");
  for (const error of result.report.validationErrors) {
    console.log(`  - ${error}`);
  }
}

if (result.report.duplicateWarnings.length > 0) {
  console.log("\nWarnings:");
  for (const warning of result.report.duplicateWarnings) {
    console.log(`  - ${warning}`);
  }
}

if (result.ok && result.brandsTsContent) {
  const brandsTsPath = join(ROOT, "src", "registry", "data", "brands.ts");
  await writeFile(brandsTsPath, result.brandsTsContent, "utf-8");
  console.log("\nWritten:");
  console.log("  - src/registry/data/brands.ts");
}

const reportPath = join(ROOT, "data", "registry", "brand-universe-report.json");
await mkdir(dirname(reportPath), { recursive: true });
try {
  await writeFile(reportPath, JSON.stringify(result.report, null, 2), "utf-8");
  console.log("  - data/registry/brand-universe-report.json");
} catch (error) {
  console.warn("Could not write brand-universe-report.json", error);
}

if (!result.ok) {
  process.exitCode = 1;
}
