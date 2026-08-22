import { describe, expect, it } from "vitest";

import { featureFromDerived, featureKnown, featureUnknown } from "../../featureHelpers";
import type { FootwearTaxonomyV1 } from "../../types";
import {
  isApprovedEnumValue,
  mergeVisionEnrichmentIntoTaxonomy,
  shouldAcceptVisionProposal,
} from "../mergeVisionEnrichment";
import type { TaxonomyVisionEnrichmentRecord } from "../types";

function baseTaxonomy(): FootwearTaxonomyV1 {
  const unknown = featureUnknown;
  return {
    version: 1,
    primaryCategory: "PUMP",
    hybridInfluences: [],
    global: {
      toeShape: unknown(),
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
  };
}

function proposal(
  field: string,
  value: string | null,
  confidence: number,
): TaxonomyVisionEnrichmentRecord["proposals"][number] {
  return { field, value, confidence, reasoning: null, imageIndexes: null };
}

function enrichment(proposals: TaxonomyVisionEnrichmentRecord["proposals"]): TaxonomyVisionEnrichmentRecord {
  return {
    modelFamilyId: "test--model",
    brand: "TEST",
    productName: "Pump",
    primaryCategory: "PUMP",
    imageUrls: ["https://cdn.example/a.jpg"],
    imageFingerprint: "fp",
    promptVersion: "taxonomy-v1-1",
    analyzedAt: new Date().toISOString(),
    provider: "openai",
    model: "test-model",
    cached: false,
    proposals,
    acceptedFields: [],
    rejectedFields: [],
    conflicts: [],
  };
}

describe("vision taxonomy merge", () => {
  it("accepts high-confidence IMAGE proposal for UNKNOWN field", () => {
    const decision = shouldAcceptVisionProposal(
      proposal("toeShape", "POINTED", 0.92),
      featureUnknown(),
    );
    expect(decision.accept).toBe(true);
  });

  it("rejects low-confidence proposal", () => {
    const decision = shouldAcceptVisionProposal(
      proposal("toeShape", "POINTED", 0.71),
      featureUnknown(),
    );
    expect(decision.accept).toBe(false);
  });

  it("does not overwrite PRODUCT_TEXT known values", () => {
    const decision = shouldAcceptVisionProposal(
      proposal("toeShape", "SQUARE", 0.95),
      featureKnown("POINTED", "PRODUCT_TEXT"),
    );
    expect(decision.accept).toBe(false);
  });

  it("rejects heelHeightMm from vision", () => {
    expect(
      shouldAcceptVisionProposal(
        proposal("heelHeightMm", "85", 0.99),
        featureUnknown(),
      ).accept,
    ).toBe(false);
  });

  it("rejects invalid enum values", () => {
    expect(isApprovedEnumValue("toeShape", "SHARP")).toBe(false);
  });

  it("does not replace MULE safe derived BACKLESS", () => {
    const decision = shouldAcceptVisionProposal(
      proposal("backConstruction", "CLOSED", 0.95),
      featureFromDerived("BACKLESS", 0.85),
    );
    expect(decision.accept).toBe(false);
  });

  it("merge fills UNKNOWN with accepted IMAGE values", () => {
    const merged = mergeVisionEnrichmentIntoTaxonomy(
      baseTaxonomy(),
      enrichment([proposal("toeShape", "SQUARE", 0.9)]),
    );
    expect(merged.global.toeShape.value).toBe("SQUARE");
    expect(merged.global.toeShape.source).toBe("IMAGE");
  });
});
