import { unlink } from "node:fs/promises";
import { join } from "node:path";

import {
  MODEL_FAMILY_BRAND_SHARD_PREFIX,
  MODEL_FAMILY_SHARD_MAX_BYTES,
  loadModelFamilies,
  sortModelFamiliesForPersistence,
  writeModelFamilies,
  type ModelFamilyDatasetManifest,
} from "../../modelFamily/dataset";
import type { ModelFamily, ModelFamilyVariant } from "../../modelFamily/types";
import {
  atomicWriteJson,
  atomicWriteText,
  readJsonFile,
  waveFamiliesToModelFamilies,
} from "../wave50/publish";
import { omitNonFootwearFamilies, reclassifyWaveFamily } from "../wave50/deliveryLink";
import { mapPool } from "../wave50/pool";
import type { WaveCatalog, WaveHttp } from "../wave50/types";

export interface PreparedBrandDelivery {
  families: ModelFamily[];
  unresolved: ModelFamily[];
}

export interface BrandDeliveryReplacement {
  slug: string;
  brand: string;
  officialUrl: string;
  families: readonly ModelFamily[];
}

function productJsonUrl(productUrl: string): string | null {
  try {
    const parsed = new URL(productUrl);
    const handle = parsed.pathname.split("/products/")[1]?.split("/")[0];
    return handle ? `${parsed.origin}/products/${handle}.json` : null;
  } catch {
    return null;
  }
}

function urlKey(value: string): string {
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

function urlOrigin(value: string): string | null {
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return null;
  }
}

