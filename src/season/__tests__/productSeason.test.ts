import { describe, expect, it } from "vitest";

import type { ModelFamily } from "../../modelFamily/types";
import { deriveProductSeason, filterFamiliesBySeason, SEASON_OPTIONS } from "../productSeason";

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
  it("shows only SS, FW and COT as user-facing season buckets", () => {
    expect(SEASON_OPTIONS.map((option) => option.label)).toEqual(["Tüm sezonlar", "SS", "FW", "COT"]);
  });

  it("uses an explicit SS source label as confirmed evidence", () => {
    const result = deriveProductSeason(
      family({
        sourceCategoryRefs: [{ sourceId: "brand", categoryId: "ss27", categoryName: "Spring Summer 2027" }],
      }),
    );
    expect(result.season).toBe("SS27");
    expect(result.confidence).toBe("CONFIRMED");
    expect(result.confidenceScore).toBe(100);
  });

  it("uses an explicit FW source label as confirmed evidence", () => {
    const result = deriveProductSeason(
      family({
        canonicalName: "Test Loafer",
        primaryCategory: "LOAFER",
        sourceCategoryRefs: [{ sourceId: "brand", categoryId: "fw26", categoryName: "Fall Winter 2026/27" }],
      }),
    );
    expect(result.season).toBe("AW26_27");
    expect(result.confidence).toBe("CONFIRMED");
  });

  it("classifies a summer silhouette as SS without requiring a new-arrival flag", () => {
    const result = deriveProductSeason(family({ canonicalName: "Raffia Sandal" }));
    expect(result.season).toBe("SS27");
    expect(result.confidence).toBe("INFERRED");
    expect(result.confidenceScore).toBeGreaterThanOrEqual(84);
  });

  it("classifies a winter silhouette as FW", () => {
    const result = deriveProductSeason(
      family({ canonicalName: "Knee Boot", category: "BOOT", primaryCategory: "BOOT" }),
    );
    expect(result.season).toBe("AW26_27");
  });

  it("uses first-seen period for a verified-new trans-seasonal model", () => {
    const result = deriveProductSeason(
      family({
        canonicalName: "Test Sneaker",
        category: "SNEAKER",
        primaryCategory: "SNEAKER",
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
    expect(result.season).toBe("AW26_27");
    expect(result.lifecycle).toBe("NEW_ARRIVAL");
    expect(result.confidenceScore).toBe(68);
  });

  it("uses COT for evergreen products without a stronger seasonal signal", () => {
    const evergreen = family({
      modelFamilyId: "evergreen",
      canonicalName: "Classic Loafer",
      category: "LOAFER",
      primaryCategory: "LOAFER",
    });
    expect(deriveProductSeason(evergreen).season).toBe("CARRY_OVER");
  });

  it("classifies every family into SS, FW or COT and filters without mutating input", () => {
    const evergreen = family({
      modelFamilyId: "evergreen",
      canonicalName: "Classic Loafer",
      category: "LOAFER",
      primaryCategory: "LOAFER",
    });
    const summer = family({ modelFamilyId: "summer", canonicalName: "Raffia Sandal" });
    const winter = family({ modelFamilyId: "winter", canonicalName: "Knee Boot", category: "BOOT", primaryCategory: "BOOT" });
    const input = [evergreen, summer, winter];

    expect(input.map((item) => deriveProductSeason(item).season)).toEqual(["CARRY_OVER", "SS27", "AW26_27"]);
    expect(filterFamiliesBySeason(input, "SS27")).toEqual([summer]);
    expect(input).toHaveLength(3);
  });
});
