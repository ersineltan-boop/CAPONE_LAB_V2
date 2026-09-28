import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ModelFamily } from "./types";

export const MODEL_FAMILY_SHARD_SCHEMA = "capone.model-families.shards.v1";
export const MODEL_FAMILY_SHARD_VERSION = 1;
export const MODEL_FAMILY_SHARD_TARGET_BYTES = 16 * 1024 * 1024;
export const MODEL_FAMILY_SHARD_MAX_BYTES = 20 * 1024 * 1024;

export const MODEL_FAMILY_DATASET_DIR_REPO = "data/multibrand/model-families";
export const MODEL_FAMILY_MONOLITH_REPO = "data/multibrand/model-families.json";
export const MODEL_FAMILY_BRAND_SHARD_PREFIX = "brands/";

const DEFAULT_MULTIBRAND_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "data",
  "multibrand",
);

export interface ModelFamilyShardInfo {
  file: string;
  familyCount: number;
  bytes: number;
}

export interface ModelFamilyDatasetManifest {
  schema: typeof MODEL_FAMILY_SHARD_SCHEMA;
  version: typeof MODEL_FAMILY_SHARD_VERSION;
  generatedAt: string;
  totalFamilies: number;
  shardCount: number;
  shards: ModelFamilyShardInfo[];
}

export interface ModelFamilyDatasetOptions {
  rootDir?: string;
  allowMonolithFallback?: boolean;
  authoritativeMarketplaceSources?: ReadonlyArray<{
    sourceId: string;
    origin: string;
  }>;
}

export function resolveModelFamilyDatasetDir(rootDir = DEFAULT_MULTIBRAND_DIR): string {
  return join(rootDir, "model-families");
}

export function resolveModelFamilyMonolithPath(rootDir = DEFAULT_MULTIBRAND_DIR): string {
  return join(rootDir, "model-families.json");
}

export function shardFileName(index: number): string {
  return `part-${String(index).padStart(3, "0")}.json`;
}

export function isTrackedModelFamilyDatasetPath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/").replace(/^\.\//, "");
  if (normalized === MODEL_FAMILY_MONOLITH_REPO) return false;
  if (normalized === `${MODEL_FAMILY_DATASET_DIR_REPO}/manifest.json`) return true;
  if (/^data\/multibrand\/model-families\/marketplaces\/[a-z0-9-]+\.json$/.test(normalized)) return true;
  if (/^data\/multibrand\/model-families\/brands\/[a-z0-9-]+\.json$/.test(normalized)) return true;
  return /^data\/multibrand\/model-families\/part-\d{3}\.json$/.test(normalized);
}

export function sortModelFamiliesForPersistence(
  families: readonly ModelFamily[],
): ModelFamily[] {
  return [...families].sort((a, b) =>
    a.modelFamilyId.localeCompare(b.modelFamilyId, "en"),
  );
}

export function splitModelFamiliesIntoShards(
  families: readonly ModelFamily[],
  targetBytes = MODEL_FAMILY_SHARD_TARGET_BYTES,
): ModelFamily[][] {
  const sorted = sortModelFamiliesForPersistence(families);
  if (sorted.length === 0) return [];

  const shards: ModelFamily[][] = [];
  let current: ModelFamily[] = [];
  let currentBytes = 2;

  for (const family of sorted) {
    const encoded = JSON.stringify(family);
    const extra = (current.length === 0 ? 0 : 1) + encoded.length;
    if (current.length > 0 && currentBytes + extra > targetBytes) {
      shards.push(current);
      current = [family];
      currentBytes = 2 + encoded.length;
      continue;
    }
    current.push(family);
    currentBytes += extra;
  }
  if (current.length > 0) shards.push(current);
  return shards;
}

