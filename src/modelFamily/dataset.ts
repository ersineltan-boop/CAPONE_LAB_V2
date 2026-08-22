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

  const shards = splitModelFamiliesIntoShards(families);
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

  const manifest: ModelFamilyDatasetManifest = {
    schema: MODEL_FAMILY_SHARD_SCHEMA,
    version: MODEL_FAMILY_SHARD_VERSION,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    totalFamilies: families.length,
    shardCount: shardInfos.length,
    shards: shardInfos,
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
