import { describe, expect, it } from "vitest";

import { brandEntries } from "../data/brands";
import { buildBrandRegistryFromUniverseData } from "../build/buildBrandRegistry";
import {
  registryEntryToUniverseEntry,
  universeEntryToRegistryEntry,
} from "../build/convertBrandUniverse";
import {
  applyProbeCacheToEntry,
  isProbeCacheValidForBrand,
  shouldProbeBrand,
} from "../build/probeCache";
import {
  hasBlockingValidationErrors,
  validateBrandUniverseEntries,
} from "../build/validateBrandUniverse";
import { getCollectableBrands, getProbeCandidateBrands } from "../collection/brandToCollector";
import type { BrandProbeCacheFile, BrandUniverseEntry } from "../build/types";
import { loadBrandRegistry } from "../data/index";

function sampleUniverseEntry(
  overrides: Partial<BrandUniverseEntry> = {},
): BrandUniverseEntry {
  return {
    id: "test-brand",
    brand: "TEST BRAND",
    officialUrl: "https://example.com",
    country: "Fransa",
    segment: "CONTEMPORARY",
    influenceRole: "MARKET",
    trackingPriority: "P2",
    isActive: false,
    collectorType: "UNKNOWN",
    collectionStatus: "NEEDS_PROBE",
    footwearFocus: "WOMENS_FOOTWEAR",
    womenFootwearRelevant: true,
    sourceType: "BRAND",
    notes: "",
    footwearInfluence: 50,
    directionalInfluence: 45,
    commercialInfluence: 55,
    collectionPaths: [],
    productLimit: 20,
    supportsMultipleImages: false,
    discoverySources: [],
    classificationStatus: "REVIEWED",
    radarEligible: true,
    ...overrides,
  };
}

function sampleCache(overrides: Partial<BrandProbeCacheFile["entries"]["christen"]> = {}): BrandProbeCacheFile {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    entries: {
      christen: {
        brandId: "christen",
        brand: "CHRISTEN",
        officialUrl: "https://christen.com",
        detectedCollectorType: "SHOPIFY_PUBLIC",
        collectionStatus: "READY_AUTOMATIC",
        probedAt: new Date().toISOString(),
        reachable: true,
        recommendation: "READY_AUTOMATIC",
        ...overrides,
      },
    },
  };
}

describe("brand universe validation", () => {
  it("rejects duplicate brand id", () => {
    const issues = validateBrandUniverseEntries([
      sampleUniverseEntry({ id: "dup", brand: "BRAND A" }),
      sampleUniverseEntry({ id: "dup", brand: "BRAND B" }),
    ]);
    expect(hasBlockingValidationErrors(issues)).toBe(true);
    expect(issues.some((issue) => issue.code === "DUPLICATE_ID")).toBe(true);
  });

  it("warns on duplicate officialUrl", () => {
    const issues = validateBrandUniverseEntries([
      sampleUniverseEntry({ id: "a", brand: "BRAND A" }),
      sampleUniverseEntry({
        id: "b",
        brand: "BRAND B",
        officialUrl: "https://example.com/",
      }),
    ]);
    expect(issues.some((issue) => issue.code === "DUPLICATE_URL")).toBe(true);
    expect(hasBlockingValidationErrors(issues)).toBe(false);
  });

  it("rejects invalid segment/role", () => {
    const issues = validateBrandUniverseEntries([
      sampleUniverseEntry({
        segment: "INVALID" as BrandUniverseEntry["segment"],
      }),
    ]);
    expect(issues.some((issue) => issue.code === "INVALID_SEGMENT")).toBe(true);
  });

  it("rejects non-BRAND sourceType", () => {
    const issues = validateBrandUniverseEntries([
      sampleUniverseEntry({ sourceType: "BRAND" }),
      sampleUniverseEntry({
        id: "retailer",
        brand: "RETAILER X",
        sourceType: "RETAILER" as BrandUniverseEntry["sourceType"],
      }),
    ]);
    expect(issues.some((issue) => issue.code === "INVALID_SOURCE_TYPE")).toBe(true);
  });
});

const ORIGINAL_PILOT_BRAND_IDS = [
  "schutz", "tony-bianco", "st-agni", "a-emery", "alias-mae", "alohas",
  "dear-frances", "le-monde-beryl", "larroude", "dolce-vita", "jeffrey-campbell",
  "steve-madden", "christen", "jude", "nodaleto", "neous", "reike-nen",
  "yuul-yie", "studio-amelia", "aeyde", "hereu", "souliers-martinez",
  "luis-onofre", "flattered", "jonak", "bobbies", "senso", "maray", "exe",
  "luiza-barcelos", "vicenza", "santa-lolla", "jorge-bischoff", "arezzo", "miista",
];

describe("brand universe migration", () => {
  it("preserves all 35 original pilot brands", () => {
    expect(brandEntries.length).toBe(135);
    const ids = new Set(brandEntries.map((entry) => entry.id));
    for (const id of ORIGINAL_PILOT_BRAND_IDS) {
      expect(ids.has(id)).toBe(true);
    }
    expect(ORIGINAL_PILOT_BRAND_IDS.length).toBe(35);
  });

  it("preserves original 22 pilot active brands", () => {
    const originalActive = brandEntries.filter(
      (entry) => entry.isActive && ORIGINAL_PILOT_BRAND_IDS.includes(entry.id),
    );
    expect(originalActive.length).toBe(22);
  });

  it("round-trip registry fields without loss", () => {
    const original = brandEntries[0];
    const universe = registryEntryToUniverseEntry(original);
    const restored = universeEntryToRegistryEntry(universe);
    expect(restored.id).toBe(original.id);
    expect(restored.brand).toBe(original.brand);
    expect(restored.role).toBe(original.role);
    expect(restored.collectorType).toBe(original.collectorType);
    expect(restored.collectionStatus).toBe(original.collectionStatus);
    expect(restored.isActive).toBe(original.isActive);
    expect(restored.officialUrl).toBe(original.officialUrl);
  });
});

