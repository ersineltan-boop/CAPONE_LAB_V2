import { describe, expect, it } from "vitest";

import { flattenBrandDisplayCategories } from "../flattenBrandCategories";
import { dedupeDisplayCategories } from "../dedupeDisplayCategories";
import {
  countFamiliesInCategory,
  extractSourceCategories,
  filterFamiliesBySourceCategory,
  filterVerifiedNewForSource,
} from "../sourceProductQuery";
import { UI_COPY } from "../../presentation/turkishLabels";
import type { ModelFamily } from "../../modelFamily/types";

function family(overrides: Partial<ModelFamily> = {}): ModelFamily {
  return {
    modelFamilyId: "ugg--classic",
    brand: "UGG",
    canonicalName: "Classic",
    category: "BOOT",
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
        categoryUrl: "https://ugg.com/collections/boots",
      },
    ],
    groupingConfidence: "HIGH",
    groupingReason: "test",
    ...overrides,
  };
}

describe("source-native category controls", () => {
  it("exposes clickable source categories and filters without a refresh", () => {
    const families = [
      family(),
      family({
        modelFamilyId: "ugg--sandal",
        canonicalName: "Sandal",
        sourceCategoryRefs: [
          {
            sourceId: "ugg",
            categoryId: "sandals",
            categoryName: "Sandals",
            categoryPath: "/collections/sandals",
            categoryUrl: "https://ugg.com/collections/sandals",
          },
        ],
      }),
    ];
    const categories = extractSourceCategories(families, "ugg");
    expect(categories.map((c) => c.categoryName).sort()).toEqual(["Boots", "Sandals"]);
    expect(filterFamiliesBySourceCategory(families, "ugg", "boots")).toHaveLength(1);
    expect(filterFamiliesBySourceCategory(families, "ugg", "sandals")[0]?.canonicalName).toBe(
      "Sandal",
    );
  });

  it("keeps Brand UI categories one-level/flat and clickable with TÜMÜ", () => {
    const nested = family({
      sourceCategoryRefs: [
        {
          sourceId: "ugg",
          categoryId: "ankle-boots",
          categoryName: "Women > Shoes > Boots > Ankle Boots",
          categoryPath: "/collections/ankle-boots",
          categoryUrl: "https://ugg.com/collections/ankle-boots",
        },
      ],
    });
    const categories = flattenBrandDisplayCategories(extractSourceCategories([nested, family()], "ugg"));
    expect(categories.every((category) => !category.categoryName.includes(">"))).toBe(true);
    expect(categories.map((c) => c.categoryName).sort()).toEqual(["Ankle Boots", "Bot / Çizme"]);
    expect(UI_COPY.categoryAllChip).toBe("TÜMÜ");
    expect(UI_COPY.categoriesHeading).toBe("KATEGORİLER");
  });

  it("counts unique Model Families and intersects verified new with a category", () => {
    const bootA = family({
      modelFamilyId: "ugg--classic-a",
      sourceCategoryRefs: [
        {
          sourceId: "ugg",
          categoryId: "boots",
          categoryName: "Boots",
          categoryPath: "/collections/boots",
          categoryUrl: "https://ugg.com/collections/boots",
        },
        {
          sourceId: "ugg",
          categoryId: "new-arrivals",
          categoryName: "New Arrivals",
          categoryPath: "/collections/new-arrivals",
          categoryUrl: "https://ugg.com/collections/new-arrivals",
        },
      ],
      sourceSightings: [
        {
          sourceId: "ugg",
          sourceLabel: "UGG",
          sourceKind: "BRAND_OFFICIAL",
          firstSeenAt: "2026-08-01T00:00:00.000Z",
          lastSeenAt: "2026-08-21T00:00:00.000Z",
          newness: {
            status: "VERIFIED_NEW",
            evidenceType: "NEW_ARRIVALS_COLLECTION",
            firstVerifiedAt: "2026-08-21T00:00:00.000Z",
            lastVerifiedAt: "2026-08-21T00:00:00.000Z",
            effectiveNewAt: "2026-08-21T00:00:00.000Z",
          },
        },
      ],
    });
    const bootB = family({
      modelFamilyId: "ugg--classic-b",
      sourceProductIds: ["https://ugg.com/p-b"],
      representativeProductId: "https://ugg.com/p-b",
    });
    const families = [bootA, bootB];
    expect(countFamiliesInCategory(families, "ugg", "boots")).toBe(2);
    const verified = filterVerifiedNewForSource(families, "ugg");
    expect(filterFamiliesBySourceCategory(verified, "ugg", "boots")).toHaveLength(1);
    const display = flattenBrandDisplayCategories(extractSourceCategories(families, "ugg"));
    expect(display.some((category) => /new arrival/i.test(category.categoryName))).toBe(false);
  });

  it("dedupes categories only when URL/identity matches", () => {
    const deduped = dedupeDisplayCategories([
      {
        categoryId: "boots",
        categoryName: "Boots",
        categoryPath: "/collections/boots",
        categoryUrl: "https://x/collections/boots",
      },
      {
        categoryId: "boots",
        categoryName: "Boots",
        categoryPath: "/collections/boots/",
        categoryUrl: "https://x/collections/boots",
      },
      {
        categoryId: "ankle-boots",
        categoryName: "Ankle Boots",
        categoryPath: "/collections/ankle-boots",
        categoryUrl: "https://x/collections/ankle-boots",
      },
    ]);
    expect(deduped).toHaveLength(2);
    expect(deduped.map((c) => c.categoryName)).toEqual(["Boots", "Ankle Boots"]);
  });
});
