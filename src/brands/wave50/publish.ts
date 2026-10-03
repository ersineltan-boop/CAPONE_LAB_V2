import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { assignPrimaryCategory } from "../../taxonomy/assignCategory";
import { createNotVerifiedNewness } from "../../newArrivals/newness";
import type { ModelFamily, ModelFamilyVariant } from "../../modelFamily/types";
import type { SourceSighting } from "../../taxonomy/types";
import {
  MODEL_FAMILY_SHARD_MAX_BYTES,
  loadModelFamilies,
  shardFileName,
  type ModelFamilyDatasetManifest,
} from "../../modelFamily/dataset";
import { buildBrandRegistryFromUniverseData } from "../../registry/build/buildBrandRegistry";
import type { BrandProbeCacheFile } from "../../registry/build/types";
import type { BrandUniverseEntry, BrandUniverseFile } from "../../registry/build/types";
import { validateBrandUniverseEntries } from "../../registry/build/validateBrandUniverse";
import { familiesMissingFromDelivery } from "./deliveryLink";
import { decideLastGoodPublish } from "./lastGood";
import { classifyOfficialFootwear, isNonFootwearCatalogItem, legacyCategoryForPrimary } from "./primaryCategory";
import type { WaveCatalog, WaveModelFamily, WaveRunReport } from "./types";

export const WAVE_REPORT_PATH = "data/registry/brand-wave-50-report.json";
export const WAVE_UNAVAILABLE_PATH = "data/registry/brand-wave-50-source-unavailable.json";
export const WAVE_ADAPTER_QUEUE_PATH = "data/registry/brand-wave-50-custom-adapter.json";
export const WAVE_LAST_GOOD_DIR = "data/brands/wave50/last-good";
export const WAVE_STAGING_DIR = "data/onboarding/staging";

export async function readJsonFile<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

export async function atomicWriteText(path: string, body: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, body, "utf-8");
  await rename(tmp, path);
}

export async function atomicWriteJson(path: string, value: unknown): Promise<void> {
  await atomicWriteText(path, JSON.stringify(value, null, 2));
}

export async function stageCatalog(root: string, catalog: WaveCatalog): Promise<void> {
  await atomicWriteJson(join(root, WAVE_STAGING_DIR, catalog.slug, "catalog.json"), catalog);
}

export async function publishLastGoodCatalog(
  root: string,
  catalog: WaveCatalog | null,
): Promise<{
  published: boolean;
  retained: boolean;
  changed: boolean;
  blocker: string | null;
  addedProducts: number;
}> {
  if (!catalog) {
    return { published: false, retained: false, changed: false, blocker: "EMPTY_OR_FAILED_COLLECT", addedProducts: 0 };
  }
  const target = join(root, WAVE_LAST_GOOD_DIR, `${catalog.slug}.json`);
  const previous = await readJsonFile<WaveCatalog | null>(target, null);
  const decision = decideLastGoodPublish({
    previousCollected: previous?.coverage.collected ?? null,
    candidate: catalog,
    coverage: catalog.coverage,
    referenceFootwearTotal: catalog.referenceFootwearTotal,
    referenceNewArrivals: catalog.referenceNewArrivals,
    newArrivalsFootwear: catalog.newArrivalsFootwear,
  });
  if (!decision.publish) {
    return {
      published: false,
      retained: decision.retainPrevious,
      changed: false,
      blocker: decision.blocker,
      addedProducts: 0,
    };
  }
  if (previous && sameCatalogPayload(previous, catalog)) {
    return { published: true, retained: true, changed: false, blocker: null, addedProducts: 0 };
  }
  await atomicWriteJson(target, catalog);
  return {
    published: true,
    retained: false,
    changed: true,
    blocker: null,
    addedProducts: catalog.productUrls.length,
  };
}

function catalogPayload(catalog: WaveCatalog): string {
  const { snapshotId: _snapshotId, collectedAt: _collectedAt, ...stable } = catalog;
  return JSON.stringify(stable);
}

export function sameCatalogPayload(left: WaveCatalog, right: WaveCatalog): boolean {
  return catalogPayload(left) === catalogPayload(right);
}

