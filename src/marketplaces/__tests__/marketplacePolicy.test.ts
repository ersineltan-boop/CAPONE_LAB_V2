import { describe, expect, it } from "vitest";

import type { ModelFamily } from "../../modelFamily/types";
import { filterFamiliesForMarketplaceSource } from "../../source/sourceProductQuery";
import {
  MARKETPLACE_PRESENTATION_POLICY,
  isExcludedMarketplaceBrand,
  isExcludedMarketplaceSource,
  isExplicitTechnicalSneaker,
  marketplaceSourceSightings,
} from "../marketplacePolicy";

function family(overrides: Partial<ModelFamily> = {}): ModelFamily {
  return {
    modelFamilyId: "family-1",
    brand: "Aeyde",
    canonicalName: "Leather low sneaker",
    category: "SNEAKER",
    primaryCategory: "SNEAKER",
    representativeProductId: "product-1",
    representativeImage: null,
    representativeImages: [],
    variantCount: 1,
    variants: [{
      productId: "product-1",
      title: "Leather low sneaker",
      url: "https://example.com/product-1",
      color: "Black",
      material: "Leather",
      images: [],
    }],
    allImages: [],
    sourceProductIds: ["product-1"],
    sourceSightings: [{
      sourceId: "farfetch",
      sourceLabel: "Farfetch",
      sourceKind: "LUXURY_MARKETPLACE",
      firstSeenAt: "2026-09-01T00:00:00.000Z",
      lastSeenAt: "2026-09-16T00:00:00.000Z",
    }],
    groupingConfidence: "HIGH",
    groupingReason: "test fixture",
    ...overrides,
  };
}

describe("marketplace coverage policy", () => {
  it("keeps the agreed general marketplaces outside the fashion scope", () => {
    for (const source of ["amazon", "eMAG", "Trendyol", "OTTO"]) {
      expect(isExcludedMarketplaceSource(source)).toBe(true);
    }
  });

  it("excludes the agreed mass and technical sneaker brands", () => {
    for (const brand of [
      "Adidas", "adidas Originals", "NIKE", "Converse", "Hoka One One", "On", "On Running",
    ]) {
      expect(isExcludedMarketplaceBrand(brand)).toBe(true);
    }
  });

  it("only treats explicit technical sneaker signals as technical", () => {
    expect(isExplicitTechnicalSneaker(family())).toBe(false);
    expect(isExplicitTechnicalSneaker(
      family({ canonicalName: "Performance trail running sneaker" }),
    )).toBe(true);
    expect(isExplicitTechnicalSneaker(
      family({ category: "BOOT", primaryCategory: "BOOT", canonicalName: "Trail boot" }),
    )).toBe(false);
  });

  it("filters coverage without merging away the marketplace sighting", () => {
    const visible = family();
    const massBrand = family({ modelFamilyId: "family-2", brand: "Nike" });
    const technical = family({
      modelFamilyId: "family-3",
      canonicalName: "Trail running sneaker",
    });

    expect(filterFamiliesForMarketplaceSource([visible, massBrand, technical], "farfetch"))
      .toEqual([visible]);
    expect(marketplaceSourceSightings(visible, "farfetch")).toEqual(
      visible.sourceSightings,
    );
  });

  it("declares a price-free, source-preserving presentation contract", () => {
    expect(MARKETPLACE_PRESENTATION_POLICY).toEqual({
      showPrice: false,
      preserveSourceSightings: true,
      mergeAcrossMarketplaces: false,
    });
  });
});
