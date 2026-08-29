import { describe, expect, it } from "vitest";

import type { ModelFamily } from "../../modelFamily/types";
import { createNotVerifiedNewness } from "../../newArrivals/newness";
import {
  countFamiliesByBasicCategory,
  mapSourceCategoryToVisual,
  resolveVisualBasicCategory,
  VISUAL_BASIC_CATEGORIES,
} from "../basicCategories";
import { buildVisualDelivery, filterVisualCards } from "../buildVisualDelivery";
import { nextVisibleCount } from "../../ui/progressiveBatch";
import { PAZAR_OZETI_ENABLED } from "../../components/visualWall/visualWallSections";
import { PRIMARY_NAV_ITEMS } from "../../navigation/primaryNav";

function family(overrides: Partial<ModelFamily> = {}): ModelFamily {
  return {
    modelFamilyId: "ugg--classic",
    brand: "UGG",
    canonicalName: "Classic",
    category: "BOOT",
    representativeProductId: "https://ugg.com/p",
    representativeImage: "https://ugg.com/a.jpg",
    representativeImages: ["https://ugg.com/a.jpg"],
    variantCount: 1,
    variants: [],
    allImages: ["https://ugg.com/a.jpg"],
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
    sourceSightings: [
      {
        sourceId: "ugg",
        sourceLabel: "UGG",
        sourceKind: "BRAND_OFFICIAL",
        firstSeenAt: "2026-08-01T00:00:00.000Z",
        lastSeenAt: "2026-08-21T00:00:00.000Z",
        newness: createNotVerifiedNewness(),
      },
    ],
    ...overrides,
  };
}