function legacyToPrimary(category: WaveModelFamily["category"]): ReturnType<typeof assignPrimaryCategory>["primaryCategory"] {
  switch (category) {
    case "BOOT":
    case "ANKLE_BOOT":
      return "BOOT";
    case "SNEAKER":
      return "SNEAKER";
    case "SANDAL":
    case "THONG":
    case "WEDGE":
      return "SANDAL";
    case "MULE":
      return "MULE";
    case "LOAFER":
      return "LOAFER";
    case "PUMP":
    case "SLINGBACK":
      return "PUMP";
    case "BALLERINA":
    case "MARY_JANE":
      return "BALLET_FLAT";
    default:
      return "UNCLASSIFIED";
  }
}

export function waveFamiliesToModelFamilies(catalog: WaveCatalog): ModelFamily[] {
  return catalog.families.flatMap((family) => {
    const colorways = family.variants.filter((variant) => !isNonFootwearCatalogItem({ title: variant.title }));
    if (colorways.length === 0) return [];
    const evidenceText = colorways.find((variant) => variant.isNew)?.newnessEvidence ?? null;
    const newness = family.isNew && (evidenceText === "NEW_ARRIVALS_COLLECTION" || evidenceText === "SOURCE_BADGE")
      ? {
          status: "VERIFIED_NEW" as const,
          evidenceType: evidenceText,
          firstVerifiedAt: catalog.collectedAt,
          lastVerifiedAt: catalog.collectedAt,
          effectiveNewAt: catalog.collectedAt,
          evidenceUrl: colorways.find((variant) => variant.isNew)?.productUrl ?? null,
          evidenceText: evidenceText === "SOURCE_BADGE" ? "Resmi kaynak NEW etiketi" : "Resmi New Arrivals koleksiyonu",
          confidence: 0.9,
        }
      : createNotVerifiedNewness();
    const productType = colorways[0]?.productType ?? "";
    const primary = assignPrimaryCategory({
      productName: family.canonicalName,
      legacyCategory: family.category,
      sourceCategoryText: productType || family.category,
    });
    const official = classifyOfficialFootwear({
      title: family.canonicalName,
      productType,
    });
    const primaryCategory = primary.primaryCategory !== "UNCLASSIFIED"
      ? primary.primaryCategory
      : official ?? legacyToPrimary(family.category);
    const legacyCategory = family.category === "OTHER_FOOTWEAR" && primaryCategory !== "UNCLASSIFIED"
      ? legacyCategoryForPrimary(primaryCategory)
      : family.category;
    const sighting: SourceSighting = {
      sourceId: catalog.slug,
      sourceLabel: catalog.brand,
      sourceKind: "BRAND_OFFICIAL",
      firstSeenAt: catalog.collectedAt,
      lastSeenAt: catalog.collectedAt,
      newness,
      sourceCategories: colorways[0]
        ? [{
            categoryId: colorways[0].productType.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "footwear",
            categoryName: colorways[0].productType || family.category,
          }]
        : [],
    };
    const variants: ModelFamilyVariant[] = colorways.map((variant) => ({
      productId: variant.productUrl,
      title: variant.title,
      url: variant.productUrl,
      color: variant.color,
      material: null,
      images: variant.images,
      sku: variant.sku ?? undefined,
    }));
    return [{
      modelFamilyId: family.modelFamilyId,
      brand: catalog.brand,
      canonicalName: family.canonicalName,
      category: legacyCategory,
      primaryCategory,
      hybridInfluences: primary.hybridInfluences,
      representativeProductId: variants[0]?.productId ?? family.modelFamilyId,
      representativeImage: family.images[0] ?? null,
      representativeImages: family.images,
      variantCount: variants.length,
      variants,
      allImages: family.images,
      sourceProductIds: variants.map((variant) => variant.productId),
      groupingConfidence: family.groupingReason === "single-product" ? "HIGH" : "HIGH",
      groupingReason: family.groupingReason,
      modelFamilyFirstSeenAt: catalog.collectedAt,
      sourceSightings: [sighting],
    }];
  });
}

