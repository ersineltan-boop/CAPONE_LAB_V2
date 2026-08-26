import { describe, expect, it } from "vitest";

import type { ModelFamily } from "../../modelFamily/types";
import { featureKnown, featureUnknown } from "../../taxonomy/featureHelpers";
import type { FootwearTaxonomyV1 } from "../../taxonomy/types";
import {
  CONSUMER_FOOTWEAR_CATEGORIES,
  SECONDARY_DISPLAY_CATEGORIES,
  getFilterFieldsForCategory,
} from "../categoryFilterConfig";
import { queryNewArrivals } from "../../newArrivals/query";
import {
  applyTaxonomyFilters,
  buildFacetGroups,
  filterFamiliesByCategory,
  isStandardFilterValue,
} from "../taxonomyFilters";
import { getCategoryLabel } from "../../presentation/turkishLabels";

function makeFamily(
  id: string,
  category: FootwearTaxonomyV1["primaryCategory"],
  taxonomyOverrides: Partial<FootwearTaxonomyV1> = {},
): ModelFamily {
  const taxonomy: FootwearTaxonomyV1 = {
    version: 1,
    primaryCategory: category,
    hybridInfluences: [],
    global: {
      toeShape: featureUnknown(),
      toeLength: featureUnknown(),
      toeOpening: featureUnknown(),
      backConstruction: featureUnknown(),
      vampHeight: featureUnknown(),
      heelHeightClass: featureUnknown(),
      heelHeightMm: featureUnknown(),
      heelType: featureUnknown(),
      soleProfile: featureUnknown(),
      platformConstruction: featureUnknown(),
      closureFeatures: featureUnknown(),
      strapFeatures: featureUnknown(),
      sideConstruction: featureUnknown(),
      hardwareType: featureUnknown(),
      hardwareIntensity: featureUnknown(),
      embellishmentFeatures: featureUnknown(),
      materialFamily: featureUnknown(),
      colorFamily: featureUnknown(),
      surfacePattern: featureUnknown(),
    },
    categorySpecific: {},
    derivedStyleTags: [],
    ...taxonomyOverrides,
  };

  return {
    modelFamilyId: id,
    brand: "TEST",
    canonicalName: id,
    category: null,
    primaryCategory: category,
    taxonomy,
    modelFamilyFirstSeenAt: "2026-08-19T00:00:00.000Z",
    representativeProductId: id,
    representativeImage: null,
    representativeImages: [],
    variantCount: 1,
    variants: [],
    allImages: [],
    sourceProductIds: [id],
    groupingConfidence: "HIGH",
    groupingReason: "test",
  };
}

