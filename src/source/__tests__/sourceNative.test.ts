import { describe, expect, it } from "vitest";

import {
  categoryFromCollectionPath,
  categoryFromProductFields,
  buildSourceCategoryRefs,
} from "../sourceCategories";
import {
  extractSourceCategories,
  filterFamiliesBySourceCategory,
  filterFamiliesForBrandOfficial,
  filterVerifiedNewForSource,
} from "../sourceProductQuery";
import { buildNewnessFromProductHints } from "../../newArrivals/detectNewness";
import type { ModelFamily } from "../../modelFamily/types";

function sampleFamily(overrides: Partial<ModelFamily> = {}): ModelFamily {
  return {
    modelFamilyId: "test--model",
    brand: "UGG",
    canonicalName: "Classic Boot",
    category: "BOOT",
    primaryCategory: "BOOT",
    representativeProductId: "https://ugg.com/p",
    representativeImage: null,
    representativeImages: [],
    variantCount: 1,
    variants: [],
    allImages: [],
    sourceProductIds: ["https://ugg.com/p"],
    sourceCategoryRefs: [
      {
        sourceId: "ugg",
        categoryId: "boots",
        categoryName: "Boots",
        categoryPath: "/collections/boots",
      },
      {
        sourceId: "mytheresa",
        categoryId: "boots",
        categoryName: "Boots",
        categoryPath: "/us/en/women/shoes/boots",
      },
    ],
    sourceSightings: [
      {
        sourceId: "ugg",
        sourceLabel: "UGG",
        firstSeenAt: "2026-08-19T00:00:00.000Z",
        lastSeenAt: "2026-08-19T00:00:00.000Z",
        sourceCategories: [{ categoryId: "boots", categoryName: "Boots", categoryPath: "/collections/boots" }],
      },
      {
        sourceId: "mytheresa",
        sourceLabel: "Mytheresa",
        firstSeenAt: "2026-08-20T00:00:00.000Z",
        lastSeenAt: "2026-08-20T00:00:00.000Z",
        sourceCategories: [{ categoryId: "boots", categoryName: "Boots", categoryPath: "/us/en/women/shoes/boots" }],
      },
    ],
    groupingConfidence: "HIGH",
    groupingReason: "test",
    ...overrides,
  };
}

describe("source-native categories", () => {
  it("derives category name from collection path", () => {
    const category = categoryFromCollectionPath("/collections/womens-shoes");
    expect(category?.categoryName).toBe("Womens Shoes");
  });

  it("builds source category refs from products", () => {
    const refs = buildSourceCategoryRefs("ugg", [
      {
        productUrl: "https://ugg.com/p",
        collectionPath: "/collections/boots",
        collectionLabel: "Boots",
      },
    ] as never);
    expect(refs[0]?.categoryName).toBe("Boots");
  });

  it("same family can have different source categories per source", () => {
    const family = sampleFamily();
    const uggCats = extractSourceCategories([family], "ugg");
    const mytheresaCats = extractSourceCategories([family], "mytheresa");
    expect(uggCats[0]?.categoryPath).toContain("/collections/boots");
    expect(mytheresaCats[0]?.categoryPath).toContain("/women/shoes/boots");
  });

  it("filters by source category", () => {
    const family = sampleFamily();
    expect(filterFamiliesBySourceCategory([family], "ugg", "boots")).toHaveLength(1);
    expect(filterFamiliesBySourceCategory([family], "ugg", "sandals")).toHaveLength(0);
  });

  it("brand browse does not require global taxonomy", () => {
    const family = sampleFamily({ taxonomy: undefined });
    expect(filterFamiliesForBrandOfficial([family], "UGG")).toHaveLength(1);
  });
});

describe("true new for source browse", () => {
  it("firstSeen alone is not verified new", () => {
    const family = sampleFamily({
      modelFamilyFirstSeenAt: "2026-08-19T00:00:00.000Z",
      sourceSightings: [
        {
          sourceId: "ugg",
          sourceLabel: "UGG",
          firstSeenAt: "2026-08-19T00:00:00.000Z",
          lastSeenAt: "2026-08-19T00:00:00.000Z",
          newness: {
            status: "NOT_VERIFIED",
            evidenceType: null,
            firstVerifiedAt: null,
            lastVerifiedAt: null,
            effectiveNewAt: null,
          },
        },
      ],
    });
    expect(filterVerifiedNewForSource([family], "ugg")).toHaveLength(0);
  });

  it("new arrivals collection evidence counts as verified new", () => {
    const newness = buildNewnessFromProductHints(
      { isNewArrivalsCollection: true, collectionPath: "/collections/new-arrivals" },
      "2026-08-21T00:00:00.000Z",
    );
    const family = sampleFamily({
      sourceSightings: [
        {
          sourceId: "ugg",
          sourceLabel: "UGG",
          firstSeenAt: "2026-08-19T00:00:00.000Z",
          lastSeenAt: "2026-08-21T00:00:00.000Z",
          newness,
        },
      ],
    });
    expect(filterVerifiedNewForSource([family], "ugg", "90D", undefined)).toHaveLength(1);
  });
});

describe("Mytheresa marketplace", () => {
  it("maps product fields to source category", () => {
    const category = categoryFromProductFields({
      sourceCategoryName: "Pumps",
      sourceCategoryPath: "/us/en/women/shoes/pumps",
      sourceCategoryUrl: "https://www.mytheresa.com/us/en/women/shoes/pumps",
    });
    expect(category?.categoryName).toBe("Pumps");
  });
});
