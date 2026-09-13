import { describe, expect, it } from "vitest";

import type { MarketResearchBrand } from "../types";
import { buildRomaniaCoverage, decideRomaniaRefresh } from "../romania/refreshGuard";

function brand(images: string[] = []): MarketResearchBrand {
  return {
    id: "mr-ro-test",
    name: "Test",
    entityKind: "brand",
    originCountry: "RO",
    originCountryLabel: "Romanya",
    salesMarket: "RO",
    markets: ["RO"],
    soldInSalesMarket: true,
    availability: "visible",
    sourceLinks: [{ label: "official", url: "https://example.com", kind: "brand" }],
    models: [{
      id: "model-1",
      name: "Model 1",
      categoryId: "loafer",
      categoryLabel: "Loafer",
      variants: [{
        id: "variant-1",
        color: "Black",
        productUrl: "https://example.com/p/1",
        images,
        currentPrice: 100,
        listPrice: 100,
        currency: "RON",
        discountPercent: 0,
        observedAt: "2026-09-14T00:00:00.000Z",
        visualStatus: images.length ? "has_images" : "model_unavailable",
      }],
    }],
  };
}

describe("Romania refresh guard", () => {
  it("reports exact source coverage after exclusions", () => {
    const coverage = buildRomaniaCoverage({
      sourceId: "test",
      sourceName: "Test",
      status: "ok",
      totalProducts: 120,
      excludedProducts: 20,
      collectedProducts: 100,
    });
    expect(coverage.missingProducts).toBe(0);
    expect(coverage.coveragePercent).toBe(100);
  });

  it("does not publish partial refresh and preserves last-good brand", () => {
    const previous = brand(["https://cdn.example.com/old.jpg"]);
    const candidate = brand(["https://cdn.example.com/new.jpg"]);
    const coverage = buildRomaniaCoverage({
      sourceId: "test",
      sourceName: "Test",
      status: "partial",
      totalProducts: 100,
      collectedProducts: 85,
    });
    const decision = decideRomaniaRefresh({
      previousBrands: [previous],
      candidates: [{ brand: candidate, coverage }],
    });
    expect(decision.publishable).toHaveLength(0);
    expect(decision.preservedLastGood).toEqual([previous]);
    expect(decision.complete).toBe(false);
  });

  it("keeps PR #17-style gallery when a complete refresh temporarily has no images", () => {
    const previous = brand([
      "https://cdn.example.com/old-1.jpg",
      "https://cdn.example.com/old-2.jpg",
    ]);
    const candidate = brand([]);
    const coverage = buildRomaniaCoverage({
      sourceId: "test",
      sourceName: "Test",
      status: "ok",
      totalProducts: 1,
      collectedProducts: 1,
    });
    const decision = decideRomaniaRefresh({
      previousBrands: [previous],
      candidates: [{ brand: candidate, coverage }],
    });
    expect(decision.publishable[0]?.brand.models[0]?.variants[0]?.images).toEqual(
      previous.models[0]?.variants[0]?.images,
    );
    expect(decision.complete).toBe(true);
  });

  it("treats an explicitly unavailable source as reconciled without fabricating products", () => {
    const coverage = buildRomaniaCoverage({
      sourceId: "blocked",
      sourceName: "Blocked source",
      status: "source_unavailable",
      collectedProducts: 0,
      note: "403",
    });
    const decision = decideRomaniaRefresh({
      previousBrands: [],
      candidates: [{ brand: brand([]), coverage }],
    });
    expect(decision.complete).toBe(true);
    expect(coverage.totalProducts).toBeNull();
    expect(coverage.coveragePercent).toBeNull();
  });
});