export async function appendPassedFamilies(root: string, catalogs: readonly WaveCatalog[]): Promise<number> {
  if (catalogs.length === 0) return 0;
  const rootDir = join(root, "data/multibrand");
  const existing = await loadModelFamilies({ rootDir });
  const additions = familiesMissingFromDelivery(
    existing,
    catalogs.flatMap((catalog) => waveFamiliesToModelFamilies(catalog)),
  );
  if (additions.length === 0) return 0;

  const dir = join(rootDir, "model-families");
  const manifestPath = join(dir, "manifest.json");
  const manifest = await readJsonFile<ModelFamilyDatasetManifest | null>(manifestPath, null);
  if (!manifest) return 0;

  const chunks: ModelFamily[][] = [];
  let current: ModelFamily[] = [];
  let currentBytes = 2;
  for (const family of additions) {
    const encoded = JSON.stringify(family);
    const extra = (current.length === 0 ? 0 : 1) + encoded.length;
    if (current.length > 0 && currentBytes + extra > 16 * 1024 * 1024) {
      chunks.push(current);
      current = [family];
      currentBytes = 2 + encoded.length;
      continue;
    }
    current.push(family);
    currentBytes += extra;
  }
  if (current.length > 0) chunks.push(current);

  let index = manifest.shards.length;
  for (const chunk of chunks) {
    const file = shardFileName(index);
    const body = JSON.stringify(chunk);
    const bytes = Buffer.byteLength(body, "utf8");
    if (bytes > MODEL_FAMILY_SHARD_MAX_BYTES) {
      throw new Error(`Wave family shard ${file} exceeds ${MODEL_FAMILY_SHARD_MAX_BYTES} bytes`);
    }
    await atomicWriteText(join(dir, file), body);
    manifest.shards.push({ file, familyCount: chunk.length, bytes: Buffer.byteLength(body, "utf8") });
    index += 1;
  }
  manifest.generatedAt = catalogs[0]?.collectedAt ?? new Date().toISOString();
  manifest.totalFamilies = existing.length + additions.length;
  manifest.shardCount = manifest.shards.length;
  await atomicWriteJson(manifestPath, manifest);
  return additions.length;
}

function preservePriorVerifiedPaths(
  previous: BrandUniverseEntry | undefined,
): previous is BrandUniverseEntry {
  return Boolean(
    previous &&
      previous.collectionDiscoveryStatus === "VERIFIED" &&
      previous.collectionUrl &&
      previous.collectionPaths.length > 0 &&
      (previous.footwearCollectionUrls?.length ?? 0) > 0 &&
      (previous.footwearCollectionHandles?.length ?? 0) > 0 &&
      !(previous.discoverySources ?? []).includes("wave50"),
  );
}

