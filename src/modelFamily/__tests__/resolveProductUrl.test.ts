import { describe, expect, it } from "vitest";

import { resolveModelFamilyProductUrl } from "../resolveProductUrl";

describe("resolveModelFamilyProductUrl", () => {
  it("returns representative product URL first", () => {
    const url = resolveModelFamilyProductUrl({
      modelFamilyId: "x",
      brand: "TEST",
      canonicalName: "Model",
      category: null,
      representativeProductId: "https://brand.com/products/shoe",
      representativeImage: null,
      representativeImages: [],
      variantCount: 1,
      variants: [{ productId: "v", title: "v", url: "https://other.com/x", color: null, material: null, images: [] }],
      allImages: [],
      sourceProductIds: ["https://brand.com/products/shoe"],
      groupingConfidence: "HIGH",
      groupingReason: "test",
    });
    expect(url).toBe("https://brand.com/products/shoe");
  });

  it("returns null when no valid URL exists", () => {
    const url = resolveModelFamilyProductUrl({
      modelFamilyId: "x",
      brand: "TEST",
      canonicalName: "Model",
      category: null,
      representativeProductId: "not-a-url",
      representativeImage: null,
      representativeImages: [],
      variantCount: 1,
      variants: [],
      allImages: [],
      sourceProductIds: [],
      groupingConfidence: "HIGH",
      groupingReason: "test",
    });
    expect(url).toBeNull();
  });
});
