import { describe, expect, it } from "vitest";
import { buildNormalizedSummary } from "../buildNormalizedSummary";
import type { NormalizedProductInsight } from "../types";

function product(
  overrides: Partial<NormalizedProductInsight>,
): NormalizedProductInsight {
  return {
    brand: "TEST",
    productName: "Test",
    productUrl: "https://example.com/a",
    imageUrl: null,
    category: "SANDAL",
    color: "Black",
    material: "Leather",
    toeShape: "ROUND",
    heelType: "STILETTO",
    details: ["WOVEN"],
    construction: [],
    surfaceEffects: [],
    confidence: {
      toeShape: null,
      heelType: null,
      details: null,
      construction: null,
      surfaceEffects: null,
    },
    analysisCoverage: { text: true, vision: false },
    sourceOfTruth: {
      color: "text",
      material: "text",
      category: "text",
      toeShape: "text",
      heelType: "text",
      details: "text",
      construction: "none",
      surfaceEffects: "none",
    },
    ...overrides,
  };
}

describe("buildNormalizedSummary provenance", () => {
  it("separates text-only and vision coverage counts", () => {
    const products = [
      product({ productUrl: "https://example.com/1" }),
      product({
        productUrl: "https://example.com/2",
        analysisCoverage: { text: true, vision: true },
        sourceOfTruth: {
          color: "text",
          material: "text",
          category: "text",
          toeShape: "vision",
          heelType: "vision",
          details: "vision",
          construction: "vision",
          surfaceEffects: "vision",
        },
        details: ["WOVEN"],
      }),
    ];

    const summary = buildNormalizedSummary(products);
    expect(summary.totalProducts).toBe(2);
    expect(summary.textAnalyzedProducts).toBe(2);
    expect(summary.visionAnalyzedProducts).toBe(1);
    expect(summary.fullHybridProducts).toBe(1);

    const woven = summary.topDetails.find((t) => t.tag === "WOVEN");
    expect(woven?.productCount).toBe(2);
    expect(woven?.textSourced).toBe(1);
    expect(woven?.visionSourced).toBe(1);
    expect(woven?.hybridProducts).toBe(1);
  });
});
