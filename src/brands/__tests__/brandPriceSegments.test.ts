import { describe, expect, it } from "vitest";
import entries from "../brandPriceSegments.json";
import universe from "../../../data/registry/brand-universe.json";
import { BRAND_PRICE_SEGMENTS, brandPriceSegment, matchesBrandPriceSegment } from "../brandPriceSegments";
import { brandSummariesForIndex } from "../../catalog/brandIndexFromSummary";
import { countryGroupId } from "../countryGrouping";
import type { CatalogSummary } from "../../catalog/types";

describe("CAPONE brand price segments", () => {
  it("keeps reviewed classifications unique and independent of influence segments", () => {
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    const valid = new Set(BRAND_PRICE_SEGMENTS.map((segment) => segment.id));
    expect(entries.every((entry) => valid.has(entry.segment as typeof BRAND_PRICE_SEGMENTS[number]["id"]))).toBe(true);
    for (const entry of entries) {
      expect(universe.brands.find((brand) => brand.id === entry.id), entry.name).toBeDefined();
    }
    expect(brandPriceSegment("christen")).toBe("LUXURY");
    expect(universe.brands.find((brand) => brand.id === "christen")?.segment).toBe("DIRECTIONAL");
  });

  it("uses the same class for official IDs and marketplace brand names", () => {
    for (const entry of entries) {
      expect(brandPriceSegment(undefined, entry.name)).toBe(brandPriceSegment(entry.id));
    }
    expect(brandPriceSegment(undefined, "  Alaia  ")).toBe("LUXURY");
    expect(brandPriceSegment(undefined, "A. EMERY")).toBe("PREMIUM");
    expect(brandPriceSegment(undefined, "MASCARO")).toBe("PREMIUM");
    expect(brandPriceSegment(undefined, "TKEES")).toBe("MID_RANGE");
    expect(brandPriceSegment(undefined, "ZARA HOME")).toBeNull();
    expect(matchesBrandPriceSegment("all", undefined, "Unknown Brand")).toBe(true);
    expect(matchesBrandPriceSegment("MASS_MARKET", undefined, "Unknown Brand")).toBe(false);
  });

  it("intersects class with country and retains the existing brand order", () => {
    const brand = (brandId: string, country: string, productCount: number) => ({
      brandId, brandName: brandId, country, productCount, verifiedNewCount: 0, images: [],
    });
    const summary: CatalogSummary = { generatedAt: "2026-10-03", marketplaces: [], brands: [
      brand("aeyde", "Almanya", 10), brand("jil-sander", "Almanya", 20),
      brand("hereu", "İspanya", 30), brand("zara", "İspanya", 40),
    ] };
    expect(brandSummariesForIndex(summary, countryGroupId("Almanya"), "PREMIUM").map((brand) => brand.brandId)).toEqual(["aeyde"]);
    expect(brandSummariesForIndex(summary, undefined, "PREMIUM").map((brand) => brand.brandId)).toEqual(["hereu", "aeyde"]);
    expect(summary.brands.map((brand) => brand.brandId)).toEqual(["aeyde", "jil-sander", "hereu", "zara"]);
  });
});
