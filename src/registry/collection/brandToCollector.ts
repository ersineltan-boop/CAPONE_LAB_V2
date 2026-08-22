import type { BrandRegistryEntry } from "../types/brand";
import type { PilotSourceConfig } from "../../collector/types";
import { pickPreferredFootwearCollectionPaths } from "../../collector/discoverFootwearCollections";

const COLLECTABLE_STATUSES = new Set<BrandRegistryEntry["collectionStatus"]>([
  "READY_AUTOMATIC",
]);

export function resolveBrandBaseUrl(entry: BrandRegistryEntry): string | null {
  const raw = entry.collectionUrl ?? entry.officialUrl;
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export function brandToPilotSourceConfig(
  entry: BrandRegistryEntry,
): PilotSourceConfig | null {
  const baseUrl = resolveBrandBaseUrl(entry);
  if (!baseUrl) return null;

  const footwearPaths = pickPreferredFootwearCollectionPaths(
    entry.footwearCollectionHandles,
    entry.footwearCollectionUrls?.map((url) => {
      try {
        return new URL(url).pathname.replace(/\/$/, "");
      } catch {
        return url;
      }
    }),
    entry.collectionPaths,
  );

  return {
    id: entry.id,
    brand: entry.brand,
    baseUrl,
    collectionPaths: footwearPaths.length > 0 ? footwearPaths : [...entry.collectionPaths],
    verifiedFootwearPaths:
      entry.collectionDiscoveryStatus === "VERIFIED" ||
      entry.collectionDiscoveryStatus === "AUTO_DISCOVERED"
        ? footwearPaths
        : footwearPaths,
    maxProducts: entry.productLimit,
    backfillLimit: entry.backfillLimit ?? 100,
    collectMode: "full",
  };
}

export function isCollectableBrand(entry: BrandRegistryEntry): boolean {
  if (!entry.isActive) return false;
  if (!COLLECTABLE_STATUSES.has(entry.collectionStatus)) return false;
  if (entry.collectorType === "LINK_ONLY") return false;
  if (entry.collectorType === "UNSUPPORTED") return false;
  if (entry.collectorType === "CUSTOM_ADAPTER") return false;
  return resolveBrandBaseUrl(entry) !== null;
}

export function getCollectableBrands(
  entries: readonly BrandRegistryEntry[],
): BrandRegistryEntry[] {
  const seen = new Set<string>();
  const collectable: BrandRegistryEntry[] = [];

  for (const entry of entries) {
    if (!isCollectableBrand(entry)) continue;
    const key = entry.brand.trim().toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    collectable.push(entry);
  }

  return collectable;
}

export function getProbeCandidateBrands(
  entries: readonly BrandRegistryEntry[],
): BrandRegistryEntry[] {
  return entries.filter((entry) => entry.collectionStatus === "NEEDS_PROBE");
}
