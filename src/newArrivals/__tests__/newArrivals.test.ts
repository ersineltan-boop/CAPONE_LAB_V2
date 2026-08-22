import { describe, expect, it } from "vitest";

import type { ModelFamily } from "../../modelFamily/types";
import {
  buildBrandSourceSighting,
  enrichFamilyWithSightings,
  mergeSourceSightings,
} from "../sourceSightings";
import { queryNewArrivals } from "../query";

function baseFamily(overrides: Partial<ModelFamily> = {}): ModelFamily {
  return {
    modelFamilyId: "brand--model",
    brand: "UGG",
    canonicalName: "Classic Boot",
    category: "BOOT",
    primaryCategory: "BOOT",
    representativeProductId: "https://example.com/a",
    representativeImage: null,
    representativeImages: [],
    variantCount: 1,
    variants: [],
    allImages: [],
    sourceProductIds: ["https://example.com/a"],
    groupingConfidence: "HIGH",
    groupingReason: "test",
    ...overrides,
  };
}

describe("sourceSightings immutability", () => {
  it("firstSeen is immutable on repeat crawl", () => {
    const prior = buildBrandSourceSighting("UGG", [
      {
        source: "ugg",
        brand: "UGG",
        productName: "Classic",
        productUrl: "https://example.com/a",
        imageUrl: null,
        category: "BOOT",
        color: null,
        material: null,
        discoveredAt: "2026-08-01T00:00:00.000Z",
        cleaned: { heelHeight: null, color: null },
        normalized: {
          category: "BOOT",
          colorFamily: "UNKNOWN",
          materialFamily: "UNKNOWN",
          heelType: "UNKNOWN",
          heelHeightGroup: "UNKNOWN",
          toeShape: "UNKNOWN",
          details: [],
          construction: [],
        },
      },
    ]);

    const updated = buildBrandSourceSighting(
      "UGG",
      [
        {
          source: "ugg",
          brand: "UGG",
          productName: "Classic",
          productUrl: "https://example.com/a",
          imageUrl: null,
          category: "BOOT",
          color: null,
          material: null,
          discoveredAt: "2026-08-20T00:00:00.000Z",
          cleaned: { heelHeight: null, color: null },
          normalized: {
            category: "BOOT",
            colorFamily: "UNKNOWN",
            materialFamily: "UNKNOWN",
            heelType: "UNKNOWN",
            heelHeightGroup: "UNKNOWN",
            toeShape: "UNKNOWN",
            details: [],
            construction: [],
          },
        },
      ],
      prior,
    );

    expect(updated.firstSeenAt).toBe("2026-08-01T00:00:00.000Z");
    expect(updated.lastSeenAt).toBe("2026-08-20T00:00:00.000Z");
  });

  it("source firstSeen can be later than global modelFamily firstSeen", () => {
    const family = baseFamily({
      modelFamilyFirstSeenAt: "2026-08-01T00:00:00.000Z",
      sourceSightings: [
        {
          sourceId: "ugg",
          sourceLabel: "UGG",
          firstSeenAt: "2026-08-01T00:00:00.000Z",
          lastSeenAt: "2026-08-01T00:00:00.000Z",
        },
        {
          sourceId: "mytheresa",
          sourceLabel: "Mytheresa",
          firstSeenAt: "2026-08-20T00:00:00.000Z",
          lastSeenAt: "2026-08-20T00:00:00.000Z",
        },
      ],
    });

    const globalItems = queryNewArrivals([family], {
      scope: { type: "ALL" },
      period: "90D",
      referenceDate: "2026-08-25T00:00:00.000Z",
    });
    const retailerItems = queryNewArrivals([family], {
      scope: { type: "SOURCE", sourceId: "mytheresa" },
      period: "90D",
      referenceDate: "2026-08-25T00:00:00.000Z",
    });

    expect(globalItems).toHaveLength(1);
    expect(globalItems[0]?.firstSeenAt).toBe("2026-08-01T00:00:00.000Z");
    expect(retailerItems).toHaveLength(1);
    expect(retailerItems[0]?.firstSeenAt).toBe("2026-08-20T00:00:00.000Z");
  });

  it("merge adds retailer sighting without duplicating global family", () => {
    const uggSighting = {
      sourceId: "ugg",
      sourceLabel: "UGG",
      firstSeenAt: "2026-08-01T00:00:00.000Z",
      lastSeenAt: "2026-08-01T00:00:00.000Z",
    };
    const mytheresaSighting = {
      sourceId: "mytheresa",
      sourceLabel: "Mytheresa",
      firstSeenAt: "2026-08-20T00:00:00.000Z",
      lastSeenAt: "2026-08-20T00:00:00.000Z",
    };

    const merged = mergeSourceSightings([uggSighting], mytheresaSighting);
    expect(merged).toHaveLength(2);

    const family = enrichFamilyWithSightings(
      baseFamily(),
      [],
      baseFamily({ sourceSightings: [uggSighting], modelFamilyFirstSeenAt: "2026-08-01T00:00:00.000Z" }),
    );
    expect(family.modelFamilyFirstSeenAt).toBe("2026-08-01T00:00:00.000Z");
  });
});

