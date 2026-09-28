import { join } from "node:path";

import {
  MODEL_FAMILY_BRAND_SHARD_PREFIX,
  MODEL_FAMILY_DATASET_DIR_REPO,
  MODEL_FAMILY_SHARD_MAX_BYTES,
  sortModelFamiliesForPersistence,
  type ModelFamilyDatasetManifest,
} from "../../modelFamily/dataset";
import type { ModelFamily } from "../../modelFamily/types";
import { buildBrandRegistryFromUniverseData } from "../../registry/build/buildBrandRegistry";
import type { BrandProbeCacheFile, BrandUniverseEntry, BrandUniverseFile } from "../../registry/build/types";
import { fullCatalogPassBlocker } from "../wave50/coverage";
import { prepareBrandDelivery } from "../automation/delivery";
import {
  atomicWriteJson,
  atomicWriteText,
  publishLastGoodCatalog,
  readJsonFile,
  stageCatalog,
} from "../wave50/publish";
import type { WaveCatalog, WaveHttp } from "../wave50/types";
import type { OfficialBrandEvidence, OfficialHttp } from "./collect";
export function officialCatalogPublishBlocker(
  catalog: WaveCatalog | null,
  evidence: OfficialBrandEvidence,
): string | null {
  if (!catalog || evidence.status !== "FULL") return evidence.blocker ?? "NOT_FULL";
  if (evidence.baselineNewArrivals !== 0) return "BASELINE_MARKED_NEW";
  if (catalog.families.some((family) => family.isNew || family.variants.some((variant) => variant.isNew))) {
    return "BASELINE_MARKED_NEW";
  }
  if (catalog.productUrls.length !== evidence.storefrontProductCount) return "STOREFRONT_TOTAL_NOT_RECONCILED";
  return fullCatalogPassBlocker(catalog.coverage);
}

function asWaveHttp(http: OfficialHttp): WaveHttp {
  return {
    async fetch(url: string) {
      const response = await http.fetchText(url);
      let data: unknown = null;
      if (response.ok) {
        try {
          data = JSON.parse(response.text) as unknown;
        } catch {
          data = null;
        }
      }
      return {
        ok: response.ok,
        status: response.status,
        url: response.url,
        data,
        text: response.text,
        error: response.error,
      };
    },
  };
}

async function existingFamilyIds(root: string, manifest: ModelFamilyDatasetManifest): Promise<Set<string>> {
  const ids = new Set<string>();
  const dir = join(root, MODEL_FAMILY_DATASET_DIR_REPO);
  for (const shard of manifest.shards) {
    const families = await readJsonFile<ModelFamily[]>(join(dir, shard.file), []);
    for (const family of families) ids.add(family.modelFamilyId);
  }
  return ids;
}

