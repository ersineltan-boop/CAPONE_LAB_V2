import { describe, expect, it } from "vitest";

import { buildFacetGroups, FILTER_COVERAGE_PRIMARY_THRESHOLD } from "../taxonomyFilters";
import { featureKnown, featureNotApplicable, featureUnknown } from "../../taxonomy/featureHelpers";
import type { ModelFamily } from "../../modelFamily/types";

function pumpFamily(id: string, toeKnown: boolean, toeApplicable = true): ModelFamily {
  const unknown = featureUnknown;
  return {
    modelFamilyId: id,
    brand: "TEST",
    canonicalName: id,
    category: "PUMP",
    primaryCategory: "PUMP",
    taxonomy: {
      version: 1,
      primaryCategory: "PUMP",
      hybridInfluences: [],
      global: {
        toeShape: toeKnown
          ? featureKnown("POINTED", "PRODUCT_TEXT")
          : toeApplicable
            ? unknown()
            : featureNotApplicable(),
        toeLength: unknown(),
        toeOpening: unknown(),
        backConstruction: unknown(),
        vampHeight: unknown(),
        heelHeightClass: unknown(),
        heelHeightMm: unknown(),
        heelType: unknown(),
        soleProfile: unknown(),
        platformConstruction: unknown(),
        closureFeatures: unknown(),
        strapFeatures: unknown(),
        sideConstruction: unknown(),
        hardwareType: unknown(),
        hardwareIntensity: unknown(),
        embellishmentFeatures: unknown(),
        materialFamily: unknown(),
        colorFamily: unknown(),
        surfacePattern: unknown(),
      },
      categorySpecific: {},
      derivedStyleTags: [],
    },
    representativeProductId: "x",
    representativeImage: null,
    representativeImages: [],
    variantCount: 1,
    variants: [],
    allImages: [],
    sourceProductIds: ["x"],
    groupingConfidence: "HIGH",
    groupingReason: "test",
  };
}

describe("filter coverage tiers", () => {
  it("assigns primary tier when coverage >= threshold", () => {
    const families = Array.from({ length: 10 }, (_, index) =>
      pumpFamily(`f-${index}`, index < 6),
    );
    const groups = buildFacetGroups(families, "PUMP", []);
    const toeGroup = groups.find((group) => group.field === "toeShape");
    expect(toeGroup?.tier).toBe("primary");
    expect(toeGroup!.coverage.percent).toBeGreaterThanOrEqual(FILTER_COVERAGE_PRIMARY_THRESHOLD);
  });

  it("assigns limited tier when coverage below threshold", () => {
    const families = Array.from({ length: 10 }, (_, index) =>
      pumpFamily(`f-${index}`, index < 1),
    );
    const groups = buildFacetGroups(families, "PUMP", []);
    const toeGroup = groups.find((group) => group.field === "toeShape");
    expect(toeGroup?.tier).toBe("limited");
  });
});