describe("new arrivals scoped filter", () => {
  it("filters by category and taxonomy fields", () => {
    const family = baseFamily({
      primaryCategory: "BALLET_FLAT",
      taxonomy: {
        version: 1,
        primaryCategory: "BALLET_FLAT",
        hybridInfluences: [],
        global: {
          toeShape: { value: "SQUARE", status: "KNOWN", source: "PRODUCT_TEXT", confidence: 0.9 },
          toeLength: { value: null, status: "UNKNOWN", source: "UNKNOWN", confidence: null },
          toeOpening: { value: null, status: "UNKNOWN", source: "UNKNOWN", confidence: null },
          backConstruction: {
            value: "SLINGBACK",
            status: "KNOWN",
            source: "PRODUCT_TEXT",
            confidence: 0.9,
          },
          vampHeight: { value: null, status: "UNKNOWN", source: "UNKNOWN", confidence: null },
          heelHeightClass: { value: null, status: "UNKNOWN", source: "UNKNOWN", confidence: null },
          heelHeightMm: { value: null, status: "UNKNOWN", source: "UNKNOWN", confidence: null },
          heelType: { value: null, status: "UNKNOWN", source: "UNKNOWN", confidence: null },
          soleProfile: { value: null, status: "UNKNOWN", source: "UNKNOWN", confidence: null },
          platformConstruction: {
            value: null,
            status: "UNKNOWN",
            source: "UNKNOWN",
            confidence: null,
          },
          closureFeatures: { value: null, status: "UNKNOWN", source: "UNKNOWN", confidence: null },
          strapFeatures: { value: null, status: "UNKNOWN", source: "UNKNOWN", confidence: null },
          sideConstruction: { value: null, status: "UNKNOWN", source: "UNKNOWN", confidence: null },
          hardwareType: { value: null, status: "UNKNOWN", source: "UNKNOWN", confidence: null },
          hardwareIntensity: { value: null, status: "UNKNOWN", source: "UNKNOWN", confidence: null },
          embellishmentFeatures: {
            value: null,
            status: "UNKNOWN",
            source: "UNKNOWN",
            confidence: null,
          },
          materialFamily: { value: null, status: "UNKNOWN", source: "UNKNOWN", confidence: null },
          colorFamily: { value: null, status: "UNKNOWN", source: "UNKNOWN", confidence: null },
          surfacePattern: { value: null, status: "UNKNOWN", source: "UNKNOWN", confidence: null },
        },
        categorySpecific: {},
        derivedStyleTags: [],
      },
      modelFamilyFirstSeenAt: "2026-08-10T00:00:00.000Z",
      sourceSightings: [
        {
          sourceId: "ugg",
          sourceLabel: "UGG",
          firstSeenAt: "2026-08-10T00:00:00.000Z",
          lastSeenAt: "2026-08-10T00:00:00.000Z",
        },
      ],
    });

    const items = queryNewArrivals([family], {
      scope: {
        type: "FILTER",
        category: "BALLET_FLAT",
        filters: [
          { field: "backConstruction", value: "SLINGBACK" },
          { field: "toeShape", value: "SQUARE" },
        ],
      },
      period: "30D",
      referenceDate: "2026-08-20T00:00:00.000Z",
    });

    expect(items).toHaveLength(1);
  });
});

describe("marketplace source sightings", () => {
  it("treats Level Shoes products as marketplace sightings, not brand-official", () => {
    const family = baseFamily({
      brand: "Aquazzura",
      representativeProductId: "https://www.levelshoes.com/aquazzura-tequila.html",
      sourceProductIds: ["https://www.levelshoes.com/aquazzura-tequila.html"],
    });
    const product = {
      source: "level-shoes",
      brand: "Aquazzura",
      productName: "Tequila",
      productUrl: "https://www.levelshoes.com/aquazzura-tequila.html",
      imageUrl: null,
      category: "OTHER_FOOTWEAR" as const,
      color: null,
      material: null,
      discoveredAt: "2026-08-21T00:00:00.000Z",
      sourceCategoryName: "Shoes",
      sourceCategoryId: "shoes",
      isNewArrivalsCollection: true,
      hasNewBadge: true,
      cleaned: { heelHeight: null, color: null },
      normalized: {
        category: "OTHER_FOOTWEAR" as const,
        colorFamily: "UNKNOWN",
        materialFamily: "UNKNOWN",
        heelType: "UNKNOWN",
        heelHeightGroup: "UNKNOWN",
        toeShape: "UNKNOWN",
        details: [],
        construction: [],
      },
    };
    const enriched = enrichFamilyWithSightings(family, [product]);
    expect(enriched.sourceSightings?.some((s) => s.sourceId === "level-shoes")).toBe(true);
    expect(enriched.sourceSightings?.some((s) => s.sourceKind === "LUXURY_MARKETPLACE")).toBe(true);
    expect(enriched.sourceSightings?.some((s) => s.sourceId === "aquazzura")).toBe(false);
  });
});
