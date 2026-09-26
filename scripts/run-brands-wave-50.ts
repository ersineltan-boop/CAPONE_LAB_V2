import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildDeterministicWaveBrands } from "../src/brands/wave50/officialBrands";
import {
  appendPassedFamilies,
  applyPassedBrandsToUniverse,
  readJsonFile,
  writeWaveReport,
  WAVE_LAST_GOOD_DIR,
} from "../src/brands/wave50/publish";
import { runBrandsWave } from "../src/brands/wave50/runWave";
import type { WaveCatalog, WaveHttp, WaveHttpResponse } from "../src/brands/wave50/types";
import { WAVE_COLLECTOR_CONCURRENCY } from "../src/brands/wave50/types";
import type { BrandUniverseFile } from "../src/registry/build/types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function liveHttp(): WaveHttp {
  return {
    async fetch(url: string): Promise<WaveHttpResponse> {
      try {
        let response = await fetch(url, {
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
          },
          redirect: "follow",
          signal: AbortSignal.timeout(25000),
        });
        if (response.status === 429) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          response = await fetch(url, {
            headers: {
              "User-Agent": USER_AGENT,
              Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
            },
            redirect: "follow",
            signal: AbortSignal.timeout(25000),
          });
        }
        const text = await response.text();
        let data: unknown | null = null;
        const trimmed = text.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          try {
            data = JSON.parse(trimmed) as unknown;
          } catch {
            data = null;
          }
        }
        return {
          ok: response.ok,
          status: response.status,
          url: response.url,
          data,
          text: text.slice(0, 4000),
        };
      } catch (error) {
        return {
          ok: false,
          status: 0,
          url,
          data: null,
          text: "",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

const universe = JSON.parse(
  await readFile(join(ROOT, "data/registry/brand-universe.json"), "utf-8"),
) as BrandUniverseFile;
const seeds = buildDeterministicWaveBrands(universe.brands);
const previousUrlsBySlug = new Map<string, ReadonlySet<string>>();
for (const seed of seeds) {
  const previous = await readJsonFile<WaveCatalog | null>(
    join(ROOT, WAVE_LAST_GOOD_DIR, `${seed.slug}.json`),
    null,
  );
  if (previous?.productUrls?.length) previousUrlsBySlug.set(seed.slug, new Set(previous.productUrls));
}

console.log(`=== CAPONE brands wave ===`);
console.log(`seeds: ${seeds.length}`);
console.log(`first: ${seeds[0]?.slug}`);
console.log(`concurrency: ${WAVE_COLLECTOR_CONCURRENCY}`);

const report = await runBrandsWave({
  root: ROOT,
  seeds,
  http: liveHttp(),
  concurrency: WAVE_COLLECTOR_CONCURRENCY,
  previousUrlsBySlug,
});

const passedCatalogs: WaveCatalog[] = [];
for (const outcome of report.outcomes) {
  if (!outcome.published) continue;
  const catalog = await readJsonFile<WaveCatalog | null>(
    join(ROOT, WAVE_LAST_GOOD_DIR, `${outcome.slug}.json`),
    null,
  );
  if (catalog) passedCatalogs.push(catalog);
}

const familyCount = await appendPassedFamilies(ROOT, passedCatalogs);
const universeResult = await applyPassedBrandsToUniverse(ROOT, passedCatalogs);
await writeWaveReport(ROOT, report);

console.log(`attempted: ${report.attempted}`);
console.log(`accessible: ${report.accessible}`);
console.log(`publishedCatalogs: ${report.publishedCatalogs}`);
console.log(`customAdapter: ${report.customAdapter}`);
console.log(`sourceUnavailable: ${report.sourceUnavailable}`);
console.log(`stagingProducts: ${report.stagingProducts}`);
console.log(`universe: ${report.universeBrandsBefore} -> ${report.universeBrandsAfter}`);
console.log(`activeBrands: ${report.activeBrandsBefore} -> ${report.activeBrandsAfter}`);
console.log(`netNewUniverseBrands: ${report.netNewUniverseBrands}`);
console.log(`netNewActiveBrands: ${report.netNewActiveBrands}`);
console.log(`initialSiteDeliveryFamilies: ${report.initialSiteDeliveryFamilies}`);
console.log(`siteDeliveryFamilies: ${report.siteDeliveryFamilies}`);
console.log(`siteDeliveryProducts: ${report.siteDeliveryProducts}`);
console.log(`collectTargets: ${report.collectTargets}`);
console.log(`familiesAppended: ${familyCount}`);
console.log(`universeUpdated: ${universeResult.updated}`);
if (universeResult.errors.length) console.log(`universeErrors: ${universeResult.errors.join(" | ")}`);
for (const outcome of report.outcomes) {
  if (outcome.disposition !== "ACCESSIBLE" && outcome.disposition !== "SOURCE_UNAVAILABLE") continue;
  const coverage = outcome.coverage
    ? ` total=${outcome.coverage.sourceTotal ?? "?"} collected=${outcome.coverage.collected} coverage=${outcome.coverage.coverage ?? "?"}`
    : "";
  console.log(
    `- ${outcome.slug}: ${outcome.disposition}${outcome.fullCatalogPassed ? " FULL" : ""}${coverage}${outcome.blocker ? ` / ${outcome.blocker}` : ""}`,
  );
}
