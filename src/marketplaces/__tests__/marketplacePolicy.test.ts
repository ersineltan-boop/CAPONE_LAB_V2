import { describe, expect, it } from "vitest";

import type { ModelFamily, RawAnalyzedProduct } from "../../modelFamily/types";
import { buildModelFamilies } from "../../modelFamily/buildFamilies";
import { sourceChannelOf } from "../../modelFamily/sourceIdentity";
import { modelFamilyToGridItem } from "../../categories/modelFamilyGrid";
import { resolveVisiblePriceLabel } from "../../components/modelFamily/ModelFamilyProductGrid";
import {
  familyHasOfficialChannel,
  filterFamiliesForMarketplaceSource,
  marketplaceBrowsePresentation,
} from "../../source/sourceProductQuery";
import {
  isExcludedMarketplaceBrand,
  isExcludedMarketplaceSource,
  isExplicitTechnicalSneaker,
  marketplaceSourceSightings,
  normalizeMarketplaceSourceId,
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

function product(source: string, productUrl: string): RawAnalyzedProduct {
  return {
    source,
    brand: "Aeyde",
    productName: "Moa Leather Pump",
    productUrl,
    imageUrl: null,
    category: "PUMP",
    color: "Black",
    material: "Leather",
    discoveredAt: "2026-09-16T00:00:00.000Z",
    variants: [{ sku: "MOA-100-BLACK" }],
    cleaned: { heelHeight: null, color: "Black" },
    normalized: {
      category: "PUMP",
      colorFamily: "BLACK",
      materialFamily: "LEATHER",
      heelType: "STILETTO",
      heelHeightGroup: "HIGH",
      toeShape: "POINTED",
      details: [],
      construction: ["CLOSED_TOE"],
    },
  };
}

describe("marketplace runtime policy", () => {
  it("normalizes source IDs before every classification and query", () => {
    expect(normalizeMarketplaceSourceId(" Far_Fetch ")).toBe("farfetch");
    expect(normalizeMarketplaceSourceId("Level Shoes")).toBe("level-shoes");
    const aliased = family({
      sourceSightings: [{
        sourceId: "Far_Fetch",
        sourceLabel: "Farfetch",
        sourceKind: "LUXURY_MARKETPLACE",
        firstSeenAt: "2026-09-01T00:00:00.000Z",
        lastSeenAt: "2026-09-16T00:00:00.000Z",
      }],
    });
    expect(filterFamiliesForMarketplaceSource([aliased], "far fetch")).toEqual([aliased]);
    expect(marketplaceSourceSightings(aliased, "FARFETCH")).toHaveLength(1);
  });

  it("never classifies excluded marketplaces as official channels", () => {
    for (const source of ["amazon", "eMAG", "Trendyol", "OTTO"]) {
      expect(isExcludedMarketplaceSource(source)).toBe(true);
      expect(sourceChannelOf(source)).toBe("MARKETPLACE");
      expect(familyHasOfficialChannel(family({
        brand: source,
        sourceSightings: [{
          sourceId: source,
          sourceLabel: source,
          sourceKind: "BRAND_OFFICIAL",
          firstSeenAt: "2026-09-01T00:00:00.000Z",
          lastSeenAt: "2026-09-16T00:00:00.000Z",
        }],
      }))).toBe(false);
    }
  });

  it("excludes the agreed mass and technical sneaker brands", () => {
    for (const brand of [
      "Adidas", "adidas Originals", "NIKE", "Converse", "Hoka One One", "On", "On Running",
      "Salomon", "Salomon Sportstyle",
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

  it("keeps matching products from different marketplaces in separate source families", () => {
    const { families } = buildModelFamilies([
      product("Far Fetch", "https://farfetch.com/item-1001"),
      product("Level_Shoes", "https://levelshoes.com/products/moa-leather-pump"),
    ]);
    expect(families).toHaveLength(2);
    expect(filterFamiliesForMarketplaceSource(families, "farfetch")).toHaveLength(1);
    expect(filterFamiliesForMarketplaceSource(families, "level shoes")).toHaveLength(1);
    expect(families.flatMap((entry) => entry.sourceSightings ?? []).map((s) => s.sourceId).sort())
      .toEqual(["farfetch", "level-shoes"]);
  });

  it("drives the marketplace UI query with price rendering disabled", () => {
    const priced = family() as ModelFamily & { priceLabel: string };
    priced.priceLabel = "€490";
    const presentation = marketplaceBrowsePresentation([priced], "farfetch");
    const item = modelFamilyToGridItem(presentation.families[0]!);
    expect(presentation.showPrice).toBe(false);
    expect(resolveVisiblePriceLabel(item, presentation.showPrice)).toBeNull();
    expect(resolveVisiblePriceLabel(item, true)).toBe("€490");
  });
});
