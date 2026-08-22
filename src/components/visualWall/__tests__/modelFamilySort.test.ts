import { describe, expect, it } from "vitest";

import type { ModelFamily } from "../../../modelFamily/types";
import type { AnalyzedProduct } from "../../../types/marketAnalysis";
import {
  buildModelFamilySortIndex,
  computeModelFamilyDateStats,
  resolveProductSortDate,
  sortModelFamilies,
} from "../modelFamilySort";

function product(
  overrides: Partial<AnalyzedProduct> & { productUrl: string },
): AnalyzedProduct {
  return {
    source: "test",
    brand: "BRAND",
    productName: "Shoe",
    imageUrl: null,
    category: "PUMP",
    color: null,
    material: null,
    toeShape: null,
    heelType: null,
    heelHeight: null,
    details: null,
    discoveredAt: "2026-08-18T10:00:00.000Z",
    cleaned: { color: null, heelHeight: null },
    normalized: {
      category: "PUMP",
      colorFamily: "BLACK",
      materialFamily: "LEATHER",
      heelType: "STILETTO",
      heelHeightGroup: "HIGH",
      toeShape: "POINTED",
      details: [],
      construction: ["CLOSED_TOE"],
    },
    ...overrides,
  };
}

function family(
  overrides: Partial<ModelFamily> & { modelFamilyId: string },
): ModelFamily {
  return {
    brand: "BRAND A",
    canonicalName: "Model",
    category: "PUMP",
    representativeProductId: "https://x/1",
    representativeImage: null,
    representativeImages: [],
    variantCount: 1,
    variants: [],
    allImages: [],
    sourceProductIds: ["https://x/1"],
    groupingConfidence: "MEDIUM",
    groupingReason: "singleton",
    ...overrides,
  };
}

describe("modelFamilySort", () => {
  it("sorts newer model before older model globally", () => {
    const products = new Map<string, AnalyzedProduct>([
      ["https://x/new", product({ productUrl: "https://x/new", publishedAt: "2026-06-01T00:00:00.000Z" })],
      ["https://x/old", product({ productUrl: "https://x/old", publishedAt: "2024-01-01T00:00:00.000Z" })],
    ]);
    const families = [
      family({ modelFamilyId: "old", sourceProductIds: ["https://x/old"], brand: "BRAND Z" }),
      family({ modelFamilyId: "new", sourceProductIds: ["https://x/new"], brand: "BRAND A" }),
    ];
    const index = buildModelFamilySortIndex(families, products, new Map());
    const sorted = sortModelFamilies(families, index, "NEWEST");
    expect(sorted.map((entry) => entry.modelFamilyId)).toEqual(["new", "old"]);
  });

  it("prefers publishedAt over firstSeenAt", () => {
    const firstSeen = new Map([["https://x/1", "2026-08-18T10:00:00.000Z"]]);
    const resolved = resolveProductSortDate(
      product({
        productUrl: "https://x/1",
        publishedAt: "2025-01-01T00:00:00.000Z",
        discoveredAt: "2026-08-18T10:00:00.000Z",
      }),
      firstSeen,
    );
    expect(resolved.source).toBe("publishedAt");
    expect(resolved.timestamp).toBe(Date.parse("2025-01-01T00:00:00.000Z"));
  });

  it("uses firstSeenAt only when real release dates are missing", () => {
    const resolved = resolveProductSortDate(
      product({
        productUrl: "https://x/1",
        discoveredAt: "2026-08-18T10:00:00.000Z",
      }),
      new Map([["https://x/1", "2026-08-18T11:00:00.000Z"]]),
    );
    expect(resolved.source).toBe("firstSeenAt");
  });

  it("does not make old family artificially new when later variant is added", () => {
    const products = new Map<string, AnalyzedProduct>([
      [
        "https://x/original",
        product({
          productUrl: "https://x/original",
          publishedAt: "2024-03-01T00:00:00.000Z",
        }),
      ],
      [
        "https://x/new-color",
        product({
          productUrl: "https://x/new-color",
          discoveredAt: "2026-08-18T10:00:00.000Z",
        }),
      ],
      [
        "https://y/recent",
        product({
          productUrl: "https://y/recent",
          publishedAt: "2026-07-01T00:00:00.000Z",
        }),
      ],
    ]);
    const families = [
      family({
        modelFamilyId: "mixed",
        sourceProductIds: ["https://x/original", "https://x/new-color"],
      }),
      family({
        modelFamilyId: "recent",
        sourceProductIds: ["https://y/recent"],
        brand: "BRAND B",
      }),
    ];
    const index = buildModelFamilySortIndex(families, products, new Map());
    const sorted = sortModelFamilies(families, index, "NEWEST");
    expect(sorted[0]?.modelFamilyId).toBe("recent");
    expect(index.get("mixed")?.source).toBe("publishedAt");
    expect(index.get("mixed")?.sortTimestamp).toBe(
      Date.parse("2024-03-01T00:00:00.000Z"),
    );
  });

  it("sorts by brand then newest within brand", () => {
    const products = new Map<string, AnalyzedProduct>([
      ["https://a/1", product({ productUrl: "https://a/1", publishedAt: "2026-01-01T00:00:00.000Z", brand: "ALPHA" })],
      ["https://a/2", product({ productUrl: "https://a/2", publishedAt: "2025-01-01T00:00:00.000Z", brand: "ALPHA" })],
      ["https://b/1", product({ productUrl: "https://b/1", publishedAt: "2024-01-01T00:00:00.000Z", brand: "BETA" })],
    ]);
    const families = [
      family({ modelFamilyId: "b1", brand: "BETA", sourceProductIds: ["https://b/1"] }),
      family({ modelFamilyId: "a-old", brand: "ALPHA", sourceProductIds: ["https://a/2"] }),
      family({ modelFamilyId: "a-new", brand: "ALPHA", sourceProductIds: ["https://a/1"] }),
    ];
    const index = buildModelFamilySortIndex(families, products, new Map());
    const sorted = sortModelFamilies(families, index, "BY_BRAND");
    expect(sorted.map((entry) => entry.modelFamilyId)).toEqual([
      "a-new",
      "a-old",
      "b1",
    ]);
  });

  it("computes date source stats", () => {
    const index = buildModelFamilySortIndex(
      [
        family({ modelFamilyId: "a", sourceProductIds: ["https://x/1"] }),
        family({ modelFamilyId: "b", sourceProductIds: ["https://x/2"] }),
      ],
      new Map([
        ["https://x/1", product({ productUrl: "https://x/1", publishedAt: "2025-01-01T00:00:00.000Z" })],
        ["https://x/2", product({ productUrl: "https://x/2", discoveredAt: "2026-08-18T10:00:00.000Z" })],
      ]),
      new Map(),
    );
    const stats = computeModelFamilyDateStats(index);
    expect(stats.withPublishedOrCreatedAt).toBe(1);
    expect(stats.withFirstSeenFallback).toBe(1);
    expect(stats.unknown).toBe(0);
  });
});
