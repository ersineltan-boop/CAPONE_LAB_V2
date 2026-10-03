import type { BrandRegistryEntry } from "../types/brand";
import type { BrandUniverseEntry } from "./types";
import { applyProbeCacheToEntry } from "./probeCache";
import type { BrandProbeCacheFile } from "./types";

export function universeEntryToRegistryEntry(
  entry: BrandUniverseEntry,
): BrandRegistryEntry {
  return {
    id: entry.id,
    brand: entry.brand,
    country: entry.country,
    city: entry.city,
    segment: entry.segment,
    role: entry.influenceRole,
    footwearInfluence: entry.footwearInfluence,
    directionalInfluence: entry.directionalInfluence,
    commercialInfluence: entry.commercialInfluence,
    trackingPriority: entry.trackingPriority,
    officialUrl: entry.officialUrl,
    collectionUrl: entry.collectionUrl ?? null,
    collectionPaths: [...entry.collectionPaths],
    footwearCollectionUrls: entry.footwearCollectionUrls
      ? [...entry.footwearCollectionUrls]
      : undefined,
    footwearCollectionHandles: entry.footwearCollectionHandles
      ? [...entry.footwearCollectionHandles]
      : undefined,
    collectionDiscoveryStatus: entry.collectionDiscoveryStatus,
    collectorType: entry.collectorType,
    collectionStatus: entry.collectionStatus,
    productLimit: entry.productLimit,
    backfillLimit: entry.backfillLimit,
    newArrivalUrls: entry.newArrivalUrls ? [...entry.newArrivalUrls] : undefined,
    newArrivalCollectionHandles: entry.newArrivalCollectionHandles ? [...entry.newArrivalCollectionHandles] : undefined,
    newArrivalDiscoveryStatus: entry.newArrivalDiscoveryStatus,
    newArrivalEvidenceStrategy: entry.newArrivalEvidenceStrategy,
    supportsMultipleImages: entry.supportsMultipleImages,
    preferPilotCache: entry.preferPilotCache,
    discoverySources: [...entry.discoverySources],
    isActive: entry.isActive,
    notes: entry.notes,
    classificationStatus: entry.classificationStatus,
    radarEligible: entry.radarEligible,
  };
}

export function registryEntryToUniverseEntry(
  entry: BrandRegistryEntry,
): BrandUniverseEntry {
  return {
    id: entry.id,
    brand: entry.brand,
    officialUrl: entry.officialUrl ?? "",
    country: entry.country,
    city: entry.city,
    segment: entry.segment,
    influenceRole: entry.role,
    trackingPriority: entry.trackingPriority,
    isActive: entry.isActive,
    collectorType: entry.collectorType,
    collectionStatus: entry.collectionStatus,
    footwearFocus: "WOMENS_FOOTWEAR",
    womenFootwearRelevant: true,
    sourceType: "BRAND",
    notes: entry.notes,
    footwearInfluence: entry.footwearInfluence,
    directionalInfluence: entry.directionalInfluence,
    commercialInfluence: entry.commercialInfluence,
    collectionUrl: entry.collectionUrl ?? null,
    collectionPaths: [...entry.collectionPaths],
    footwearCollectionUrls: entry.footwearCollectionUrls
      ? [...entry.footwearCollectionUrls]
      : undefined,
    footwearCollectionHandles: entry.footwearCollectionHandles
      ? [...entry.footwearCollectionHandles]
      : undefined,
    collectionDiscoveryStatus: entry.collectionDiscoveryStatus,
    productLimit: entry.productLimit,
    backfillLimit: entry.backfillLimit,
    newArrivalUrls: entry.newArrivalUrls ? [...entry.newArrivalUrls] : undefined,
    newArrivalCollectionHandles: entry.newArrivalCollectionHandles ? [...entry.newArrivalCollectionHandles] : undefined,
    newArrivalDiscoveryStatus: entry.newArrivalDiscoveryStatus,
    newArrivalEvidenceStrategy: entry.newArrivalEvidenceStrategy,
    supportsMultipleImages: entry.supportsMultipleImages,
    preferPilotCache: entry.preferPilotCache,
    discoverySources: [...entry.discoverySources],
    classificationStatus: entry.classificationStatus ?? "REVIEWED",
    radarEligible: entry.radarEligible ?? entry.classificationStatus !== "UNREVIEWED",
  };
}