describe("probe cache", () => {
  it("skips probe when URL unchanged in cache", () => {
    const entry = brandEntries.find((item) => item.id === "christen")!;
    const cache = sampleCache({ officialUrl: entry.officialUrl! });

    expect(shouldProbeBrand({ entry, cache, force: false })).toBe(false);
    expect(shouldProbeBrand({ entry, cache, force: true })).toBe(true);
  });

  it("requires re-probe when URL changes", () => {
    const entry = brandEntries.find((item) => item.id === "christen")!;
    const cache = sampleCache({ officialUrl: "https://old-url.example.com" });

    expect(isProbeCacheValidForBrand({ entry, cacheEntry: cache.entries.christen })).toBe(
      false,
    );
    expect(shouldProbeBrand({ entry, cache, force: false })).toBe(true);
  });

  it("applies cache to registry entry without changing isActive", () => {
    const entry = sampleUniverseEntry({
      isActive: false,
      collectionStatus: "NEEDS_PROBE",
      collectorType: "UNKNOWN",
    });
    const registryEntry = universeEntryToRegistryEntry(entry);
    const applied = applyProbeCacheToEntry(registryEntry, {
      brandId: "test-brand",
      brand: "TEST BRAND",
      officialUrl: "https://example.com",
      detectedCollectorType: "SHOPIFY_PUBLIC",
      collectionStatus: "READY_AUTOMATIC",
      probedAt: new Date().toISOString(),
      reachable: true,
      recommendation: "READY_AUTOMATIC",
    });

    expect(applied.applied).toBe(true);
    expect(applied.entry.collectionStatus).toBe("READY_AUTOMATIC");
    expect(applied.entry.collectorType).toBe("SHOPIFY_PUBLIC");
    expect(applied.entry.isActive).toBe(false);
  });
});

describe("brands:build integration", () => {
  it("builds valid registry from universe data", () => {
    const universe = brandEntries.map(registryEntryToUniverseEntry);
    universe.push(
      sampleUniverseEntry({
        id: "new-prospect",
        brand: "NEW PROSPECT",
        officialUrl: "https://new-prospect.example.com",
        isActive: false,
        collectionStatus: "NEEDS_PROBE",
        collectorType: "UNKNOWN",
      }),
    );

    const result = buildBrandRegistryFromUniverseData({
      universeFile: { version: 1, brands: universe },
    });

    expect(result.ok).toBe(true);
    expect(result.registryCount).toBe(136);
    expect(result.report.totalBrands).toBe(136);
    expect(result.report.activeBrands).toBeGreaterThanOrEqual(22);
    expect(result.brandsTsContent).toContain("NEW PROSPECT");
    expect(result.brandsTsContent).toContain("otomatik üretilir");
  });

  it("inactive NEEDS_PROBE brand is not collectable", () => {
    const inactive = sampleUniverseEntry({
      id: "inactive-probe",
      brand: "INACTIVE PROBE",
      isActive: false,
      collectionStatus: "NEEDS_PROBE",
    });
    const registryEntry = universeEntryToRegistryEntry(inactive);
    expect(getCollectableBrands([registryEntry]).length).toBe(0);
    expect(getProbeCandidateBrands([registryEntry]).length).toBe(1);
  });
});

describe("registry loader after build", () => {
  it("loadBrandRegistry validates current brands.ts", () => {
    const registry = loadBrandRegistry();
    expect(registry.all().length).toBe(135);
    expect(registry.all().filter((entry) => entry.isActive).length).toBe(28);
  });
});

describe("brand probe filters", () => {
  function applyProbeFilters(
    entries: ReturnType<typeof universeEntryToRegistryEntry>[],
    options: { country?: string; priority?: string; limit?: number },
  ) {
    let candidates = getProbeCandidateBrands(entries);

    if (options.country) {
      const normalizedCountry = options.country.trim().toLowerCase();
      candidates = candidates.filter((entry) =>
        entry.country.trim().toLowerCase().includes(normalizedCountry),
      );
    }

    if (options.priority) {
      candidates = candidates.filter(
        (entry) => entry.trackingPriority === options.priority,
      );
    }

    if (options.limit && options.limit > 0) {
      candidates = candidates.slice(0, options.limit);
    }

    return candidates;
  }

  it("filters candidates by priority, country, and limit", () => {
    const entries = [
      universeEntryToRegistryEntry(
        sampleUniverseEntry({
          id: "france-p1",
          brand: "FRANCE P1",
          country: "Fransa",
          trackingPriority: "P1",
          isActive: false,
          collectionStatus: "NEEDS_PROBE",
        }),
      ),
      universeEntryToRegistryEntry(
        sampleUniverseEntry({
          id: "france-p2",
          brand: "FRANCE P2",
          country: "Fransa",
          trackingPriority: "P2",
          isActive: false,
          collectionStatus: "NEEDS_PROBE",
        }),
      ),
      universeEntryToRegistryEntry(
        sampleUniverseEntry({
          id: "spain-p1",
          brand: "SPAIN P1",
          country: "İspanya",
          trackingPriority: "P1",
          isActive: false,
          collectionStatus: "NEEDS_PROBE",
        }),
      ),
    ];

    const filtered = applyProbeFilters(entries, {
      country: "Fransa",
      priority: "P1",
      limit: 1,
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("france-p1");
    expect(filtered.every((entry) => !entry.isActive)).toBe(true);
  });
});
