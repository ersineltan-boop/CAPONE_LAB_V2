import { describe, expect, it } from "vitest";
import type { AnalyzedProduct } from "../../types/marketAnalysis";
import { mergeProductInsight } from "../mergeProductInsight";
import type { VisionProductRecord } from "../../vision/types";

function textProduct(
  overrides: Partial<AnalyzedProduct> = {},
): AnalyzedProduct {
  return {
    source: "test",
    brand: "TEST",
    productName: "Test Shoe",
    productUrl: "https://example.com/test",
    imageUrl: "https://example.com/test.jpg",
    category: "SANDAL",
    color: "Black",
    material: "Leather",
    toeShape: null,
    heelType: null,
    heelHeight: null,
    details: null,
    discoveredAt: "2026-08-18T00:00:00.000Z",
    cleaned: { heelHeight: "3cm", color: "Black" },
    normalized: {
      category: "SANDAL",
      colorFamily: "BLACK",
      materialFamily: "LEATHER",
      heelType: "STILETTO",
      heelHeightGroup: "MID",
      toeShape: "ROUND",
      details: ["BUCKLE"],
      construction: ["OPEN_TOE"],
    },
    ...overrides,
  };
}

const visionRecord: VisionProductRecord = {
  productUrl: "https://example.com/test",
  brand: "TEST",
  productName: "Test Shoe",
  imageUrl: "https://example.com/test.jpg",
  model: "gpt-5.6-terra",
  analyzedAt: "2026-08-18T00:00:00.000Z",
  vision: {
    toeShape: { value: "OPEN", confidence: 0.95 },
    heelType: { value: "STILETTO", confidence: 0.92 },
    details: [{ tag: "BOW", confidence: 0.88 }],
    construction: [{ tag: "SLINGBACK", confidence: 0.9 }],
    surfaceEffects: [{ tag: "PATENT", confidence: 0.85 }],
  },
};

describe("mergeProductInsight", () => {
  it("prioritizes text for color and material", () => {
    const merged = mergeProductInsight(textProduct(), visionRecord);
    expect(merged.color).toBe("Black");
    expect(merged.material).toBe("Leather");
    expect(merged.sourceOfTruth.color).toBe("text");
    expect(merged.sourceOfTruth.material).toBe("text");
    expect(merged.analysisCoverage).toEqual({ text: true, vision: true });
  });

  it("prioritizes high-confidence vision for toeShape and heelType", () => {
    const merged = mergeProductInsight(textProduct(), visionRecord);
    expect(merged.toeShape).toBe("OPEN");
    expect(merged.heelType).toBe("STILETTO");
    expect(merged.sourceOfTruth.toeShape).toBe("vision");
    expect(merged.sourceOfTruth.heelType).toBe("vision");
  });

  it("falls back to text when vision confidence is low", () => {
    const lowVision: VisionProductRecord = {
      ...visionRecord,
      vision: {
        ...visionRecord.vision,
        toeShape: { value: "SQUARE", confidence: 0.2 },
        heelType: { value: "WEDGE", confidence: 0.1 },
        details: [],
        construction: [],
        surfaceEffects: [],
      },
    };

    const merged = mergeProductInsight(textProduct(), lowVision);
    expect(merged.toeShape).toBe("ROUND");
    expect(merged.heelType).toBe("STILETTO");
    expect(merged.details).toEqual(["BUCKLE"]);
    expect(merged.sourceOfTruth.toeShape).toBe("text");
    expect(merged.sourceOfTruth.heelType).toBe("text");
  });

  it("marks text-only coverage when vision is unavailable", () => {
    const merged = mergeProductInsight(textProduct(), null);
    expect(merged.analysisCoverage).toEqual({ text: true, vision: false });
    expect(merged.toeShape).toBe("ROUND");
    expect(merged.heelType).toBe("STILETTO");
    expect(merged.surfaceEffects).toEqual([]);
    expect(merged.sourceOfTruth.surfaceEffects).toBe("none");
  });
});
