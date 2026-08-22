import { describe, expect, it } from "vitest";

import { computeFieldCoverage } from "../taxonomyCoverage";
import { featureKnown, featureNotApplicable, featureUnknown } from "../../taxonomy/featureHelpers";
import type { ModelFamily } from "../../modelFamily/types";

function familyWithToe(status: "KNOWN" | "UNKNOWN" | "NA"): ModelFamily {
  const toeShape =
    status === "KNOWN"
      ? featureKnown("POINTED", "PRODUCT_TEXT")
      : status === "NA"
        ? featureNotApplicable()
        : featureUnknown();

  return {
    modelFamilyId: "test",
    brand: "TEST",
    canonicalName: "Test",
    category: "PUMP",
    primaryCategory: "PUMP",
    taxonomy: {
      version: 1,
      primaryCategory: "PUMP",
      hybridInfluences: [],
      global: {
        toeShape: toeShape as import("../../taxonomy/types").TaxonomyFeature<import("../../taxonomy/types").ToeShapeTaxonomy>,
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

describe("taxonomyCoverage", () => {
  it("excludes NOT_APPLICABLE from applicable denominator", () => {
    const coverage = computeFieldCoverage(
      [familyWithToe("NA"), familyWithToe("UNKNOWN")],
      "toeShape",
    );
    expect(coverage.applicable).toBe(1);
    expect(coverage.known).toBe(0);
  });

  it("counts KNOWN in coverage", () => {
    const coverage = computeFieldCoverage(
      [familyWithToe("KNOWN"), familyWithToe("UNKNOWN")],
      "toeShape",
    );
    expect(coverage.known).toBe(1);
    expect(coverage.applicable).toBe(2);
    expect(coverage.percent).toBe(50);
  });
});
