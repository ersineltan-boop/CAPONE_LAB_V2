import { describe, expect, it } from "vitest";

import type { BrandRegistryEntry } from "../../registry/types/brand";
import { selectRequestedCollectableBrands } from "../runMultibrand";

function brand(id: string): BrandRegistryEntry {
  return {
    id,
    brand: id.toUpperCase(),
    country: "US",
    segment: "PREMIUM",
    role: "MARKET",
    footwearInfluence: 50,
    directionalInfluence: 50,
    commercialInfluence: 50,
    trackingPriority: "P2",
    officialUrl: `https://${id}.test`,
    collectionPaths: ["/collections/shoes"],
    collectorType: "SHOPIFY_PUBLIC",
    collectionStatus: "READY_AUTOMATIC",
    productLimit: 10,
    supportsMultipleImages: true,
    discoverySources: [],
    isActive: true,
    notes: "",
    classificationStatus: "REVIEWED",
    radarEligible: true,
  };
}

describe("multibrand explicit selection", () => {
  it("distinguishes omitted selection from an explicit empty selection", () => {
    const entries = [brand("legacy-a"), brand("legacy-b")];
    expect(selectRequestedCollectableBrands(entries).map((item) => item.id)).toEqual([
      "legacy-a",
      "legacy-b",
    ]);
    expect(selectRequestedCollectableBrands(entries, [])).toEqual([]);
    expect(selectRequestedCollectableBrands(entries, ["legacy-b"]).map((item) => item.id)).toEqual([
      "legacy-b",
    ]);
  });
});
