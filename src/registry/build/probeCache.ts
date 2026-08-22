import type { BrandProbeResult } from "../../collector/brandProbe";
import type { BrandRegistryEntry } from "../types/brand";
import { normalizeOfficialUrl } from "./normalize";
import type { BrandProbeCacheEntry, BrandProbeCacheFile } from "./types";

export function mapProbeResultToCacheEntry(
  result: BrandProbeResult,
  brandId: string,
): BrandProbeCacheEntry {
  const collectionStatus =
    result.recommendation === "READY_AUTOMATIC"
      ? "READY_AUTOMATIC"
      : result.recommendation === "NEEDS_FOOTWEAR_CONFIG"
        ? "NEEDS_FOOTWEAR_CONFIG"
      : result.recommendation === "NEEDS_CUSTOM_ADAPTER"
        ? "NEEDS_CUSTOM_ADAPTER"
        : result.recommendation === "LINK_ONLY"
          ? "LINK_ONLY"
          : result.recommendation === "FAILED"
            ? "FAILED"
            : "NEEDS_PROBE";

  return {
    brandId,
    brand: result.brand,
    officialUrl: result.officialUrl ?? "",
    detectedCollectorType: result.detectedCollectorType,
    collectionStatus,
    probedAt: new Date().toISOString(),
    reachable: result.reachable,
    recommendation: result.recommendation,
  };
}

export function emptyProbeCache(): BrandProbeCacheFile {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    entries: {},
  };
}

export function isProbeCacheValidForBrand(input: {
  entry: BrandRegistryEntry;
  cacheEntry: BrandProbeCacheEntry | undefined;
}): boolean {
  if (!input.cacheEntry) return false;
  if (!input.entry.officialUrl) return false;
  return (
    normalizeOfficialUrl(input.cacheEntry.officialUrl) ===
    normalizeOfficialUrl(input.entry.officialUrl)
  );
}

export function shouldProbeBrand(input: {
  entry: BrandRegistryEntry;
  cache: BrandProbeCacheFile;
  force?: boolean;
}): boolean {
  if (input.force) return true;
  const cached = input.cache.entries[input.entry.id];
  if (!cached) return true;
  return !isProbeCacheValidForBrand({ entry: input.entry, cacheEntry: cached });
}

export function applyProbeCacheToEntry(
  entry: BrandRegistryEntry,
  cacheEntry: BrandProbeCacheEntry | undefined,
): { entry: BrandRegistryEntry; applied: boolean } {
  if (!cacheEntry || !isProbeCacheValidForBrand({ entry, cacheEntry: cacheEntry })) {
    return { entry, applied: false };
  }

  return {
    entry: {
      ...entry,
      collectorType: cacheEntry.detectedCollectorType,
      collectionStatus: cacheEntry.collectionStatus,
    },
    applied: true,
  };
}

export function mergeProbeResultsIntoCache(input: {
  cache: BrandProbeCacheFile;
  results: BrandProbeResult[];
  idByBrandName: Map<string, string>;
}): BrandProbeCacheFile {
  const next: BrandProbeCacheFile = {
    ...input.cache,
    updatedAt: new Date().toISOString(),
    entries: { ...input.cache.entries },
  };

  for (const result of input.results) {
    const brandId =
      input.idByBrandName.get(result.brand.trim().toUpperCase()) ??
      result.brand.trim().toLowerCase().replace(/\s+/g, "-");
    next.entries[brandId] = mapProbeResultToCacheEntry(result, brandId);
  }

  return next;
}
