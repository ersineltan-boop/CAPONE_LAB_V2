import { describe, expect, it } from "vitest";

import { collectModelFamilyImages, imageUrlFingerprint } from "../familyImages";
import type { ModelFamily } from "../types";

function baseFamily(overrides: Partial<ModelFamily> = {}): ModelFamily {
  return {
    modelFamilyId: "test--model",
    brand: "TEST",
    canonicalName: "Model",
    category: null,
    representativeProductId: "https://example.com/a",
    representativeImage: "https://cdn.example/a.jpg",
    representativeImages: ["https://cdn.example/b.jpg"],
    variantCount: 1,
    variants: [],
    allImages: [],
    sourceProductIds: ["https://example.com/a"],
    groupingConfidence: "HIGH",
    groupingReason: "test",
    ...overrides,
  };
}

describe("familyImages", () => {
  it("deduplicates image URLs and keeps primary first", () => {
    const images = collectModelFamilyImages(
      baseFamily({
        representativeImage: "https://cdn.example/a.jpg",
        representativeImages: ["https://cdn.example/a.jpg", "https://cdn.example/b.jpg"],
      }),
    );
    expect(images).toEqual([
      "https://cdn.example/a.jpg",
      "https://cdn.example/b.jpg",
    ]);
  });

  it("one model family remains one image set", () => {
    const images = collectModelFamilyImages(baseFamily());
    expect(images.length).toBeGreaterThan(0);
    expect(new Set(images).size).toBe(images.length);
  });

  it("image fingerprint changes when image set changes", () => {
    const a = imageUrlFingerprint(["https://cdn.example/a.jpg"]);
    const b = imageUrlFingerprint([
      "https://cdn.example/a.jpg",
      "https://cdn.example/b.jpg",
    ]);
    expect(a).not.toBe(b);
  });
});
