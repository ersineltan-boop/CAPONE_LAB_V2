import { describe, expect, it } from "vitest";

import type { BrandUniverseFile } from "../build/types";
import { universeEntryToRegistryEntry } from "../build/convertBrandUniverse";
import { isCollectableBrand } from "../collection/brandToCollector";
import {
  WAVE1_BRAND_CANDIDATES,
  canActivateAfterProbe,
  canActivateAfterTestCollection,
  importBrandCandidates,
} from "../import/candidateImport";

function emptyUniverse(brands: BrandUniverseFile["brands"] = []): BrandUniverseFile {
  return { version: 1, brands };
}

describe("scalable brand candidate import", () => {
  it("adds missing candidates without duplicating existing registry brands", () => {
    const existing: BrandUniverseFile["brands"] = [
      {
        id: "aeyde",
        brand: "AEYDE",
        officialUrl: "https://www.aeyde.com",
        country: "Germany",
        segment: "UNCLASSIFIED",
        influenceRole: "UNCLASSIFIED",
        trackingPriority: "P2",
        isActive: true,
        collectorType: "SHOPIFY_PUBLIC",
        collectionStatus: "READY_AUTOMATIC",
        footwearFocus: "WOMENS_FOOTWEAR",
        womenFootwearRelevant: true,
        sourceType: "BRAND",
        notes: "",
        footwearInfluence: 0,
        directionalInfluence: 0,
        commercialInfluence: 0,
        collectionPaths: [],
        productLimit: 30,
        supportsMultipleImages: true,
        discoverySources: [],
        classificationStatus: "UNREVIEWED",
        radarEligible: false,
      },
    ];
    const result = importBrandCandidates(emptyUniverse(existing), WAVE1_BRAND_CANDIDATES);
    expect(result.alreadyPresent.some((item) => item.id === "aeyde")).toBe(true);
    expect(result.added.some((entry) => entry.id === "zara")).toBe(true);
    expect(result.added.every((entry) => entry.isActive === false)).toBe(true);
    expect(result.added.every((entry) => entry.collectionStatus === "NEEDS_PROBE")).toBe(true);
    expect(result.universe.brands.length).toBe(existing.length + result.added.length);
  });

  it("does not activate from a probe sample alone", () => {
    expect(
      canActivateAfterProbe({
        recommendation: "READY_AUTOMATIC",
        productDiscoveryWorks: true,
        sampleProductCount: 5,
      }),
    ).toBe(true);
    expect(
      canActivateAfterProbe({
        recommendation: "NEEDS_CUSTOM_ADAPTER",
        productDiscoveryWorks: false,
        sampleProductCount: 0,
      }),
    ).toBe(false);
    expect(
      canActivateAfterTestCollection({
        probeReady: true,
        collectedProductCount: 0,
      }),
    ).toBe(false);
    expect(
      canActivateAfterTestCollection({
        probeReady: true,
        collectedProductCount: 42,
      }),
    ).toBe(true);
  });

  it("does not treat an inactive adapter candidate as collectable", () => {
    const entry = universeEntryToRegistryEntry({
      id: "zara",
      brand: "ZARA",
      officialUrl: "https://www.zara.com",
      country: "Spain",
      segment: "UNCLASSIFIED",
      influenceRole: "UNCLASSIFIED",
      trackingPriority: "P2",
      isActive: false,
      collectorType: "CUSTOM_ADAPTER",
      collectionStatus: "NEEDS_CUSTOM_ADAPTER",
      womenFootwearRelevant: true,
      sourceType: "BRAND",
      notes: "",
      footwearInfluence: 0,
      directionalInfluence: 0,
      commercialInfluence: 0,
      collectionPaths: [],
      productLimit: 20,
      supportsMultipleImages: false,
      discoverySources: [],
      classificationStatus: "UNREVIEWED",
      radarEligible: false,
    });
    expect(isCollectableBrand(entry)).toBe(false);
  });
});
