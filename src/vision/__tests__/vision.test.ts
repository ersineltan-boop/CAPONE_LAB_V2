import { describe, expect, it } from "vitest";
import { parseVisionResponse } from "../openaiVision";
import {
  collectLowConfidence,
  detectConflicts,
  isTextToeUnknown,
  isVisionToeKnown,
  newlyDetectedDetailTags,
} from "../compareWithText";
import { summarizeTags } from "../buildReport";
import { selectPilotProducts } from "../selectProducts";
import type { AnalyzedProductInput, VisionFields, VisionProductRecord } from "../types";

function product(overrides: Partial<AnalyzedProductInput> = {}): AnalyzedProductInput {
  return {
    source: "test",
    brand: "ST. AGNI",
    productName: "Test Shoe",
    productUrl: "https://example.com/a",
    imageUrl: "https://example.com/a.jpg",
    category: "SANDAL",
    toeShape: null,
    heelType: null,
    details: null,
    normalized: {
      toeShape: "UNKNOWN",
      heelType: "UNKNOWN",
      details: [],
      construction: [],
    },
    ...overrides,
  };
}

const sampleVision: VisionFields = {
  toeShape: { value: "POINTED", confidence: 0.91 },
  heelType: { value: "STILETTO", confidence: 0.88 },
  details: [
    { tag: "BUCKLE", confidence: 0.84 },
    { tag: "WOVEN", confidence: 0.79 },
  ],
  construction: [{ tag: "OPEN_TOE", confidence: 0.86 }],
  surfaceEffects: [{ tag: "PATENT", confidence: 0.72 }],
};

describe("selectPilotProducts", () => {
  it("selects up to 10 products per target brand with images", () => {
    const products: AnalyzedProductInput[] = [];
    for (const brand of ["SCHUTZ", "TONY BIANCO", "ST. AGNI"] as const) {
      for (let i = 0; i < 12; i += 1) {
        products.push(
          product({
            brand,
            productUrl: `https://example.com/${brand}-${i}`,
            imageUrl: i % 11 === 0 ? null : `https://example.com/${brand}-${i}.jpg`,
          }),
        );
      }
    }

    const selected = selectPilotProducts(products);
    expect(selected).toHaveLength(30);
    expect(selected.filter((p) => p.brand === "SCHUTZ")).toHaveLength(10);
    expect(selected.filter((p) => p.brand === "TONY BIANCO")).toHaveLength(10);
    expect(selected.filter((p) => p.brand === "ST. AGNI")).toHaveLength(10);
  });

  it("skips only successful products in existing vision records", () => {
    const products = [
      product({ brand: "SCHUTZ", productUrl: "https://example.com/1" }),
      product({ brand: "SCHUTZ", productUrl: "https://example.com/2" }),
      product({ brand: "SCHUTZ", productUrl: "https://example.com/3" }),
    ];
    const existing: VisionProductRecord[] = [
      {
        productUrl: "https://example.com/1",
        brand: "SCHUTZ",
        productName: "Existing",
        imageUrl: "https://example.com/1.jpg",
        model: "gpt-5.6-terra",
        analyzedAt: "2026-08-18T00:00:00.000Z",
        vision: sampleVision,
      },
      {
        productUrl: "https://example.com/2",
        brand: "SCHUTZ",
        productName: "Failed",
        imageUrl: "https://example.com/2.jpg",
        model: "gpt-5.6-terra",
        analyzedAt: "2026-08-18T00:00:00.000Z",
        vision: sampleVision,
        error: "temporary failure",
      },
    ];

    const selected = selectPilotProducts(products, existing);
    expect(selected).toHaveLength(2);
    expect(selected.map((item) => item.productUrl)).toEqual([
      "https://example.com/2",
      "https://example.com/3",
    ]);
  });
});

describe("parseVisionResponse", () => {
  it("parses structured JSON output", () => {
    const json = JSON.stringify(sampleVision);
    const parsed = parseVisionResponse(json);
    expect(parsed.toeShape.value).toBe("POINTED");
    expect(parsed.details.map((d) => d.tag)).toContain("WOVEN");
  });

  it("clamps confidence values in sanitize output", () => {
    const parsed = parseVisionResponse(JSON.stringify(sampleVision));
    expect(parsed.toeShape.confidence).toBeLessThanOrEqual(1);
    expect(parsed.heelType.confidence).toBeLessThanOrEqual(1);
  });
});

describe("compareWithText", () => {
  it("detects toeShape conflicts without deleting text data", () => {
    const conflicts = detectConflicts(
      product({ normalized: { toeShape: "ROUND", heelType: "UNKNOWN", details: [], construction: [] } }),
      {
        ...sampleVision,
        toeShape: { value: "SQUARE", confidence: 0.9 },
      },
    );

    expect(conflicts.some((c) => c.field === "toeShape")).toBe(true);
  });

  it("tracks newly filled toeShape when text was UNKNOWN", () => {
    const p = product({
      normalized: { toeShape: "UNKNOWN", heelType: "UNKNOWN", details: [], construction: [] },
    });
    expect(isTextToeUnknown(p)).toBe(true);
    expect(isVisionToeKnown(sampleVision)).toBe(true);
  });

  it("finds newly detected details not present in text", () => {
    const tags = newlyDetectedDetailTags(
      product({ normalized: { toeShape: "UNKNOWN", heelType: "UNKNOWN", details: ["BOW"], construction: [] } }),
      sampleVision,
    );
    expect(tags).toContain("WOVEN");
    expect(tags).not.toContain("BOW");
  });

  it("collects low confidence fields", () => {
    const items = collectLowConfidence(product(), {
      ...sampleVision,
      heelType: { value: "WEDGE", confidence: 0.2 },
    });
    expect(items.some((i) => i.field === "heelType")).toBe(true);
  });
});

describe("summarizeTags", () => {
  it("summarizes top visual details across products", () => {
    const records: VisionProductRecord[] = [
      {
        productUrl: "https://example.com/1",
        brand: "ST. AGNI",
        productName: "A",
        imageUrl: "https://example.com/1.jpg",
        model: "gpt-5.6-terra",
        analyzedAt: "2026-08-18T00:00:00.000Z",
        vision: sampleVision,
      },
      {
        productUrl: "https://example.com/2",
        brand: "SCHUTZ",
        productName: "B",
        imageUrl: "https://example.com/2.jpg",
        model: "gpt-5.6-terra",
        analyzedAt: "2026-08-18T00:00:00.000Z",
        vision: {
          ...sampleVision,
          details: [{ tag: "WOVEN", confidence: 0.9 }],
        },
      },
    ];

    const summary = summarizeTags(records, (v) => v.details);
    expect(summary[0]?.tag).toBe("WOVEN");
    expect(summary[0]?.productCount).toBe(2);
  });
});
