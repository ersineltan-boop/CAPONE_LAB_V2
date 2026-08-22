import { mkdir, readFile, writeFile } from "node:fs/promises";
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
  WAVE1_BRAND_CANDIDATES,
} from "../src/registry/import/candidateImport";
import { universeEntryToRegistryEntry } from "../src/registry/build/convertBrandUniverse";
import {
  emptyProbeCache,
  mapProbeResultToCacheEntry,
  mergeProbeResultsIntoCache,
} from "../src/registry/build/probeCache";
import type { BrandProbeCacheFile, BrandUniverseFile } from "../src/registry/build/types";
import { collectBrandByCollectorType } from "../src/registry/collection/collectByType";
import { normalizeBrandId, normalizeBrandName } from "../src/registry/build/normalize";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UNIVERSE_FILE = join(ROOT, "data", "registry", "brand-universe.json");
const CACHE_FILE = join(ROOT, "data", "registry", "brand-probe-cache.json");
const PRODUCTS = join(ROOT, "data", "multibrand", "products.json");
const WAVE1_REPORT = join(ROOT, "data", "registry", "wave1-activation-report.json");

async function loadJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

const universe = JSON.parse(await readFile(UNIVERSE_FILE, "utf-8")) as BrandUniverseFile;
const cache = await loadJson<BrandProbeCacheFile>(CACHE_FILE, emptyProbeCache());
let products = await loadJson<PilotProduct[]>(PRODUCTS, []);

const byId = new Map(universe.brands.map((entry) => [entry.id, entry]));
const outcomes: Array<Record<string, unknown>> = [];

