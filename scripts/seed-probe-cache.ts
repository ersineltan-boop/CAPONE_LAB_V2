import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { mapProbeResultToCacheEntry } from "../src/registry/build/probeCache";
import type { BrandProbeCacheFile } from "../src/registry/build/types";
import { brandEntries } from "../src/registry/data/brands";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PROBE_REPORT = join(ROOT, "data", "registry", "brand-probe-report.json");
const CACHE_FILE = join(ROOT, "data", "registry", "brand-probe-cache.json");

interface ProbeReportFile {
  results: Array<{
    brand: string;
    officialUrl: string;
    detectedCollectorType: BrandProbeCacheFile["entries"][string]["detectedCollectorType"];
    reachable: boolean;
    recommendation: string;
  }>;
}

const idByBrandName = new Map(
  brandEntries.map((entry) => [entry.brand.trim().toUpperCase(), entry.id]),
);

const report = JSON.parse(await readFile(PROBE_REPORT, "utf-8")) as ProbeReportFile;

const cache: BrandProbeCacheFile = {
  version: 1,
  updatedAt: new Date().toISOString(),
  entries: {},
};

for (const result of report.results) {
  const brandId = idByBrandName.get(result.brand.trim().toUpperCase());
  if (!brandId) continue;
  cache.entries[brandId] = mapProbeResultToCacheEntry(result as never, brandId);
}

await mkdir(dirname(CACHE_FILE), { recursive: true });
await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");

console.log(`Seeded probe cache with ${Object.keys(cache.entries).length} entries`);