async function productCopy(
  http: WaveHttp,
  productUrl: string,
): Promise<{ description: string | null; tags: string | null }> {
  const url = productJsonUrl(productUrl);
  if (!url) return { description: null, tags: null };
  const response = await http.fetch(url);
  if (!response.ok || !response.data || typeof response.data !== "object") {
    return { description: null, tags: null };
  }
  const body = response.data as { product?: { body_html?: string; tags?: string | string[] } };
  const tags = body.product?.tags;
  return {
    description: (body.product?.body_html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || null,
    tags: Array.isArray(tags) ? tags.join(", ") : (tags ?? null),
  };
}

async function classifyFamily(http: WaveHttp, family: ModelFamily): Promise<ModelFamily> {
  if ((family.primaryCategory ?? "UNCLASSIFIED") !== "UNCLASSIFIED") return family;
  let current = family;
  for (const variant of family.variants.slice(0, 3)) {
    if (!variant.url) continue;
    current = reclassifyWaveFamily(current, await productCopy(http, variant.url));
    if ((current.primaryCategory ?? "UNCLASSIFIED") !== "UNCLASSIFIED") return current;
  }
  return current;
}

export async function prepareBrandDelivery(input: {
  catalog: WaveCatalog;
  http: WaveHttp;
}): Promise<PreparedBrandDelivery> {
  const incoming = omitNonFootwearFamilies(waveFamiliesToModelFamilies(input.catalog));
  const families = await mapPool(incoming, 8, async (family) => classifyFamily(input.http, family));
  const unresolved = families.filter(
    (family) => (family.primaryCategory ?? "UNCLASSIFIED") === "UNCLASSIFIED",
  );
  return { families, unresolved };
}

function imagesOf(variants: readonly ModelFamilyVariant[]): string[] {
  const seen = new Set<string>();
  const images: string[] = [];
  for (const variant of variants) {
    for (const image of variant.images) {
      const value = image.trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      images.push(value);
    }
  }
  return images;
}

function uniqueVariants(variants: readonly ModelFamilyVariant[]): ModelFamilyVariant[] {
  const seen = new Set<string>();
  const result: ModelFamilyVariant[] = [];
  for (const variant of variants) {
    const key = urlKey(variant.url || variant.productId);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(variant);
  }
  return result;
}

function rebuildFamily(
  base: ModelFamily,
  variants: ModelFamilyVariant[],
  sightings: NonNullable<ModelFamily["sourceSightings"]>,
): ModelFamily {
  const images = imagesOf(variants);
  return {
    ...base,
    variants,
    variantCount: variants.length,
    sourceProductIds: variants.map((variant) => variant.productId),
    representativeProductId: variants[0]?.productId ?? base.modelFamilyId,
    representativeImage: images[0] ?? null,
    representativeImages: images,
    allImages: images,
    sourceSightings: sightings,
  };
}

function officialOrigins(delivery: BrandDeliveryReplacement): Set<string> {
  const origins = new Set<string>();
  const official = urlOrigin(delivery.officialUrl);
  if (official) origins.add(official);
  for (const family of delivery.families) {
    for (const variant of family.variants) {
      const origin = urlOrigin(variant.url);
      if (origin) origins.add(origin);
    }
  }
  return origins;
}

function isOfficialSighting(
  sighting: NonNullable<ModelFamily["sourceSightings"]>[number],
  slug: string,
): boolean {
  return sighting.sourceKind === "BRAND_OFFICIAL" && sighting.sourceId === slug;
}

function stripOfficialSource(
  family: ModelFamily,
  slug: string,
  origins: ReadonlySet<string>,
): ModelFamily | null {
  const sightings = (family.sourceSightings ?? []).filter((sighting) => !isOfficialSighting(sighting, slug));
  const variants = family.variants.filter((variant) => {
    const origin = urlOrigin(variant.url);
    return !origin || !origins.has(origin);
  });
  if (variants.length === 0 || sightings.length === 0) return null;
  const sourceCategoryRefs = family.sourceCategoryRefs?.filter((ref) => ref.sourceId !== slug);
  return {
    ...rebuildFamily(family, variants, sightings),
    sourceCategoryRefs,
  };
}

function mergeOfficialReplacement(
  previous: readonly ModelFamily[],
  fresh: ModelFamily,
  slug: string,
  origins: ReadonlySet<string>,
): ModelFamily {
  const marketplaceVariants = previous.flatMap((family) =>
    family.variants.filter((variant) => {
      const origin = urlOrigin(variant.url);
      return !origin || !origins.has(origin);
    }),
  );
  const variants = uniqueVariants([...fresh.variants, ...marketplaceVariants]);
  const preservedSightings = previous.flatMap((family) =>
    (family.sourceSightings ?? []).filter((sighting) => !isOfficialSighting(sighting, slug)),
  );
  const freshSightings = fresh.sourceSightings ?? [];
  const sightings = [...preservedSightings, ...freshSightings].filter((sighting, index, all) =>
    all.findIndex((candidate) =>
      candidate.sourceId === sighting.sourceId && candidate.sourceKind === sighting.sourceKind,
    ) === index,
  );
  const preservedRefs = previous.flatMap((family) =>
    (family.sourceCategoryRefs ?? []).filter((ref) => ref.sourceId !== slug),
  );
  const freshRefs = fresh.sourceCategoryRefs ?? [];
  const sourceCategoryRefs = [...preservedRefs, ...freshRefs].filter((ref, index, all) =>
    all.findIndex((candidate) => candidate.sourceId === ref.sourceId && candidate.categoryId === ref.categoryId) === index,
  );
  const firstSeen = previous
    .map((family) => family.modelFamilyFirstSeenAt)
    .filter((value): value is string => Boolean(value))
    .sort()[0];
  return {
    ...rebuildFamily(fresh, variants, sightings),
    sourceCategoryRefs,
    modelFamilyFirstSeenAt: firstSeen ?? fresh.modelFamilyFirstSeenAt,
  };
}

/**
 * Replaces one official source without creating a second card. Marketplace
 * sightings and different-origin marketplace variants stay on the same ID.
 */
export function applySourceAwareBrandReplacement(
  existing: readonly ModelFamily[],
  delivery: BrandDeliveryReplacement,
): { core: ModelFamily[]; brandShard: ModelFamily[] } {
  const brandKey = delivery.brand.trim().toUpperCase();
  const origins = officialOrigins(delivery);
  const replacementIds = new Set(delivery.families.map((family) => family.modelFamilyId));
  const buckets = new Map<string, ModelFamily[]>();
  const core: ModelFamily[] = [];

  for (const family of existing) {
    const sameBrand = family.brand.trim().toUpperCase() === brandKey;
    const hasOfficial = family.sourceSightings?.some((sighting) => isOfficialSighting(sighting, delivery.slug)) ?? false;
    if (sameBrand && (hasOfficial || replacementIds.has(family.modelFamilyId))) {
      const bucket = buckets.get(family.modelFamilyId) ?? [];
      bucket.push(family);
      buckets.set(family.modelFamilyId, bucket);
    } else {
      core.push(family);
    }
  }

  const brandShard = delivery.families.map((fresh) => {
    const previous = buckets.get(fresh.modelFamilyId) ?? [];
    buckets.delete(fresh.modelFamilyId);
    return mergeOfficialReplacement(previous, fresh, delivery.slug, origins);
  });

  for (const stale of buckets.values()) {
    for (const family of stale) {
      const residual = stripOfficialSource(family, delivery.slug, origins);
      if (residual) core.push(residual);
    }
  }
  return { core, brandShard };
}

export async function replaceAutomationBrandDeliveries(input: {
  root: string;
  deliveries: readonly BrandDeliveryReplacement[];
  generatedAt: string;
}): Promise<number> {
  if (input.deliveries.length === 0) return 0;
  const rootDir = join(input.root, "data/multibrand");
  let core = await loadModelFamilies({ rootDir });
  const dir = join(rootDir, "model-families");
  const manifestPath = join(dir, "manifest.json");
  const manifest = await readJsonFile<ModelFamilyDatasetManifest | null>(manifestPath, null);
  if (!manifest) throw new Error("Model-family shard manifest is required for brand automation.");

  const acceptedSlugs = new Set(input.deliveries.map((delivery) => delivery.slug));
  const oldAcceptedShards = manifest.shards.filter((shard) =>
    acceptedSlugs.has(shard.file.replace(MODEL_FAMILY_BRAND_SHARD_PREFIX, "").replace(/\.json$/, "")) &&
    shard.file.startsWith(MODEL_FAMILY_BRAND_SHARD_PREFIX),
  );
  manifest.shards = manifest.shards.filter((shard) => !oldAcceptedShards.includes(shard));
  manifest.shardCount = manifest.shards.length;
  manifest.totalFamilies = manifest.shards.reduce((sum, shard) => sum + shard.familyCount, 0);
  await atomicWriteJson(manifestPath, manifest);
  for (const shard of oldAcceptedShards) await unlink(join(dir, shard.file)).catch(() => undefined);

  const brandShards = new Map<string, ModelFamily[]>();
  for (const delivery of [...input.deliveries].sort((a, b) => a.slug.localeCompare(b.slug, "en"))) {
    const replaced = applySourceAwareBrandReplacement(core, delivery);
    core = replaced.core;
    brandShards.set(delivery.slug, replaced.brandShard);
  }

  const nextManifest = await writeModelFamilies(core, { rootDir, generatedAt: input.generatedAt });
  let replacedCount = 0;
  for (const [slug, sourceFamilies] of brandShards) {
    const families = sortModelFamiliesForPersistence(sourceFamilies);
    const file = `${MODEL_FAMILY_BRAND_SHARD_PREFIX}${slug}.json`;
    const body = JSON.stringify(families);
    const bytes = Buffer.byteLength(body, "utf8");
    if (bytes > MODEL_FAMILY_SHARD_MAX_BYTES) {
      throw new Error(`Brand automation shard ${file} exceeds ${MODEL_FAMILY_SHARD_MAX_BYTES} bytes.`);
    }
    await atomicWriteText(join(dir, file), body);
    nextManifest.shards = nextManifest.shards.filter((shard) => shard.file !== file);
    nextManifest.shards.push({ file, familyCount: families.length, bytes });
    replacedCount += families.length;
  }

  nextManifest.shards.sort((a, b) => a.file.localeCompare(b.file, "en"));
  nextManifest.generatedAt = input.generatedAt;
  nextManifest.totalFamilies = nextManifest.shards.reduce((sum, shard) => sum + shard.familyCount, 0);
  nextManifest.shardCount = nextManifest.shards.length;
  const ids = new Set<string>();
  for (const family of await loadFamiliesFromManifest(dir, nextManifest)) {
    if (ids.has(family.modelFamilyId)) {
      throw new Error(`Duplicate modelFamilyId after brand replacement: ${family.modelFamilyId}`);
    }
    ids.add(family.modelFamilyId);
  }
  await atomicWriteJson(manifestPath, nextManifest);
  return replacedCount;
}

async function loadFamiliesFromManifest(
  dir: string,
  manifest: ModelFamilyDatasetManifest,
): Promise<ModelFamily[]> {
  const families: ModelFamily[] = [];
  for (const shard of manifest.shards) {
    families.push(...await readJsonFile<ModelFamily[]>(join(dir, shard.file), []));
  }
  return families;
}
