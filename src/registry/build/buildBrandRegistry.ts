import { validateBrandEntries } from "../validation/brandValidation";
import type { BrandRegistryEntry } from "../types/brand";
import {
  convertUniverseToRegistryEntries,
  generateBrandsTsFile,
} from "./convertBrandUniverse";
import {
  hasBlockingValidationErrors,
  validateBrandUniverseEntries,
} from "./validateBrandUniverse";
import type {
  BrandProbeCacheFile,
  BrandUniverseBuildReport,
  BrandUniverseEntry,
  BrandUniverseFile,
} from "./types";

export interface BuildBrandRegistryResult {
  ok: boolean;
  report: BrandUniverseBuildReport;
  registryCount: number;
  brandsTsContent?: string;
}

function countByField<T>(items: T[], getter: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const value = getter(item);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function buildReportFromRegistryEntries(
  universe: BrandUniverseEntry[],
  entries: BrandRegistryEntry[],
  duplicateWarnings: string[],
  validationErrors: string[],
  probeCacheApplied: number,
): BrandUniverseBuildReport {
  return {
    generatedAt: new Date().toISOString(),
    totalBrands: universe.length,
    activeBrands: entries.filter((entry) => entry.isActive).length,
    inactiveBrands: entries.filter((entry) => !entry.isActive).length,
    readyAutomatic: entries.filter((entry) => entry.collectionStatus === "READY_AUTOMATIC").length,
    needsProbe: entries.filter((entry) => entry.collectionStatus === "NEEDS_PROBE").length,
    needsCustomAdapter: entries.filter(
      (entry) => entry.collectionStatus === "NEEDS_CUSTOM_ADAPTER",
    ).length,
    failed: entries.filter((entry) => entry.collectionStatus === "FAILED").length,
    countryCounts: countByField(entries, (entry) => entry.country),
    segmentCounts: countByField(entries, (entry) => entry.segment),
    priorityCounts: countByField(entries, (entry) => entry.trackingPriority),
    collectorTypeCounts: countByField(entries, (entry) => entry.collectorType),
    duplicateWarnings,
    validationErrors,
    probeCacheApplied,
    unreviewedBrands: entries.filter((entry) => entry.classificationStatus === "UNREVIEWED")
      .length,
    radarIneligibleBrands: entries.filter((entry) => !entry.radarEligible).length,
  };
}

function buildReportFromUniverseOnly(
  universe: BrandUniverseEntry[],
  duplicateWarnings: string[],
  validationErrors: string[],
): BrandUniverseBuildReport {
  return {
    generatedAt: new Date().toISOString(),
    totalBrands: universe.length,
    activeBrands: universe.filter((entry) => entry.isActive).length,
    inactiveBrands: universe.filter((entry) => !entry.isActive).length,
    readyAutomatic: universe.filter((entry) => entry.collectionStatus === "READY_AUTOMATIC").length,
    needsProbe: universe.filter((entry) => entry.collectionStatus === "NEEDS_PROBE").length,
    needsCustomAdapter: universe.filter(
      (entry) => entry.collectionStatus === "NEEDS_CUSTOM_ADAPTER",
    ).length,
    failed: universe.filter((entry) => entry.collectionStatus === "FAILED").length,
    countryCounts: countByField(universe, (entry) => entry.country),
    segmentCounts: countByField(universe, (entry) => entry.segment),
    priorityCounts: countByField(universe, (entry) => entry.trackingPriority),
    collectorTypeCounts: countByField(universe, (entry) => entry.collectorType),
    duplicateWarnings,
    validationErrors,
    probeCacheApplied: 0,
    unreviewedBrands: universe.filter((entry) => entry.classificationStatus === "UNREVIEWED")
      .length,
    radarIneligibleBrands: universe.filter((entry) => !entry.radarEligible).length,
  };
}

export function buildBrandRegistryFromUniverseData(input: {
  universeFile: BrandUniverseFile;
  probeCache?: BrandProbeCacheFile;
}): BuildBrandRegistryResult {
  const universe = input.universeFile.brands ?? [];

  const validationIssues = validateBrandUniverseEntries(universe);
  const validationErrors = validationIssues
    .filter((issue) => issue.level === "error")
    .map((issue) => `[${issue.code}] ${issue.message}`);
  const duplicateWarnings = validationIssues
    .filter((issue) => issue.level === "warning")
    .map((issue) => `[${issue.code}] ${issue.message}`);

  if (hasBlockingValidationErrors(validationIssues)) {
    return {
      ok: false,
      report: buildReportFromUniverseOnly(universe, duplicateWarnings, validationErrors),
      registryCount: 0,
    };
  }

  const { entries, probeCacheApplied } = convertUniverseToRegistryEntries({
    universe,
    probeCache: input.probeCache,
  });

  const registryValidationErrors = validateBrandEntries(entries);
  const allValidationErrors = [
    ...validationErrors,
    ...registryValidationErrors.map(
      (error) => `[REGISTRY_${error.code}] ${error.message}`,
    ),
  ];

  const report = buildReportFromRegistryEntries(
    universe,
    entries,
    duplicateWarnings,
    allValidationErrors,
    probeCacheApplied,
  );

  if (registryValidationErrors.length > 0) {
    return { ok: false, report, registryCount: entries.length };
  }

  return {
    ok: true,
    report,
    registryCount: entries.length,
    brandsTsContent: generateBrandsTsFile(entries),
  };
}
