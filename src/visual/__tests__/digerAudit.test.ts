import { describe, expect, it } from "vitest";

import type { ModelFamily } from "../../modelFamily/types";
import { resolveVisualBasicCategory } from "../basicCategories";
import { diagnoseDigerReason } from "../digerAudit";
import { PRIMARY_NAV_ITEMS } from "../../navigation/primaryNav";

function family(overrides: Partial<ModelFamily> = {}): ModelFamily {
  return {
    modelFamilyId: "test--shoe",
    brand: "UGG",
    canonicalName: "Classic",
    category: "OTHER_FOOTWEAR",
    primaryCategory: "UNCLASSIFIED",
    representativeProductId: "https://ugg.com/p",
    representativeImage: null,
    representativeImages: [],
    variantCount: 1,
    variants: [],
    allImages: [],
    sourceProductIds: ["https://ugg.com/p"],
    groupingConfidence: "HIGH",
    groupingReason: "test",
    ...overrides,
  };
}

describe("Visual DİĞER diagnostics", () => {
  it("records missing source category", () => {
    expect(diagnoseDigerReason(family({ sourceCategoryRefs: [] }))).toBe("MISSING_SOURCE_CATEGORY");
  });

  it("records unmapped source category", () => {
    expect(
      diagnoseDigerReason(
        family({
          sourceCategoryRefs: [
            {
              sourceId: "ugg",
              categoryId: "slides",
              categoryName: "Slides",
              categoryPath: "/collections/slides",
            },
          ],
        }),
      ),
    ).toBe("UNMAPPED_SOURCE_CATEGORY");
  });

  it("records conflicting source categories", () => {
    expect(
      diagnoseDigerReason(
        family({
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
        }),
      ),
    ).toBe("CONFLICTING_SOURCE_CATEGORIES");
  });

  it("resolves an obvious source alias such as Ballerinas", () => {
    expect(
      resolveVisualBasicCategory(
        family({
          sourceCategoryRefs: [
            {
              sourceId: "ugg",
              categoryId: "ballerinas",
              categoryName: "Ballerinas",
              categoryPath: "/collections/ballerinas",
            },
          ],
        }),
      ),
    ).toBe("babet");
  });

  it("uses primaryCategory as a safe fallback when source categories conflict", () => {
    expect(
      resolveVisualBasicCategory(
        family({
          primaryCategory: "SANDAL",
          sourceCategoryRefs: [
            {
              sourceId: "ugg",
              categoryId: "heels",
              categoryName: "Heels",
              categoryPath: "/collections/heels",
            },
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
  });

  it("keeps unsafe ambiguity as DİĞER", () => {
    expect(
      resolveVisualBasicCategory(
        family({
          sourceCategoryRefs: [
            {
              sourceId: "ugg",
              categoryId: "flat-shoes",
              categoryName: "Flat Shoes",
              categoryPath: "/collections/flat-shoes",
            },
          ],
        }),
      ),
    ).toBe("diger");
  });

  it("updates Visual basic category when source membership improves", () => {
    const missing = family({ sourceCategoryRefs: [] });
    expect(resolveVisualBasicCategory(missing)).toBe("diger");
    expect(
      resolveVisualBasicCategory(
        family({
          sourceCategoryRefs: [
            {
              sourceId: "ugg",
              categoryId: "trainers",
              categoryName: "Trainers",
              categoryPath: "/collections/trainers",
            },
          ],
        }),
      ),
    ).toBe("sneaker");
  });

  it("does not restore a startup full-catalog import", () => {
    expect(PRIMARY_NAV_ITEMS.map((item) => item.id)).toEqual([
      "brands",
      "marketplaces",
      "brand-automation",
      "visual-wall",
      "saved",
    ]);
  });
});