for (const candidate of WAVE1_BRAND_CANDIDATES) {
  const id = normalizeBrandId(candidate.brand);
  const entry = byId.get(id);
  if (!entry) {
    outcomes.push({
      brand: candidate.brand,
      id,
      alreadyExisted: false,
      added: false,
      status: "NEEDS_PROBE",
      reason: "Missing from brand-universe.json — run brands:import-candidates first",
    });
    continue;
  }

  if (entry.isActive && entry.collectionStatus === "READY_AUTOMATIC") {
    outcomes.push({
      brand: entry.brand,
      id: entry.id,
      alreadyExisted: true,
      added: false,
      activated: false,
      collectorType: entry.collectorType,
      status: "READY_AUTOMATIC",
      reason: "Already active in registry — recrawled with existing sources",
    });
    continue;
  }

  const registryEntry = universeEntryToRegistryEntry(entry);
  console.log(`\n=== Wave 1 probe: ${entry.brand} ===`);
  const probe = await probeBrandEntry(registryEntry);
  console.log(
    `  probe: ${probe.recommendation} / ${probe.detectedCollectorType} / sample ${probe.sampleProductCount}`,
  );

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
    entry.notes = `Wave 1 — ${probe.recommendation}: ${probe.error ?? "no stable generic collector"}`;
    outcomes.push({
      brand: entry.brand,
      id: entry.id,
      alreadyExisted: true,
      added: false,
      activated: false,
      platform: probe.detectedCollectorType,
      collectorType: probe.detectedCollectorType,
      collectedCount: 0,
      status: probe.recommendation,
      reason: probe.error ?? "Requires a dedicated adapter; not activated",
    });
    continue;
  }

  if (!probe.reachable && probe.recommendation === "FAILED") {
    entry.isActive = false;
    entry.collectionStatus = "FAILED";
    entry.notes = `Wave 1 — probe failed: ${probe.error ?? "unreachable"}`;
    outcomes.push({
      brand: entry.brand,
      id: entry.id,
      alreadyExisted: true,
      added: false,
      activated: false,
      platform: probe.detectedCollectorType,
      collectorType: probe.detectedCollectorType,
      collectedCount: 0,
      status: "FAILED",
      reason: probe.error ?? "Probe failed",
    });
    continue;
  }

  console.log(`  test collection (${entry.brand})...`);
  const collected = await collectBrandByCollectorType(universeEntryToRegistryEntry(entry), {
    mode: "full",
  });
  const collectedCount = collected.products.length;
  console.log(`  collected ${collectedCount} women's footwear products`);

  const activate = canActivateAfterTestCollection({
    probeReady: probeReady || collectedCount > 0,
    collectedProductCount: collectedCount,
  });

  if (!activate) {
    entry.isActive = false;
    entry.collectionStatus =
      probe.recommendation === "READY_AUTOMATIC" ? "NEEDS_FOOTWEAR_CONFIG" : probe.recommendation === "FAILED"
        ? "FAILED"
        : probe.recommendation === "NEEDS_FOOTWEAR_CONFIG"
          ? "NEEDS_FOOTWEAR_CONFIG"
          : "NEEDS_PROBE";
    entry.notes = `Wave 1 — test collection returned ${collectedCount} products (${probe.recommendation})`;
    outcomes.push({
      brand: entry.brand,
      id: entry.id,
      alreadyExisted: true,
      added: false,
      activated: false,
      platform: probe.detectedCollectorType,
      collectorType: probe.detectedCollectorType,
      collectedCount,
      status: entry.collectionStatus,
      reason: collected.errors.join("; ") || "Test collection did not return women's footwear",
      errors: collected.errors,
    });
    continue;
  }

  entry.isActive = true;
  entry.collectionStatus = "READY_AUTOMATIC";
  entry.collectorType = probe.detectedCollectorType;
  entry.supportsMultipleImages = probe.multipleImagesAvailable || collected.products.some((item) => (item.images?.length ?? 0) > 1);
  entry.productLimit = Math.max(entry.productLimit, 500);
  entry.notes = activationNotes(probe.detectedCollectorType, collectedCount);
  const crawled = collected.collectionsCrawled ?? [];
  if (crawled.length > 0) {
    entry.collectionPaths = crawled.slice(0, 12);
    entry.footwearCollectionHandles = crawled
      .map((path) => path.replace(/^\/collections\//, ""))
      .slice(0, 12);
    entry.footwearCollectionUrls = crawled
      .slice(0, 12)
      .map((path) => `${entry.officialUrl.replace(/\/$/, "")}${path}`);
    entry.collectionDiscoveryStatus = "VERIFIED";
  } else if (collected.footwearCollectionPath) {
    entry.collectionPaths = [collected.footwearCollectionPath];
    entry.collectionDiscoveryStatus = collected.discoveryStatus ?? "AUTO_DISCOVERED";
  }
  cache.entries[entry.id] = {
    ...mapProbeResultToCacheEntry(probe, entry.id),
    collectionStatus: "READY_AUTOMATIC",
    detectedCollectorType: entry.collectorType,
    recommendation: "READY_AUTOMATIC",
  };

  products = globalDedupe(
    mergeCatalogPreservingFailedSources(products, collected.products, new Set()),
  );

  outcomes.push({
    brand: entry.brand,
    id: entry.id,
    alreadyExisted: true,
    added: false,
    activated: true,
    platform: probe.detectedCollectorType,
    collectorType: probe.detectedCollectorType,
    collectedCount,
    modelFamilyCount: null,
    sourceCategories: [
      ...new Set(
        collected.products.flatMap((product) =>
          (product.sourceCategories ?? [])
            .map((category) => category.categoryName)
            .filter(Boolean),
        ),
      ),
    ].slice(0, 20),
    status: "PARTIAL",
    reason: "Activated after probe + test collection; coverage stays PARTIAL until source total agrees",
    collectionsCrawled: crawled.length,
    paginationExhausted: collected.paginationExhausted ?? false,
  });
}

universe.generatedAt = new Date().toISOString();
const nextCache = mergeProbeResultsIntoCache({
  cache,
  results: [],
  idByBrandName: new Map(
    universe.brands.map((entry) => [normalizeBrandName(entry.brand), entry.id]),
  ),
});
nextCache.updatedAt = new Date().toISOString();
nextCache.entries = cache.entries;

await writeFile(UNIVERSE_FILE, JSON.stringify(universe, null, 2), "utf-8");
await mkdir(dirname(CACHE_FILE), { recursive: true });
await writeFile(CACHE_FILE, JSON.stringify(nextCache, null, 2), "utf-8");
await mkdir(dirname(PRODUCTS), { recursive: true });
await writeFile(PRODUCTS, JSON.stringify(products, null, 2), "utf-8");
await writeFile(
  WAVE1_REPORT,
  JSON.stringify({ generatedAt: new Date().toISOString(), outcomes }, null, 2),
  "utf-8",
);

console.log("\n=== Wave 1 activation ===");
for (const outcome of outcomes) {
  console.log(
    `- ${outcome.brand}: ${outcome.status} · collected ${outcome.collectedCount ?? "-"} · activated ${outcome.activated ?? false}`,
  );
}
console.log(`Universe: ${UNIVERSE_FILE}`);
console.log(`Products: ${PRODUCTS} (${products.length})`);