describe("category filtering", () => {
  const balletSlingSquare = makeFamily("ballet-sling-square", "BALLET_FLAT", {
    global: {
      ...makeFamily("x", "BALLET_FLAT").taxonomy!.global,
      backConstruction: featureKnown("SLINGBACK", "PRODUCT_TEXT"),
      toeShape: featureKnown("SQUARE", "DERIVED"),
      toeLength: featureKnown("ELONGATED", "DERIVED"),
    },
  });

  const balletBackless = makeFamily("ballet-backless", "BALLET_FLAT", {
    global: {
      ...makeFamily("x", "BALLET_FLAT").taxonomy!.global,
      backConstruction: featureKnown("BACKLESS", "DERIVED"),
      toeShape: featureKnown("POINTED", "DERIVED"),
    },
  });

  const bootBiker = makeFamily("boot-biker", "BOOT", {
    global: {
      ...makeFamily("x", "BOOT").taxonomy!.global,
      toeShape: featureKnown("ROUND", "DERIVED"),
    },
    categorySpecific: {
      bootStyleFeatures: featureKnown(["BIKER", "CHELSEA"], "PRODUCT_TEXT"),
      shaftHeight: featureKnown("ANKLE", "PRODUCT_TEXT"),
    },
  });

  const pumpClosed = makeFamily("pump-closed", "PUMP", {
    global: {
      ...makeFamily("x", "PUMP").taxonomy!.global,
      backConstruction: featureUnknown(),
      toeShape: featureKnown("POINTED", "DERIVED"),
    },
  });

  const unclassified = makeFamily("unclassified", "UNCLASSIFIED");

  const families = [balletSlingSquare, balletBackless, bootBiker, pumpClosed, unclassified];

  it("BALLET_FLAT filter only returns BALLET_FLAT families", () => {
    const result = filterFamiliesByCategory(families, "BALLET_FLAT");
    expect(result).toHaveLength(2);
    expect(result.every((family) => family.primaryCategory === "BALLET_FLAT")).toBe(true);
  });

  it("SLINGBACK filter only returns known SLINGBACK families", () => {
    const result = applyTaxonomyFilters(families, [
      { field: "backConstruction", value: "SLINGBACK" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.modelFamilyId).toBe("ballet-sling-square");
  });

  it("toeShape=SQUARE + backConstruction=SLINGBACK uses AND logic", () => {
    const result = applyTaxonomyFilters(families, [
      { field: "backConstruction", value: "SLINGBACK" },
      { field: "toeShape", value: "SQUARE" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.modelFamilyId).toBe("ballet-sling-square");
  });

  it("multi-value bootStyleFeatures filter works", () => {
    const result = applyTaxonomyFilters(families, [
      { field: "bootStyleFeatures", value: "BIKER" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.modelFamilyId).toBe("boot-biker");
  });

  it("facet groups exclude zero-count and non-standard values", () => {
    const balletFamilies = filterFamiliesByCategory(families, "BALLET_FLAT");
    const groups = buildFacetGroups(balletFamilies, "BALLET_FLAT", []);
    const backGroup = groups.find((group) => group.field === "backConstruction");
    expect(backGroup?.values.map((entry) => entry.value)).toEqual(
      expect.arrayContaining(["SLINGBACK", "BACKLESS"]),
    );
    expect(backGroup?.values.some((entry) => entry.value === "CLOSED")).toBe(false);
    expect(backGroup?.values.some((entry) => entry.value === "UNKNOWN")).toBe(false);
  });

  it("UNKNOWN and NOT_APPLICABLE are not standard filter values", () => {
    expect(isStandardFilterValue("UNKNOWN")).toBe(false);
    expect(isStandardFilterValue("NOT_APPLICABLE")).toBe(false);
    expect(isStandardFilterValue("SLINGBACK")).toBe(true);
  });

  it("UNCLASSIFIED is omitted from filter navigation but shown as Diğer on the Categories index", () => {
    expect(CONSUMER_FOOTWEAR_CATEGORIES).not.toContain("UNCLASSIFIED");
    expect(CONSUMER_FOOTWEAR_CATEGORIES).toHaveLength(10);
    expect(SECONDARY_DISPLAY_CATEGORIES).toContain("UNCLASSIFIED");
  });

  it("category New Arrivals reuses scoped queryNewArrivals", () => {
    const arrivals = queryNewArrivals(families, {
      scope: { type: "CATEGORY", category: "BALLET_FLAT" },
      period: "90D",
      referenceDate: "2026-08-20T00:00:00.000Z",
    });
    expect(arrivals).toHaveLength(2);
    expect(arrivals.every((item) => item.primaryCategory === "BALLET_FLAT")).toBe(true);
  });

  it("Turkish labels render instead of raw enums", () => {
    expect(getCategoryLabel("BALLET_FLAT")).toBe("Babet");
    expect(getCategoryLabel("BOOT")).toBe("Bot / Çizme");
  });

  it("exposes category-aware filter fields for BALLET_FLAT and BOOT", () => {
    expect(getFilterFieldsForCategory("BALLET_FLAT")).toContain("backConstruction");
    expect(getFilterFieldsForCategory("BALLET_FLAT")).toContain("strapConfiguration");
    expect(getFilterFieldsForCategory("BOOT")).toContain("shaftHeight");
    expect(getFilterFieldsForCategory("BOOT")).toContain("bootStyleFeatures");
    expect(getFilterFieldsForCategory("UNCLASSIFIED")).toEqual([]);
  });
});