function universeEntryForCatalog(catalog: WaveCatalog, previous: BrandUniverseEntry | undefined): BrandUniverseEntry {
  const handles = catalog.catalogPaths.map((path) => path.replace(/^\/collections\//, ""));
  const base = catalog.officialUrl.replace(/\/$/, "");
  return {
    id: catalog.slug,
    brand: catalog.brand,
    officialUrl: catalog.officialUrl,
    country: previous?.country || (catalog.slug === "naked-wolfe" ? "Avustralya" : "UNCLASSIFIED"),
    segment: previous?.segment ?? "UNCLASSIFIED",
    influenceRole: previous?.influenceRole ?? "UNCLASSIFIED",
    trackingPriority: previous?.trackingPriority ?? "P2",
    isActive: true,
    collectorType: "SHOPIFY_PUBLIC",
    collectionStatus: "READY_AUTOMATIC",
    footwearFocus: "WOMENS_FOOTWEAR",
    womenFootwearRelevant: true,
    sourceType: previous?.sourceType ?? "BRAND",
    notes: `Wave 50 full official women's footwear. source_total=${catalog.coverage.sourceTotal} coverage=${catalog.coverage.coverage}`,
    footwearInfluence: previous?.footwearInfluence ?? 0,
    directionalInfluence: previous?.directionalInfluence ?? 0,
    commercialInfluence: previous?.commercialInfluence ?? 0,
    collectionUrl: preservePriorVerifiedPaths(previous)
      ? previous.collectionUrl
      : `${base}${catalog.catalogPaths[0] ?? ""}`,
    collectionPaths: preservePriorVerifiedPaths(previous)
      ? previous.collectionPaths
      : catalog.catalogPaths,
    footwearCollectionUrls: preservePriorVerifiedPaths(previous)
      ? previous.footwearCollectionUrls
      : catalog.catalogPaths.map((path) => `${base}${path}`),
    footwearCollectionHandles: preservePriorVerifiedPaths(previous)
      ? previous.footwearCollectionHandles
      : handles,
    collectionDiscoveryStatus: "VERIFIED",
    productLimit: Math.max(
      catalog.coverage.collected,
      previous && !(previous.discoverySources ?? []).includes("wave50") ? previous.productLimit : 0,
    ),
    backfillLimit: Math.max(
      catalog.coverage.collected,
      previous && !(previous.discoverySources ?? []).includes("wave50") ? (previous.backfillLimit ?? 0) : 0,
    ),
    supportsMultipleImages: true,
    preferPilotCache: previous?.preferPilotCache,
    discoverySources: [...new Set([...(previous?.discoverySources ?? []), "wave50"])],
    classificationStatus: previous?.classificationStatus ?? "UNREVIEWED",
    radarEligible: previous?.radarEligible ?? false,
  };
}

export async function applyPassedBrandsToUniverse(
  root: string,
  catalogs: readonly WaveCatalog[],
): Promise<{ updated: number; brandsTs: string | null; errors: string[] }> {
  if (catalogs.length === 0) return { updated: 0, brandsTs: null, errors: [] };
  const universePath = join(root, "data/registry/brand-universe.json");
  const universe = await readJsonFile<BrandUniverseFile>(universePath, { version: 1, brands: [] });
  const byId = new Map(universe.brands.map((entry) => [entry.id, entry]));
  for (const catalog of catalogs) {
    byId.set(catalog.slug, universeEntryForCatalog(catalog, byId.get(catalog.slug)));
  }
  const brands = [...byId.values()];
  const issues = validateBrandUniverseEntries(brands).filter((issue) => issue.level === "error");
  if (issues.length > 0) {
    return { updated: 0, brandsTs: null, errors: issues.map((issue) => issue.message) };
  }
  universe.brands = brands;
  universe.generatedAt = new Date().toISOString();
  await atomicWriteJson(universePath, universe);
  const probeCache = await readJsonFile<BrandProbeCacheFile>(
    join(root, "data/registry/brand-probe-cache.json"),
    { version: 1, updatedAt: new Date().toISOString(), entries: {} },
  );
  const built = buildBrandRegistryFromUniverseData({
    universeFile: universe,
    probeCache,
  });
  if (!built.ok || !built.brandsTsContent) {
    return { updated: catalogs.length, brandsTs: null, errors: built.report.validationErrors };
  }
  await atomicWriteJson(join(root, "data/registry/brand-universe-report.json"), built.report);
  const brandsTsPath = join(root, "src/registry/data/brands.ts");
  await writeFile(brandsTsPath, built.brandsTsContent, "utf-8");
  return { updated: catalogs.length, brandsTs: brandsTsPath, errors: [] };
}

export async function writeWaveReport(root: string, report: WaveRunReport): Promise<void> {
  await atomicWriteJson(join(root, WAVE_REPORT_PATH), report);
  await atomicWriteJson(
    join(root, WAVE_UNAVAILABLE_PATH),
    {
      version: 1,
      generatedAt: report.generatedAt,
      queue: "SOURCE_UNAVAILABLE",
      entries: report.outcomes.filter((outcome) => outcome.disposition === "SOURCE_UNAVAILABLE"),
    },
  );
  await atomicWriteJson(
    join(root, WAVE_ADAPTER_QUEUE_PATH),
    {
      version: 1,
      generatedAt: report.generatedAt,
      queue: "CUSTOM_ADAPTER_REQUIRED",
      entries: report.outcomes.filter((outcome) => outcome.disposition === "CUSTOM_ADAPTER_REQUIRED"),
    },
  );
}

export { shardFileName };
