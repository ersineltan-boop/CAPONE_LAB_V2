import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { probeBrandEntry } from "../src/collector/brandProbe";
import { globalDedupe } from "../src/collector/dedupe";
import { mergeCatalogPreservingFailedSources } from "../src/collector/mergeProducts";
import type { PilotProduct } from "../src/collector/types";
import {
  activationNotes,
  canActivateAfterProbe,
  canActivateAfterTestCollection,
  EXPANSION_PROBE_BRAND_IDS,
  importBrandCandidates,
  TODAY_EXPANSION_CANDIDATES,
} from "../src/registry/import/candidateImport";
import { universeEntryToRegistryEntry } from "../src/registry/build/convertBrandUniverse";
import {
  emptyProbeCache,
  mapProbeResultToCacheEntry,
} from "../src/registry/build/probeCache";
import type { BrandProbeCacheFile, BrandUniverseFile } from "../src/registry/build/types";
import { collectBrandByCollectorType } from "../src/registry/collection/collectByType";
import { isCollectableBrand } from "../src/registry/collection/brandToCollector";
import { ZARA_BRAND_ID } from "../src/collector/zara";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UNIVERSE_FILE = join(ROOT, "data", "registry", "brand-universe.json");
const CACHE_FILE = join(ROOT, "data", "registry", "brand-probe-cache.json");
const PRODUCTS = join(ROOT, "data", "multibrand", "products.json");
const REPORT = join(ROOT, "data", "registry", "expansion-activation-report.json");
function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

const batchLimitRaw = argValue("--limit") ?? process.env.CAPONE_BRAND_BATCH_LIMIT ?? "25";
const batchLimit = Number(batchLimitRaw);
if (!Number.isInteger(batchLimit) || batchLimit <= 0) {
  throw new Error(`Brand expansion --limit must be a positive integer, received: ${batchLimitRaw}`);
}

async function loadJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const body = JSON.stringify(value, null, 2);
  const tmp = `${path}.${process.pid}.tmp`;
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await writeFile(tmp, body, "utf-8");
      try {
        await unlink(path);
      } catch {
        // ignore missing target
      }
      await rename(tmp, path);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  await writeFile(path, body, "utf-8");
  if (lastError) {
    console.warn(`writeJson recovered after retries for ${path}`);
  }
}

async function persist(): Promise<void> {
  universe.generatedAt = new Date().toISOString();
  cache.updatedAt = new Date().toISOString();
  await writeJson(UNIVERSE_FILE, universe);
  await writeJson(CACHE_FILE, cache);
  await writeJson(PRODUCTS, products);
}

function collectableCount(universe: BrandUniverseFile): number {
  return universe.brands.filter((entry) => isCollectableBrand(universeEntryToRegistryEntry(entry))).length;
}

function skipStaleCustomAdapter(entry: BrandUniverseEntry): string | null {
  if (entry.id === ZARA_BRAND_ID) return null;
  if (entry.collectionStatus === "NEEDS_CUSTOM_ADAPTER" || entry.collectorType === "UNSUPPORTED") {
    return `${entry.collectionStatus}/${entry.collectorType}: previous probe found no stable generic collector`;
  }
  if (entry.collectionStatus === "FAILED" && entry.collectorType === "UNSUPPORTED") {
    return "Previous probe FAILED with UNSUPPORTED collector";
  }
  return null;
}

const imported = importBrandCandidates(
  JSON.parse(await readFile(UNIVERSE_FILE, "utf-8")) as BrandUniverseFile,
  TODAY_EXPANSION_CANDIDATES,
);
const universe = imported.universe;
const cache = await loadJson<BrandProbeCacheFile>(CACHE_FILE, emptyProbeCache());
let products = await loadJson<PilotProduct[]>(PRODUCTS, []);
const byId = new Map(universe.brands.map((entry) => [entry.id, entry]));
const outcomes: Array<Record<string, unknown>> = [];
const beforeCount = collectableCount(universe);
let attemptedThisRun = 0;

console.log(
  `Expansion start. Collectable brands: ${beforeCount}. Added ${imported.added.length} registry candidates. Batch limit: ${batchLimit}.`,
);

const orderedIds = [
  ...EXPANSION_PROBE_BRAND_IDS,
  ...imported.added.map((entry) => entry.id),
].filter((id, index, all) => all.indexOf(id) === index);

