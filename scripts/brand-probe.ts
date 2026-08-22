import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { probeBrandEntries } from "../src/collector/brandProbe";
import {
  brandEntries,
  getProbeCandidateBrands,
  loadBrandRegistry,
} from "../src/registry";
import {
  emptyProbeCache,
  mergeProbeResultsIntoCache,
  shouldProbeBrand,
} from "../src/registry/build/probeCache";
import type { BrandProbeCacheFile } from "../src/registry/build/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "data", "registry");
const OUT_FILE = join(OUT_DIR, "brand-probe-report.json");
const CACHE_FILE = join(OUT_DIR, "brand-probe-cache.json");

function readArgValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function loadProbeCache(path: string): Promise<BrandProbeCacheFile> {
  try {
    const raw = JSON.parse(await readFile(path, "utf-8")) as BrandProbeCacheFile;
    if (raw.version !== 1 || !raw.entries) return emptyProbeCache();
    return raw;
  } catch {
    return emptyProbeCache();
  }
}

const args = new Set(process.argv.slice(2));
const probeAll = args.has("--all");
const forceProbe = args.has("--force");
const limit = Number(readArgValue("--limit") ?? "0") || undefined;
const countryFilter = readArgValue("--country");
const priorityFilter = readArgValue("--priority");

const registry = loadBrandRegistry();
const cache = await loadProbeCache(CACHE_FILE);

let candidates = probeAll
  ? brandEntries.filter((entry) => entry.isActive)
  : getProbeCandidateBrands(brandEntries);

if (countryFilter) {
  const normalizedCountry = countryFilter.trim().toLowerCase();
  candidates = candidates.filter((entry) =>
    entry.country.trim().toLowerCase().includes(normalizedCountry),
  );
}

if (priorityFilter) {
  candidates = candidates.filter(
    (entry) => entry.trackingPriority === priorityFilter,
  );
}

const skippedDueToCache = candidates.filter(
  (entry) => !shouldProbeBrand({ entry, cache, force: forceProbe }),
).length;

candidates = candidates.filter((entry) =>
  shouldProbeBrand({ entry, cache, force: forceProbe }),
);

if (limit && limit > 0) {
  candidates = candidates.slice(0, limit);
}

console.log(`\nProbing ${candidates.length} brand(s)...`);
if (countryFilter) console.log(`  country filter: ${countryFilter}`);
if (priorityFilter) console.log(`  priority filter: ${priorityFilter}`);
if (limit) console.log(`  limit: ${limit}`);
if (forceProbe) console.log("  force: true");
if (skippedDueToCache > 0) {
  console.log(`  skipped (cache hit): ${skippedDueToCache}`);
}

const results = await probeBrandEntries(candidates);

await mkdir(OUT_DIR, { recursive: true });
await writeFile(
  OUT_FILE,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      probedCount: results.length,
      skippedDueToCache,
      results,
    },
    null,
    2,
  ),
  "utf-8",
);

const idByBrandName = new Map(
  brandEntries.map((entry) => [entry.brand.trim().toUpperCase(), entry.id]),
);
const updatedCache = mergeProbeResultsIntoCache({ cache, results, idByBrandName });
await writeFile(CACHE_FILE, JSON.stringify(updatedCache, null, 2), "utf-8");

for (const result of results) {
  console.log(
    `${result.brand}: ${result.recommendation} (${result.detectedCollectorType})`,
  );
}

console.log(`\nWritten: data/registry/brand-probe-report.json`);
console.log(`Updated: data/registry/brand-probe-cache.json`);
