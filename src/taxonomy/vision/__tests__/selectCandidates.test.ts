import { describe, expect, it } from "vitest";

import { isCacheHit } from "../cache";
import { selectVisionCandidates } from "../selectCandidates";
import type { ModelFamily } from "../../../modelFamily/types";
import { featureUnknown } from "../../featureHelpers";

function family(id: string, overrides: Partial<ModelFamily> = {}): ModelFamily {
  const unknown = featureUnknown;
  return {
    modelFamilyId: id,
    brand: "TEST",
    canonicalName: id,
    category: "PUMP",
    primaryCategory: "PUMP",
    representativeProductId: "https://example.com/" + id,
    representativeImage: "https://cdn.example/" + id + ".jpg",
    representativeImages: ["https://cdn.example/" + id + ".jpg"],
    variantCount: 1,
    variants: [],
    allImages: [],
    sourceProductIds: ["https://example.com/" + id],
    groupingConfidence: "HIGH",
    groupingReason: "test",
    taxonomy: {
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
    },
    modelFamilyFirstSeenAt: "2026-08-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("vision candidate selection", () => {
  it("excludes families without usable images", () => {
    const candidates = selectVisionCandidates(
      [
        family("no-image", {
          representativeImage: null,
          representativeImages: [],
          allImages: [],
        }),
        family("with-image"),
      ],
      5,
    );
    expect(candidates.some((entry) => entry.modelFamilyId === "with-image")).toBe(true);
    expect(candidates.some((entry) => entry.modelFamilyId === "no-image")).toBe(false);
  });

  it("cache hit requires matching fingerprint and prompt version", () => {
    expect(
      isCacheHit(
        {
          modelFamilyId: "a",
          brand: "TEST",
          productName: "A",
          primaryCategory: "PUMP",
          imageUrls: ["https://cdn.example/a.jpg"],
          imageFingerprint: "fp",
          promptVersion: "taxonomy-v1-1",
          analyzedAt: "",
          provider: "openai",
          model: "m",
          cached: true,
          proposals: [],
          acceptedFields: [],
          rejectedFields: [],
          conflicts: [],
        },
        "fp",
        "taxonomy-v1-1",
      ),
    ).toBe(true);
    expect(isCacheHit(undefined, "fp", "taxonomy-v1-1")).toBe(false);
  });
});
