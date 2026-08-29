import { describe, expect, it } from "vitest";

import {
  ALL_COUNTRIES_ID,
  UNKNOWN_COUNTRY_ID,
  UNKNOWN_COUNTRY_LABEL,
  buildCountryFilterOptions,
  countryDisplayLabel,
  countryGroupId,
  filterBrandsByCountry,
  isMissingCountry,
} from "../countryGrouping";
import { brandCardLayout, selectBrandCardImages } from "../brandCardImages";
import type { ModelFamily } from "../../modelFamily/types";

describe("brand country grouping", () => {
  it("filters brands by registry country", () => {
    const brands = [
      { country: "Italy" },
      { country: "İtalya" },
      { country: "France" },
    ];
    const italy = countryGroupId("Italy");
    expect(filterBrandsByCountry(brands, italy)).toHaveLength(2);
    expect(filterBrandsByCountry(brands, ALL_COUNTRIES_ID)).toHaveLength(3);
    expect(countryDisplayLabel("Italy")).toBe("İtalya");
  });

  it("puts missing and GLOBAL countries in the unknown fallback", () => {
    expect(isMissingCountry("")).toBe(true);
    expect(isMissingCountry("GLOBAL")).toBe(true);
    expect(countryGroupId("")).toBe(UNKNOWN_COUNTRY_ID);
    expect(countryDisplayLabel("")).toBe(UNKNOWN_COUNTRY_LABEL);
    const options = buildCountryFilterOptions([
      { country: "ABD" },
      { country: "" },
      { country: "GLOBAL" },
    ]);
    expect(options.some((option) => option.id === UNKNOWN_COUNTRY_ID)).toBe(true);
    expect(options.some((option) => option.label === "GLOBAL")).toBe(false);
  });
});

describe("brand card collage", () => {
  function family(id: string, images: string[]): ModelFamily {
    return {
      modelFamilyId: id,
      brand: "TEST",
      canonicalName: id,
      category: "PUMP",
      representativeProductId: `https://x/${id}`,
      representativeImage: images[0] ?? null,
      representativeImages: images,
      variantCount: 1,
      variants: [],
      allImages: images,
      sourceProductIds: [`https://x/${id}`],
      groupingConfidence: "HIGH",
      groupingReason: "test",
    };
  }

  it("prefers packshot-like URLs over crop_new and Scene7 _b views", () => {
    const images = selectBrandCardImages([
      family("crop", [
        "https://ancientgreeksandals.com/cdn/shop/files/crop_new_hero.jpg",
      ]),
      family("pack", [
        "https://cdn.shopify.com/s/files/1/1/products/pump_e.jpg",
      ]),
    ]);
    expect(images[0]).toContain("pump_e.jpg");
  });

  it("prefers a footwear packshot when a neutral low-score image competes", () => {
    const images = selectBrandCardImages([
      family("neutral", [
        "https://static.zara.net/assets/public/aa/bb/hash/hash.jpg",
      ]),
      family("pack", [
        "https://static.zara.net/assets/public/8845/b619/6442442eb52f/5741da5c60c1/11000810017-e1/11000810017-e1.jpg",
      ]),
    ]);
    expect(images[0]).toContain("11000810017-e1");
  });

  it("uses a single strongest hero image for brand index cards", () => {
    const images = selectBrandCardImages([
      family("a", [
        "https://cdn.shopify.com/s/files/1/1/products/a_100x.jpg",
        "https://cdn.shopify.com/s/files/1/1/products/a.jpg",
      ]),
      family("b", ["https://cdn.shopify.com/s/files/1/1/products/b.jpg"]),
      family("c", ["https://cdn.shopify.com/s/files/1/1/products/c.jpg"]),
    ]);
    expect(images).toHaveLength(1);
    expect(brandCardLayout(3)).toBe("one");
    expect(brandCardLayout(1)).toBe("one");
  });
});
