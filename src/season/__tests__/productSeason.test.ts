import { describe, expect, it } from "vitest";

import type { ModelFamily } from "../../modelFamily/types";
import { deriveProductSeason, filterFamiliesBySeason } from "../productSeason";

function family(overrides: Partial<ModelFamily> = {}): ModelFamily {
  return {
    modelFamilyId: "family-1",
    brand: "Test",
    canonicalName: "Test Sandal",
    category: "SANDAL",
    primaryCategory: "SANDAL",
    representativeProductId: "p-1",
    representativeImage: null,
    representativeImages: [],
    variantCount: 1,
    variants: [],
    allImages: [],
    sourceProductIds: ["p-1"],
    groupingConfidence: "HIGH",
    groupingReason: "test",
    ...overrides,
  };
}

describe("product season", () => {
  it("uses an explicit SS27 source label as confirmed evidence", () => {
    const result = deriveProductSeason(
      family({
        sourceCategoryRefs: [{ sourceId: "brand", categoryId: "ss27", categoryName: "Spring Summer 2027" }],
      }),
    );
    expect(result.season).toBe("SS27");
    expect(result.confidence).toBe("CONFIRMED");
  });

  it("infers SS27 only for a verified-new summer family in the launch window", () => {
    const result = deriveProductSeason(
      family({
        modelFamilyFirstSeenAt: "2026-09-10T00:00:00.000Z",
        sourceSightings: [{
          sourceId: "brand",
          sourceLabel: "Test",
          firstSeenAt: "2026-09-10T00:00:00.000Z",
          lastSeenAt: "2026-09-10T00:00:00.000Z",
          newness: {
            status: "VERIFIED_NEW",
            evidenceType: "NEW_BADGE",
            firstVerifiedAt: "2026-09-10T00:00:00.000Z",
            lastVerifiedAt: "2026-09-10T00:00:00.000Z",
            evidenceText: "New",
            effectiveNewAt: "2026-09-10T00:00:00.000Z",
          },
        }],
      }),
    );
    expect(result.season).toBe("SS27");
    expect(result.confidence).toBe("INFERRED");
    expect(result.lifecycle).toBe("NEW_ARRIVAL");
  });

  it("keeps weak evidence unknown and filters without mutating input", () => {
    const unknown = family({ modelFamilyId: "unknown", primaryCategory: "SNEAKER" });
    const confirmed = family({
      modelFamilyId: "confirmed",
      sourceCategoryRefs: [{ sourceId: "brand", categoryId: "ss27", categoryName: "SS27" }],
    });
    const input = [unknown, confirmed];
    expect(filterFamiliesBySeason(input, "SS27")).toEqual([confirmed]);
    expect(input).toHaveLength(2);
    expect(deriveProductSeason(unknown).season).toBe("UNKNOWN");
  });
});