describe("Visual basic categories", () => {
  it("exposes only the basic footwear level and no Pazar Özeti", () => {
    expect(PRIMARY_NAV_ITEMS.map((item) => item.label)).toContain("VISUAL");
    expect(PAZAR_OZETI_ENABLED).toBe(false);
    expect(VISUAL_BASIC_CATEGORIES.map((item) => item.label)).toEqual([
      "TÜMÜ",
      "BABET",
      "LOAFER",
      "TOPUKLU",
      "SANDAL",
      "MULE",
      "BOT / ÇİZME",
      "SNEAKER",
      "ESPADRİL",
      "OXFORD / DERBY",
      "CLOG",
      "DİĞER",
    ]);
    expect(VISUAL_BASIC_CATEGORIES.some((item) => /slingback|ankle boot|kitten/i.test(item.label))).toBe(
      false,
    );
  });

  it("maps source ballet to BABET and ankle boots to BOT / ÇİZME", () => {
    expect(
      mapSourceCategoryToVisual({
        categoryId: "ballet",
        categoryName: "Ballet Flats",
        categoryPath: "/collections/ballet-flats",
      }),
    ).toBe("babet");
    expect(
      mapSourceCategoryToVisual({
        categoryId: "ankle-boots",
        categoryName: "Ankle Boots",
        categoryPath: "/collections/ankle-boots",
      }),
    ).toBe("bot-cizme");
  });

  it("prefers confident primaryCategory over a conflicting source collection", () => {
    expect(
      resolveVisualBasicCategory(
        family({
          primaryCategory: "PUMP",
          sourceCategoryRefs: [
            {
              sourceId: "schutz",
              categoryId: "sandals",
              categoryName: "Sandals",
              categoryPath: "/collections/sandals",
            },
          ],
        }),
      ),
    ).toBe("topuklu");
    expect(
      resolveVisualBasicCategory(
        family({
          primaryCategory: "BALLET_FLAT",
          sourceCategoryRefs: [
            {
              sourceId: "schutz",
              categoryId: "loafers",
              categoryName: "Loafers",
              categoryPath: "/collections/loafers",
            },
          ],
        }),
      ),
    ).toBe("babet");
  });

  it("does not land an explicit sneaker in Babet", () => {
    expect(
      resolveVisualBasicCategory(
        family({
          canonicalName: "Tricia Sneaker",
          category: "BALLERINA",
          primaryCategory: "SNEAKER",
          sourceCategoryRefs: [
            {
              sourceId: "dolce-vita",
              categoryId: "ballet-flats",
              categoryName: "Ballet Flats",
              categoryPath: "/collections/ballet-flats",
            },
          ],
        }),
      ),
    ).toBe("sneaker");
  });

  it("does not land an explicit pump in Sandal", () => {
    expect(
      resolveVisualBasicCategory(
        family({
          canonicalName: "Slim 2 0 Fishbone Pump",
          category: "SANDAL",
          primaryCategory: "PUMP",
          sourceCategoryRefs: [
            {
              sourceId: "farfetch",
              categoryId: "sandals",
              categoryName: "Sandals",
              categoryPath: "/shopping/women/sandals",
            },
          ],
        }),
      ),
    ).toBe("topuklu");
  });

  it("uses source collection only when primaryCategory is unclassified", () => {
    expect(
      resolveVisualBasicCategory(
        family({
          primaryCategory: "UNCLASSIFIED",
          sourceCategoryRefs: [
            {
              sourceId: "ugg",
              categoryId: "sandals",
              categoryName: "Sandals",
              categoryPath: "/collections/sandals",
            },
          ],
        }),
      ),
    ).toBe("sandal");
    expect(
      mapSourceCategoryToVisual({
        categoryId: "women-shoes",
        categoryName: "Women Shoes",
        categoryPath: "/collections/women-shoes",
      }),
    ).toBeNull();
  });

  it("maps ambiguous source categories to DİĞER", () => {
    const mixed = family({
      sourceCategoryRefs: [
        {
          sourceId: "ugg",
          categoryId: "boots",
          categoryName: "Boots",
          categoryPath: "/collections/boots",
        },
        {
          sourceId: "ugg",
          categoryId: "sandals",
          categoryName: "Sandals",
          categoryPath: "/collections/sandals",
        },
      ],
    });
    expect(resolveVisualBasicCategory(mixed)).toBe("diger");
    expect(
      mapSourceCategoryToVisual({
        categoryId: "shoes",
        categoryName: "Shoes",
        categoryPath: "/collections/shoes",
      }),
    ).toBeNull();
  });

  it("prefers a structural type over generic Heels/Platforms/Flats", () => {
    expect(
      mapSourceCategoryToVisual({
        categoryId: "platform-sandals",
        categoryName: "Platform Sandals",
        categoryPath: "/collections/platform-sandals",
      }),
    ).toBe("sandal");
    expect(
      mapSourceCategoryToVisual({
        categoryId: "platform-loafers",
        categoryName: "Platform Loafers",
        categoryPath: "/collections/platform-loafers",
      }),
    ).toBe("loafer");
    expect(
      mapSourceCategoryToVisual({
        categoryId: "heeled-mule",
        categoryName: "Heeled Mule",
        categoryPath: "/collections/heeled-mule",
      }),
    ).toBe("mule");
    expect(
      mapSourceCategoryToVisual({
        categoryId: "ballet-mary-janes",
        categoryName: "Ballet Flats & Mary-Janes",
        categoryPath: "/collections/ballet-flats-mary-janes",
      }),
    ).toBe("babet");
    expect(
      mapSourceCategoryToVisual({
        categoryId: "knee-high-boots",
        categoryName: "Knee-High Boots",
        categoryPath: "/collections/knee-high-boots",
      }),
    ).toBe("bot-cizme");

    expect(
      resolveVisualBasicCategory(
        family({
          sourceCategoryRefs: [
            {
              sourceId: "jc",
              categoryId: "platform-sandals",
              categoryName: "Platform Sandals",
              categoryPath: "/collections/platform-sandals",
            },
            {
              sourceId: "jc",
              categoryId: "heels",
              categoryName: "Heels",
              categoryPath: "/collections/heels",
            },
          ],
        }),
      ),
    ).toBe("sandal");
    expect(
      resolveVisualBasicCategory(
        family({
          sourceCategoryRefs: [
            {
              sourceId: "jc",
              categoryId: "knee-high-boots",
              categoryName: "Knee-High Boots",
              categoryPath: "/collections/knee-high-boots",
            },
            {
              sourceId: "jc",
              categoryId: "heels",
              categoryName: "Heels",
              categoryPath: "/collections/heels",
            },
          ],
        }),
      ),
    ).toBe("bot-cizme");
  });

  it("collapses many raw source categories into the shared basic set without double counting", () => {
    const families = [
      family({
        modelFamilyId: "jc--a",
        sourceCategoryRefs: [
          { sourceId: "ugg", categoryId: "knee-high-boots", categoryName: "Knee-High Boots", categoryPath: "/collections/knee-high" },
          { sourceId: "ugg", categoryId: "shop-all-boots", categoryName: "Shop All Boots", categoryPath: "/collections/shop-all-boots" },
          { sourceId: "ugg", categoryId: "wide-shaft", categoryName: "Wide Shaft Boots", categoryPath: "/collections/wide-shaft" },
          { sourceId: "ugg", categoryId: "heels", categoryName: "Heels", categoryPath: "/collections/heels" },
        ],
      }),
      family({
        modelFamilyId: "jc--b",
        sourceCategoryRefs: [
          { sourceId: "ugg", categoryId: "pumps", categoryName: "Pumps", categoryPath: "/collections/pumps" },
        ],
      }),
    ];
    const chips = countFamiliesByBasicCategory(families);
    expect(chips.map((item) => item.id)).toEqual(["tumu", "topuklu", "bot-cizme"]);
    expect(chips.find((item) => item.id === "tumu")?.count).toBe(2);
    expect(chips.find((item) => item.id === "bot-cizme")?.count).toBe(1);
    expect(chips.find((item) => item.id === "topuklu")?.count).toBe(1);
    expect(resolveVisualBasicCategory(families[0]!)).toBe("bot-cizme");
    expect(families[0]!.sourceCategoryRefs).toHaveLength(4);
  });

  it("emits one card per Model Family and canonical category counts", () => {
    const families = [
      family(),
      family({ modelFamilyId: "ugg--classic-dup", sourceProductIds: ["https://ugg.com/p2"] }),
      family({
        modelFamilyId: "ugg--sandal",
        canonicalName: "Sandal",
        sourceCategoryRefs: [
          {
            sourceId: "ugg",
            categoryId: "sandals",
            categoryName: "Sandals",
            categoryPath: "/collections/sandals",
          },
        ],
      }),
    ];
    const visual = buildVisualDelivery({ families });
    expect(visual.summary.totalCount).toBe(3);
    expect(visual.shards.find((shard) => shard.id === "tumu")?.cards).toHaveLength(3);
    const ids = visual.shards.find((shard) => shard.id === "tumu")?.cards.map((card) => card.modelFamilyId);
    expect(new Set(ids).size).toBe(3);
    expect(visual.summary.categories.find((item) => item.id === "bot-cizme")?.count).toBe(2);
    expect(visual.summary.categories.find((item) => item.id === "sandal")?.count).toBe(1);
  });

  it("intersects search with the selected Visual category", () => {
    const visual = buildVisualDelivery({
      families: [
        family({ brand: "JEFFREY CAMPBELL", canonicalName: "Pump" }),
        family({
          modelFamilyId: "ugg--other",
          brand: "UGG",
          canonicalName: "Classic Mini",
        }),
      ],
    });
    const boots = visual.shards.find((shard) => shard.id === "bot-cizme")!.cards;
    expect(filterVisualCards(boots, "jeffrey")).toHaveLength(1);
    expect(filterVisualCards(boots, "mini")).toHaveLength(1);
    expect(filterVisualCards(boots, "missing")).toHaveLength(0);
  });

  it("grows Visual progressive batches 48 → 96", () => {
    expect(nextVisibleCount(48, 48, 200)).toBe(96);
  });
});