export async function publishOfficialBrandCatalog(input: {
  root: string;
  catalog: WaveCatalog | null;
  evidence: OfficialBrandEvidence;
  http: OfficialHttp;
}): Promise<{ published: boolean; blocker: string | null; families: number }> {
  const catalog = input.catalog;
  const blocker = officialCatalogPublishBlocker(catalog, input.evidence);
  if (blocker || !catalog) return { published: false, blocker: blocker ?? "NOT_FULL", families: 0 };

  const prepared = await prepareBrandDelivery({
    catalog: catalog,
    http: asWaveHttp(input.http),
  });
  if (prepared.unresolved.length > 0) {
    return { published: false, blocker: `TAXONOMY_BLOCKED:${prepared.unresolved.length}`, families: 0 };
  }
  if (prepared.families.length === 0) return { published: false, blocker: "EMPTY_DELIVERY", families: 0 };

  const dir = join(input.root, MODEL_FAMILY_DATASET_DIR_REPO);
  const manifestPath = join(dir, "manifest.json");
  const manifest = await readJsonFile<ModelFamilyDatasetManifest | null>(manifestPath, null);
  if (!manifest) return { published: false, blocker: "MODEL_FAMILY_MANIFEST_MISSING", families: 0 };

  const file = `${MODEL_FAMILY_BRAND_SHARD_PREFIX}${catalog.slug}.json`;
  const ownShard = `${MODEL_FAMILY_BRAND_SHARD_PREFIX}${catalog.slug}.json`;
  const ids = await existingFamilyIds(input.root, {
    ...manifest,
    shards: manifest.shards.filter((shard) => shard.file !== ownShard),
  });
  for (const family of prepared.families) {
    if (ids.has(family.modelFamilyId)) {
      return { published: false, blocker: `DUPLICATE_MODEL_FAMILY:${family.modelFamilyId}`, families: 0 };
    }
  }

  const families = sortModelFamiliesForPersistence(prepared.families);
  const body = JSON.stringify(families);
  const bytes = Buffer.byteLength(body, "utf8");
  if (bytes > MODEL_FAMILY_SHARD_MAX_BYTES) {
    return { published: false, blocker: "BRAND_SHARD_TOO_LARGE", families: 0 };
  }

  const universePath = join(input.root, "data/registry/brand-universe.json");
  const universe = await readJsonFile<BrandUniverseFile>(universePath, { version: 1, brands: [] });
  const current = universe.brands.find((entry) => entry.id === catalog.slug);
  if (!current) return { published: false, blocker: "UNIVERSE_ENTRY_MISSING", families: 0 };
  const nextUniverse: BrandUniverseFile = {
    ...universe,
    generatedAt: catalog.collectedAt,
    brands: universe.brands.map((entry) => entry.id === current.id ? universeEntry(current, catalog!, input.evidence.refreshCommand) : entry),
  };
  const probeCache = await readJsonFile<BrandProbeCacheFile>(
    join(input.root, "data/registry/brand-probe-cache.json"),
    { version: 1, updatedAt: catalog.collectedAt, entries: {} },
  );
  const built = buildBrandRegistryFromUniverseData({ universeFile: nextUniverse, probeCache });
  if (!built.ok || !built.brandsTsContent) {
    return { published: false, blocker: built.report.validationErrors.join("; ") || "UNIVERSE_BUILD_FAILED", families: 0 };
  }

  await stageCatalog(input.root, catalog);
  const lastGood = await publishLastGoodCatalog(input.root, catalog);
  if (!lastGood.published) return { published: false, blocker: lastGood.blocker, families: 0 };

  await atomicWriteText(join(dir, file), body);
  const previous = manifest.shards.find((shard) => shard.file === file);
  manifest.shards = manifest.shards.filter((shard) => shard.file !== file);
  manifest.shards.push({ file, familyCount: families.length, bytes });
  manifest.shards.sort((left, right) => left.file.localeCompare(right.file, "en"));
  manifest.totalFamilies += families.length - (previous?.familyCount ?? 0);
  manifest.shardCount = manifest.shards.length;
  manifest.generatedAt = catalog.collectedAt;
  await atomicWriteJson(manifestPath, manifest);
  await atomicWriteJson(universePath, nextUniverse);
  await atomicWriteJson(join(input.root, "data/registry/brand-universe-report.json"), built.report);
  await atomicWriteText(join(input.root, "src/registry/data/brands.ts"), built.brandsTsContent);
  return { published: true, blocker: null, families: families.length };
}

function universeEntry(previous: BrandUniverseEntry, catalog: WaveCatalog, refreshCommand: string): BrandUniverseEntry {
  const handles = catalog.catalogPaths.map((path) => path.split("/collections/")[1] ?? "").filter(Boolean);
  const base = catalog.officialUrl.replace(/\/$/, "");
  return {
    ...previous,
    isActive: true,
    collectorType: "CUSTOM_ADAPTER",
    collectionStatus: "NEEDS_CUSTOM_ADAPTER",
    footwearFocus: previous.footwearFocus ?? "WOMENS_FOOTWEAR",
    womenFootwearRelevant: true,
    notes: `Issue 91 official storefront women's footwear. source_total=${catalog.coverage.sourceTotal}. Refresh: ${refreshCommand}. Not on the periodic brand line.`,
    collectionUrl: `${base}${catalog.catalogPaths[0] ?? ""}`,
    collectionPaths: catalog.catalogPaths,
    footwearCollectionUrls: catalog.catalogPaths.map((path) => `${base}${path}`),
    footwearCollectionHandles: handles,
    collectionDiscoveryStatus: "VERIFIED",
    productLimit: Math.max(previous.productLimit, catalog.coverage.collected),
    backfillLimit: Math.max(previous.backfillLimit ?? 0, catalog.coverage.collected),
    supportsMultipleImages: true,
    discoverySources: [...new Set([...(previous.discoverySources ?? []), "issue-91"])],
  };
}