for (const id of orderedIds) {
  const entry = byId.get(id);
  if (!entry) {
    outcomes.push({ id, status: "MISSING", reason: "Not in brand-universe.json after import" });
    continue;
  }

  if (entry.isActive && entry.collectionStatus === "READY_AUTOMATIC") {
    outcomes.push({
      brand: entry.brand,
      id: entry.id,
      activated: false,
      status: "READY_AUTOMATIC",
      reason: "Already active",
    });
    continue;
  }

  const stale = skipStaleCustomAdapter(entry);
  if (stale && id !== ZARA_BRAND_ID) {
    outcomes.push({
      brand: entry.brand,
      id: entry.id,
      activated: false,
      status: entry.collectionStatus,
      collectorType: entry.collectorType,
      reason: stale,
    });
    continue;
  }

  if (attemptedThisRun >= batchLimit) {
    outcomes.push({
      brand: entry.brand,
      id,
      status: "SKIPPED_BATCH_LIMIT",
      reason: `Per-run safety limit reached (${batchLimit}); candidate stays queued for the next run`,
    });
    continue;
  }
  attemptedThisRun += 1;

  console.log(`\n=== Expansion probe: ${entry.brand} ===`);
  const registryEntry = universeEntryToRegistryEntry(entry);

  if (id === ZARA_BRAND_ID) {
    const result = await collectBrandByCollectorType(registryEntry, { mode: "full" });
    const collectedCount = result.products.length;
    console.log(`  Zara custom adapter collected ${collectedCount}`);
    if (collectedCount === 0) {
      entry.isActive = false;
      entry.collectorType = "CUSTOM_ADAPTER";
      entry.collectionStatus = "NEEDS_CUSTOM_ADAPTER";
      entry.notes = `Expansion — Zara adapter returned 0 products: ${result.errors.join("; ") || "empty"}`;
      outcomes.push({
        brand: entry.brand,
        id: entry.id,
        activated: false,
        platform: "CUSTOM_ADAPTER",
        collectedCount: 0,
        status: "NEEDS_CUSTOM_ADAPTER",
        reason: result.errors.join("; ") || "Zara adapter returned no women's footwear",
      });
      continue;
    }
    entry.isActive = true;
    entry.collectorType = "CUSTOM_ADAPTER";
    entry.collectionStatus = "READY_AUTOMATIC";
    entry.productLimit = Math.max(entry.productLimit, 500);
    entry.supportsMultipleImages = result.products.some((item) => (item.images?.length ?? 0) > 1);
    entry.notes = activationNotes("CUSTOM_ADAPTER", collectedCount).replace("Wave 1", "Expansion");
    products = globalDedupe(mergeCatalogPreservingFailedSources(products, result.products, new Set()));
    outcomes.push({
      brand: entry.brand,
      id: entry.id,
      activated: true,
      platform: "CUSTOM_ADAPTER",
      collectorType: "CUSTOM_ADAPTER",
      collectedCount,
      status: "PARTIAL",
      reason: "Activated after Zara public ajax collector",
      paginationExhausted: result.paginationExhausted ?? false,
    });
    await persist();
    continue;
  }

  const probe = await probeBrandEntry(registryEntry);
  console.log(`  probe: ${probe.recommendation} / ${probe.detectedCollectorType} / sample ${probe.sampleProductCount}`);
  entry.collectorType = probe.detectedCollectorType;
  cache.entries[entry.id] = mapProbeResultToCacheEntry(probe, entry.id);
  const probeReady = canActivateAfterProbe({
    recommendation: probe.recommendation,
    productDiscoveryWorks: probe.productDiscoveryWorks,
    sampleProductCount: probe.sampleProductCount,
  });

  if (probe.recommendation === "NEEDS_CUSTOM_ADAPTER" || probe.recommendation === "LINK_ONLY") {
    entry.isActive = false;
    entry.collectionStatus = probe.recommendation;
    entry.notes = `Expansion — ${probe.recommendation}: ${probe.error ?? "no stable generic collector"}`;
    outcomes.push({
      brand: entry.brand,
      id: entry.id,
      activated: false,
      platform: probe.detectedCollectorType,
      collectedCount: 0,
      status: probe.recommendation,
      reason: probe.error ?? "Requires a dedicated adapter; not activated",
    });
    continue;
  }

  if (!probe.reachable && probe.recommendation === "FAILED") {
    entry.isActive = false;
    entry.collectionStatus = "FAILED";
    entry.notes = `Expansion — probe failed: ${probe.error ?? "unreachable"}`;
    outcomes.push({
      brand: entry.brand,
      id: entry.id,
      activated: false,
      collectedCount: 0,
      status: "FAILED",
      reason: probe.error ?? "Probe failed",
    });
    continue;
  }

  console.log(`  test collection (${entry.brand})...`);
  const result = await collectBrandByCollectorType(universeEntryToRegistryEntry(entry), { mode: "full" });
  const collectedCount = result.products.length;
  console.log(`  collected ${collectedCount} women's footwear products`);
  const activate = canActivateAfterTestCollection({
    probeReady: probeReady || collectedCount > 0,
    collectedProductCount: collectedCount,
  });

  if (!activate) {
    entry.isActive = false;
    entry.collectionStatus =
      probe.recommendation === "READY_AUTOMATIC"
        ? "NEEDS_FOOTWEAR_CONFIG"
        : probe.recommendation === "FAILED"
          ? "FAILED"
          : probe.recommendation === "NEEDS_FOOTWEAR_CONFIG"
            ? "NEEDS_FOOTWEAR_CONFIG"
            : "NEEDS_PROBE";
    entry.notes = `Expansion — test collection returned ${collectedCount} products (${probe.recommendation})`;
    outcomes.push({
      brand: entry.brand,
      id: entry.id,
      activated: false,
      platform: probe.detectedCollectorType,
      collectedCount,
      status: entry.collectionStatus,
      reason: result.errors.join("; ") || "Test collection did not return women's footwear",
    });
    continue;
  }

  entry.isActive = true;
  entry.collectionStatus = "READY_AUTOMATIC";
  entry.collectorType = probe.detectedCollectorType;
  entry.supportsMultipleImages =
    probe.multipleImagesAvailable || result.products.some((item) => (item.images?.length ?? 0) > 1);
  entry.productLimit = Math.max(entry.productLimit, 500);
  entry.notes = activationNotes(probe.detectedCollectorType, collectedCount).replace("Wave 1", "Expansion");
  const crawled = result.collectionsCrawled ?? [];
  if (crawled.length > 0) {
    entry.collectionPaths = crawled.slice(0, 12);
    entry.footwearCollectionHandles = crawled
      .map((path) => path.replace(/^\/collections\//, ""))
      .slice(0, 12);
    entry.footwearCollectionUrls = crawled
      .slice(0, 12)
      .map((path) => `${entry.officialUrl.replace(/\/$/, "")}${path}`);
    entry.collectionDiscoveryStatus = "VERIFIED";
  } else if (result.footwearCollectionPath) {
    entry.collectionPaths = [result.footwearCollectionPath];
    entry.collectionDiscoveryStatus = result.discoveryStatus ?? "AUTO_DISCOVERED";
  }
  cache.entries[entry.id] = {
    ...mapProbeResultToCacheEntry(probe, entry.id),
    collectionStatus: "READY_AUTOMATIC",
    detectedCollectorType: entry.collectorType,
    recommendation: "READY_AUTOMATIC",
  };
  products = globalDedupe(mergeCatalogPreservingFailedSources(products, result.products, new Set()));
  outcomes.push({
    brand: entry.brand,
    id: entry.id,
    activated: true,
    platform: probe.detectedCollectorType,
    collectorType: probe.detectedCollectorType,
    collectedCount,
    status: "PARTIAL",
    reason: "Activated after probe + test collection",
    collectionsCrawled: crawled.length,
    paginationExhausted: result.paginationExhausted ?? false,
  });
  await persist();
}

universe.generatedAt = new Date().toISOString();
cache.updatedAt = new Date().toISOString();
await writeJson(UNIVERSE_FILE, universe);
await writeJson(CACHE_FILE, cache);
await writeJson(PRODUCTS, products);
await writeJson(REPORT, {
  generatedAt: new Date().toISOString(),
  collectableBefore: beforeCount,
  collectableAfter: collectableCount(universe),
  batchLimit,
  attemptedThisRun,
  remainingQueued: outcomes.filter((outcome) => outcome.status === "SKIPPED_BATCH_LIMIT").length,
  imported: imported.added.map((entry) => entry.id),
  alreadyPresent: imported.alreadyPresent,
  outcomes,
});

console.log("\n=== Expansion activation ===");
for (const outcome of outcomes) {
  console.log(
    `- ${outcome.brand ?? outcome.id}: ${outcome.status} · collected ${outcome.collectedCount ?? "-"} · activated ${outcome.activated ?? false}`,
  );
}
console.log(`Attempted this run: ${attemptedThisRun}/${batchLimit}`);
console.log(`Collectable: ${beforeCount} -> ${collectableCount(universe)}`);
console.log(`Products: ${products.length}`);
console.log(`Report: ${REPORT}`);
