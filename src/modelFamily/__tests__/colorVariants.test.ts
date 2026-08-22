import { describe, expect, it } from "vitest";

import type { ModelFamily } from "../types";
import {
  colorVariantsForFamily,
  imagesForColorVariant,
  urlForColorVariant,
} from "../colorVariants";
import { selectVariantImages, selectVariantUrl } from "../../components/modelFamily/ModelFamilyProductGrid";

function family(overrides: Partial<ModelFamily> = {}): ModelFamily {
  return {
    modelFamilyId: "larroude--stella",
    brand: "LARROUDE",
    canonicalName: "Stella Sneaker",
    category: "SNEAKER",
    representativeProductId: "https://larroude.com/black",
    representativeImage: "https://cdn.example.com/black.jpg",
    representativeImages: ["https://cdn.example.com/black.jpg"],
    variantCount: 1,
    variants: [],
    allImages: ["https://cdn.example.com/black.jpg"],
    sourceProductIds: ["https://larroude.com/black"],
    groupingConfidence: "HIGH",
    groupingReason: "test",
    ...overrides,
  };
}

describe("color variants", () => {
  it("keeps a single-variant family as one card with no color control", () => {
    expect(colorVariantsForFamily(family())).toEqual([]);
  });

  it("exposes four colors as one family with variant count and source names", () => {
    const grouped = family({
      variantCount: 4,
      variants: [
        {
          productId: "https://larroude.com/black",
          title: "Stella Black",
          url: "https://larroude.com/black",
          color: "Black",
          material: null,
          images: ["https://cdn.example.com/black.jpg", "https://cdn.example.com/black-2.jpg"],
        },
        {
          productId: "https://larroude.com/cream",
          title: "Stella Cream",
          url: "https://larroude.com/cream",
          color: "Cream",
          material: null,
          images: ["https://cdn.example.com/cream.jpg"],
        },
        {
          productId: "https://larroude.com/silver",
          title: "Stella Silver",
          url: "https://larroude.com/silver",
          color: "Silver",
          material: null,
          images: ["https://cdn.example.com/silver.jpg"],
        },
        {
          productId: "https://larroude.com/burgundy",
          title: "Stella Burgundy",
          url: "https://larroude.com/burgundy",
          color: "Burgundy",
          material: null,
          images: ["https://cdn.example.com/burgundy.jpg"],
        },
        {
          productId: "https://larroude.com/burgundy-dup",
          title: "Stella Burgundy",
          url: "https://larroude.com/burgundy",
          color: "Burgundy",
          material: null,
          images: ["https://cdn.example.com/burgundy.jpg"],
        },
      ],
    });
    const variants = colorVariantsForFamily(grouped);
    expect(variants).toHaveLength(4);
    expect(variants.map((item) => item.color)).toEqual(["Black", "Cream", "Silver", "Burgundy"]);
    expect(imagesForColorVariant(grouped, variants[1]!.id)).toEqual([
      "https://cdn.example.com/cream.jpg",
    ]);
    expect(urlForColorVariant(grouped, variants[1]!.id)).toBe("https://larroude.com/cream");
    expect(selectVariantImages({ images: grouped.allImages, representativeImage: grouped.representativeImage, variants }, variants[0]!.id)[0]).toContain("black.jpg");
    expect(selectVariantUrl({ productUrl: grouped.representativeProductId, variants }, variants[2]!.id)).toBe(
      "https://larroude.com/silver",
    );
  });

  it("does not invent a color name when the source omitted it", () => {
    const grouped = family({
      variantCount: 2,
      variants: [
        {
          productId: "https://x/a",
          title: "Model",
          url: "https://x/a",
          color: null,
          material: null,
          images: ["https://cdn.example.com/a.jpg"],
        },
        {
          productId: "https://x/b",
          title: "Model",
          url: "https://x/b",
          color: null,
          material: null,
          images: ["https://cdn.example.com/b.jpg"],
        },
      ],
    });
    expect(colorVariantsForFamily(grouped).every((item) => item.color === null)).toBe(true);
  });
});