export function convertUniverseToRegistryEntries(input: {
  universe: BrandUniverseEntry[];
  probeCache?: BrandProbeCacheFile;
}): { entries: BrandRegistryEntry[]; probeCacheApplied: number } {
  let probeCacheApplied = 0;
  const entries: BrandRegistryEntry[] = [];

  for (const universeEntry of input.universe) {
    if (!universeEntry.womenFootwearRelevant) continue;

    let registryEntry = universeEntryToRegistryEntry(universeEntry);

    if (input.probeCache) {
      const cached = input.probeCache.entries[registryEntry.id];
      const applied = applyProbeCacheToEntry(registryEntry, cached);
      registryEntry = applied.entry;
      if (applied.applied) probeCacheApplied += 1;
    }

    entries.push(registryEntry);
  }

  return { entries, probeCacheApplied };
}

function escapeString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function formatStringArray(values: readonly string[]): string {
  if (values.length === 0) return "[]";
  return `[\n${values.map((value) => `      "${escapeString(value)}",`).join("\n")}\n    ]`;
}

export function generateBrandsTsFile(entries: BrandRegistryEntry[]): string {
  const blocks = entries.map((entry) => {
    const optionalLines: string[] = [];
    if (entry.city) optionalLines.push(`    city: "${escapeString(entry.city)}",`);
    if (entry.collectionUrl) {
      optionalLines.push(`    collectionUrl: "${escapeString(entry.collectionUrl)}",`);
    }
    if (entry.preferPilotCache) optionalLines.push(`    preferPilotCache: true,`);
    if (entry.footwearCollectionUrls?.length) {
      optionalLines.push(
        `    footwearCollectionUrls: ${formatStringArray(entry.footwearCollectionUrls)},`,
      );
    }
    if (entry.footwearCollectionHandles?.length) {
      optionalLines.push(
        `    footwearCollectionHandles: ${formatStringArray(entry.footwearCollectionHandles)},`,
      );
    }
    if (entry.collectionDiscoveryStatus) {
      optionalLines.push(
        `    collectionDiscoveryStatus: "${entry.collectionDiscoveryStatus}",`,
      );
    }
    if (entry.backfillLimit !== undefined) {
      optionalLines.push(`    backfillLimit: ${entry.backfillLimit},`);
    }
    // Source evidence must survive every registry rebuild, including deliveries
    // for unrelated brands. Missing evidence stays missing; it is never inferred.
    if (entry.newArrivalUrls !== undefined) {
      optionalLines.push(`    newArrivalUrls: ${formatStringArray(entry.newArrivalUrls)},`);
    }
    if (entry.newArrivalCollectionHandles !== undefined) {
      optionalLines.push(`    newArrivalCollectionHandles: ${formatStringArray(entry.newArrivalCollectionHandles)},`);
    }
    if (entry.newArrivalDiscoveryStatus !== undefined) {
      optionalLines.push(`    newArrivalDiscoveryStatus: "${entry.newArrivalDiscoveryStatus}",`);
    }
    if (entry.newArrivalEvidenceStrategy !== undefined) {
      optionalLines.push(`    newArrivalEvidenceStrategy: "${escapeString(entry.newArrivalEvidenceStrategy)}",`);
    }

    return `  brand({
    id: "${escapeString(entry.id)}",
    brand: "${escapeString(entry.brand)}",
    country: "${escapeString(entry.country)}",
${optionalLines.join("\n")}${optionalLines.length ? "\n" : ""}    segment: "${entry.segment}",
    role: "${entry.role}",
    footwearInfluence: ${entry.footwearInfluence},
    directionalInfluence: ${entry.directionalInfluence},
    commercialInfluence: ${entry.commercialInfluence},
    trackingPriority: "${entry.trackingPriority}",
    officialUrl: ${entry.officialUrl ? `"${escapeString(entry.officialUrl)}"` : "null"},
    collectionPaths: ${formatStringArray(entry.collectionPaths)},
    collectorType: "${entry.collectorType}",
    collectionStatus: "${entry.collectionStatus}",
    productLimit: ${entry.productLimit},
    supportsMultipleImages: ${entry.supportsMultipleImages},
    discoverySources: ${formatStringArray(entry.discoverySources)},
    isActive: ${entry.isActive},
    notes: "${escapeString(entry.notes)}",
    classificationStatus: "${entry.classificationStatus}",
    radarEligible: ${entry.radarEligible},
  })`;
  });

  return `/**
 * MASTER BRAND REGISTRY
 *
 * ⚠️ Bu dosya otomatik üretilir — elle düzenlemeyin.
 * Kaynak: data/registry/brand-universe.json
 * Oluştur: npm run brands:build
 */
import type { BrandRegistryEntry } from "../types/brand";

function brand(
  entry: BrandRegistryEntry,
): BrandRegistryEntry {
  return entry;
}

export const brandEntries: BrandRegistryEntry[] = [
${blocks.join(",\n")}
];
`;
}
