import { describe, expect, it } from "vitest";

import {
  buildRepresentativeImages,
  imageDedupeKey,
  isValidImageUrl,
  normalizeProductImageUrls,
  resolveProductImageUrls,
} from "../productImages";
import type { RawAnalyzedProduct } from "../types";

function product(
  overrides: Partial<RawAnalyzedProduct> & {
    productUrl: string;
  },
): RawAnalyzedProduct {
  return {
    source: "test",
    brand: "BRAND",
    productName: "Model",
    category: "PUMP",
    color: "Black",
    material: "Leather",
    imageUrl: "https://cdn.example.com/hero.jpg?v=1",
    discoveredAt: "2026-08-18T10:00:00.000Z",
    cleaned: { color: "Black", heelHeight: null },
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

describe("normalizeProductImageUrls", () => {
  it("filters empty and invalid urls", () => {
    expect(
      normalizeProductImageUrls([
        "",
        "   ",
        "not-a-url",
        "https://cdn.example.com/a.jpg",
      ]),
    ).toEqual(["https://cdn.example.com/a.jpg"]);
  });

  it("dedupes urls by pathname", () => {
    expect(
      normalizeProductImageUrls([
        "https://cdn.example.com/a.jpg?v=1",
        "https://cdn.example.com/a.jpg?v=2",
        "https://cdn.example.com/b.jpg",
      ]),
    ).toEqual([
      "https://cdn.example.com/a.jpg?v=1",
      "https://cdn.example.com/b.jpg",
    ]);
  });
});

describe("buildRepresentativeImages", () => {
  it("keeps representative hero image first", () => {
    const representative = product({
      productUrl: "https://x/1",
      imageUrl: "https://cdn.example.com/hero.jpg?v=1",
      images: [
        "https://cdn.example.com/side.jpg",
        "https://cdn.example.com/hero.jpg?v=2",
      ],
    });

    expect(buildRepresentativeImages(representative)).toEqual([
      "https://cdn.example.com/hero.jpg?v=1",
      "https://cdn.example.com/side.jpg",
    ]);
  });

  it("uses gallery sidecar only for representative product", () => {
    const representative = product({
      productUrl: "https://x/rep",
      imageUrl: "https://cdn.example.com/rep-hero.jpg",
    });
    const otherVariant = product({
      productUrl: "https://x/other",
      imageUrl: "https://cdn.example.com/other-hero.jpg",
    });

    const galleries = {
      "https://x/rep": [
        "https://cdn.example.com/rep-hero.jpg",
        "https://cdn.example.com/rep-side.jpg",
      ],
      "https://x/other": [
        "https://cdn.example.com/other-hero.jpg",
        "https://cdn.example.com/other-side.jpg",
      ],
    };

    expect(buildRepresentativeImages(representative, galleries)).toEqual([
      "https://cdn.example.com/rep-hero.jpg",
      "https://cdn.example.com/rep-side.jpg",
    ]);
    expect(resolveProductImageUrls(otherVariant, galleries)).toEqual([
      "https://cdn.example.com/other-hero.jpg",
      "https://cdn.example.com/other-side.jpg",
    ]);
    expect(buildRepresentativeImages(representative, galleries)).not.toContain(
      "https://cdn.example.com/other-side.jpg",
    );
  });
});

describe("isValidImageUrl", () => {
  it("accepts http(s) urls only", () => {
    expect(isValidImageUrl("https://cdn.example.com/a.jpg")).toBe(true);
    expect(isValidImageUrl("ftp://cdn.example.com/a.jpg")).toBe(false);
    expect(isValidImageUrl(null)).toBe(false);
  });
});

describe("imageDedupeKey", () => {
  it("ignores query string differences", () => {
    expect(
      imageDedupeKey("https://cdn.example.com/a.jpg?v=1"),
    ).toBe(imageDedupeKey("https://cdn.example.com/a.jpg?v=9"));
  });
});