function variantUrlKey(value: string): string {
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

function variantUrlOrigin(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * A brand shard owns the one-card identity. When a later marketplace rebuild
 * emits the same ID, replace the marketplace origins/sightings represented by
 * that incoming family while retaining the official brand evidence.
 */
export function mergeCoreFamilyIntoBrandShard(
  preserved: ModelFamily,
  incoming: ModelFamily,
): ModelFamily {
  const officialOrigins = new Set(
    [variantUrlOrigin(preserved.representativeProductId)].filter(
      (origin): origin is string => origin !== null,
    ),
  );
  const incomingMarketplaceSightings = (incoming.sourceSightings ?? []).filter(
    (sighting) => sighting.sourceKind === "LUXURY_MARKETPLACE",
  );
  const incomingMarketplaceSources = new Set(
    incomingMarketplaceSightings.map((sighting) => sighting.sourceId),
  );
  const incomingMarketplaceVariants = incomingMarketplaceSightings.length === 0
    ? []
    : incoming.variants.filter((variant) => {
        const origin = variantUrlOrigin(variant.url);
        return origin === null || !officialOrigins.has(origin);
      });
  const incomingOrigins = new Set(
    incomingMarketplaceVariants
      .map((variant) => variantUrlOrigin(variant.url))
      .filter((origin): origin is string => origin !== null),
  );
  const retainedVariants = preserved.variants.filter((variant) => {
    const origin = variantUrlOrigin(variant.url);
    return origin === null || !incomingOrigins.has(origin);
  });
  const variantsByUrl = new Map(
    retainedVariants.map((variant) => [variantUrlKey(variant.url), variant]),
  );
  for (const variant of incomingMarketplaceVariants) {
    variantsByUrl.set(variantUrlKey(variant.url), variant);
  }
  const variants = [...variantsByUrl.values()];

  const incomingSightingKeys = new Set(
    incomingMarketplaceSightings.map(
      (sighting) => `${sighting.sourceKind ?? ""}:${sighting.sourceId}`,
    ),
  );
  const sourceSightings = [
    ...(preserved.sourceSightings ?? []).filter(
      (sighting) =>
        !incomingSightingKeys.has(`${sighting.sourceKind ?? ""}:${sighting.sourceId}`),
    ),
    ...incomingMarketplaceSightings,
  ];
  const incomingMarketplaceRefs = (incoming.sourceCategoryRefs ?? []).filter((ref) =>
    incomingMarketplaceSources.has(ref.sourceId),
  );
  const incomingRefSources = new Set(incomingMarketplaceRefs.map((ref) => ref.sourceId));
  const sourceCategoryRefs = [
    ...(preserved.sourceCategoryRefs ?? []).filter(
      (ref) => !incomingRefSources.has(ref.sourceId),
    ),
    ...incomingMarketplaceRefs,
  ];
  const allImages = [
    ...new Set(variants.flatMap((variant) => variant.images).filter(Boolean)),
  ];
  const firstSeenAt = [preserved.modelFamilyFirstSeenAt, incoming.modelFamilyFirstSeenAt]
    .filter((value): value is string => Boolean(value))
    .sort()[0];

  return {
    ...preserved,
    modelFamilyFirstSeenAt: firstSeenAt,
    sourceSightings,
    sourceCategoryRefs: sourceCategoryRefs.length > 0 ? sourceCategoryRefs : undefined,
    variantCount: variants.length,
    variants,
    allImages,
    sourceProductIds: [...new Set(variants.map((variant) => variant.productId))],
  };
}

function pruneAuthoritativeMarketplaceEvidence(
  family: ModelFamily,
  sources: NonNullable<ModelFamilyDatasetOptions["authoritativeMarketplaceSources"]>,
): ModelFamily {
  if (sources.length === 0) return family;
  const sourceIds = new Set(sources.map((source) => source.sourceId));
  const origins = new Set(
    sources
      .map((source) => variantUrlOrigin(source.origin))
      .filter((origin): origin is string => origin !== null),
  );
  const variants = family.variants.filter((variant) => {
    const origin = variantUrlOrigin(variant.url);
    return origin === null || !origins.has(origin);
  });
  const sourceSightings = (family.sourceSightings ?? []).filter(
    (sighting) =>
      sighting.sourceKind !== "LUXURY_MARKETPLACE" || !sourceIds.has(sighting.sourceId),
  );
  const sourceCategoryRefs = (family.sourceCategoryRefs ?? []).filter(
    (ref) => !sourceIds.has(ref.sourceId),
  );
  if (
    variants.length === family.variants.length &&
    sourceSightings.length === (family.sourceSightings ?? []).length &&
    sourceCategoryRefs.length === (family.sourceCategoryRefs ?? []).length
  ) {
    return family;
  }
  if (variants.length === 0) {
    throw new Error(
      `Authoritative marketplace prune removed every variant from brand-owned family ${family.modelFamilyId}`,
    );
  }
  const allImages = [
    ...new Set(variants.flatMap((variant) => variant.images).filter(Boolean)),
  ];
  const representative = variants.find(
    (variant) => variant.productId === family.representativeProductId,
  ) ?? variants[0]!;
  return {
    ...family,
    representativeProductId: representative.productId,
    representativeImage: representative.images[0] ?? null,
    representativeImages: allImages,
    variantCount: variants.length,
    variants,
    allImages,
    sourceProductIds: [...new Set(variants.map((variant) => variant.productId))],
    sourceSightings,
    sourceCategoryRefs: sourceCategoryRefs.length > 0 ? sourceCategoryRefs : undefined,
  };
}

async function writeWithRetry(path: string, body: string): Promise<void> {
  const tmp = `${path}.${process.pid}.tmp`;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      await writeFile(tmp, body, "utf-8");
      try {
        await unlink(path);
      } catch {
        // ignore missing destination
      }
      await rename(tmp, path);
      return;
    } catch (error) {
      try {
        await unlink(tmp);
      } catch {
        // ignore
      }
      if (attempt === 11) throw error;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
}

async function readJsonFile<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf-8")) as T;
}

export async function loadModelFamilies(
  options: ModelFamilyDatasetOptions = {},
): Promise<ModelFamily[]> {
  const rootDir = options.rootDir ?? DEFAULT_MULTIBRAND_DIR;
  const allowMonolithFallback = options.allowMonolithFallback ?? true;
  const dir = resolveModelFamilyDatasetDir(rootDir);
  const manifestPath = join(dir, "manifest.json");

  try {
    const manifest = await readJsonFile<ModelFamilyDatasetManifest>(manifestPath);
    const families: ModelFamily[] = [];
    for (const shard of manifest.shards) {
      const part = await readJsonFile<ModelFamily[]>(join(dir, shard.file));
      families.push(...part);
    }
    return families;
  } catch {
    if (!allowMonolithFallback) return [];
  }

  try {
    return await readJsonFile<ModelFamily[]>(resolveModelFamilyMonolithPath(rootDir));
  } catch {
    return [];
  }
}

export async function writeModelFamilies(
  families: readonly ModelFamily[],
  options: ModelFamilyDatasetOptions & { generatedAt?: string } = {},
): Promise<ModelFamilyDatasetManifest> {
  const rootDir = options.rootDir ?? DEFAULT_MULTIBRAND_DIR;
  const dir = resolveModelFamilyDatasetDir(rootDir);
  await mkdir(dir, { recursive: true });

  const previousManifest = await readJsonFile<ModelFamilyDatasetManifest>(join(dir, "manifest.json")).catch(
    () => null,
  );
  const previousBrandShards = (previousManifest?.shards ?? []).filter((shard) =>
    shard.file.startsWith(MODEL_FAMILY_BRAND_SHARD_PREFIX),
  );
  const incomingById = new Map(families.map((family) => [family.modelFamilyId, family]));
  const authoritativeMarketplaceSources = options.authoritativeMarketplaceSources ?? [];
  const preservedBrandFamilyIds = new Set<string>();
  const preservedBrandShards: ModelFamilyShardInfo[] = [];
  const pendingBrandWrites = new Map<string, string>();
  for (const shard of previousBrandShards) {
    const stored = await readJsonFile<ModelFamily[]>(join(dir, shard.file));
    if (stored.length !== shard.familyCount) {
      throw new Error(
        `Brand shard ${shard.file} manifest mismatch: ${stored.length}/${shard.familyCount}`,
      );
    }
    let changed = false;
    const merged = stored.map((family) => {
      preservedBrandFamilyIds.add(family.modelFamilyId);
      const pruned = pruneAuthoritativeMarketplaceEvidence(
        family,
        authoritativeMarketplaceSources,
      );
      const incoming = incomingById.get(family.modelFamilyId);
      const next = incoming
        ? mergeCoreFamilyIntoBrandShard(pruned, incoming)
        : pruned;
      if (next !== family) changed = true;
      return next;
    });
    if (!changed) {
      preservedBrandShards.push(shard);
      continue;
    }
    const body = JSON.stringify(sortModelFamiliesForPersistence(merged));
    const bytes = Buffer.byteLength(body, "utf8");
    if (bytes > MODEL_FAMILY_SHARD_MAX_BYTES) {
      throw new Error(`Brand shard ${shard.file} exceeds ${MODEL_FAMILY_SHARD_MAX_BYTES} bytes.`);
    }
    pendingBrandWrites.set(shard.file, body);
    preservedBrandShards.push({ file: shard.file, familyCount: merged.length, bytes });
  }
  const coreFamilies = families.filter((family) => !preservedBrandFamilyIds.has(family.modelFamilyId));
  const shards = splitModelFamiliesIntoShards(coreFamilies);
  const shardInfos: ModelFamilyShardInfo[] = [];
  const keep = new Set<string>(["manifest.json"]);

  for (let index = 0; index < shards.length; index += 1) {
    const file = shardFileName(index);
    keep.add(file);
    const body = JSON.stringify(shards[index]);
    const bytes = Buffer.byteLength(body, "utf8");
    if (bytes > MODEL_FAMILY_SHARD_MAX_BYTES) {
      throw new Error(
        `Model Family shard ${file} is ${bytes} bytes; GitHub rejects files above 100 MB and this pipeline caps shards at ${MODEL_FAMILY_SHARD_MAX_BYTES} bytes.`,
      );
    }
    await writeWithRetry(join(dir, file), body);
    shardInfos.push({
      file,
      familyCount: shards[index]!.length,
      bytes,
    });
  }

  for (const [file, body] of pendingBrandWrites) {
    await writeWithRetry(join(dir, file), body);
  }

  const manifest: ModelFamilyDatasetManifest = {
    schema: MODEL_FAMILY_SHARD_SCHEMA,
    version: MODEL_FAMILY_SHARD_VERSION,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    totalFamilies: coreFamilies.length + preservedBrandShards.reduce((sum, shard) => sum + shard.familyCount, 0),
    shardCount: shardInfos.length + preservedBrandShards.length,
    shards: [...shardInfos, ...preservedBrandShards],
  };
  await writeWithRetry(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));

  const existing = await readdir(dir);
  for (const file of existing) {
    if (keep.has(file)) continue;
    if (!/^part-\d{3}\.json(?:\..*)?$/.test(file) && !file.endsWith(".tmp")) continue;
    try {
      await unlink(join(dir, file));
    } catch {
      // ignore
    }
  }

  return manifest;
}

export async function modelFamilyDatasetMtimeMs(
  options: ModelFamilyDatasetOptions = {},
): Promise<number | null> {
  const rootDir = options.rootDir ?? DEFAULT_MULTIBRAND_DIR;
  try {
    const manifestStat = await stat(join(resolveModelFamilyDatasetDir(rootDir), "manifest.json"));
    return manifestStat.mtimeMs;
  } catch {
    try {
      const monolithStat = await stat(resolveModelFamilyMonolithPath(rootDir));
      return monolithStat.mtimeMs;
    } catch {
      return null;
    }
  }
}
