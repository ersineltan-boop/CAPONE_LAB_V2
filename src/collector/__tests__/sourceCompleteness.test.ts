import { describe, expect, it } from "vitest";

import { mergeProductCatalog } from "../mergeProducts";
import { shopifyProductToPilot } from "../shopify";
import { isWomensFootwearCollection } from "../shopifyCollectionMembership";
import { slimFamilyForDelivery } from "../../catalog/slimFamily";
import { MAX_DELIVERY_IMAGES } from "../../catalog/types";
import { flattenBrandDisplayCategories } from "../../source/flattenBrandCategories";
import { extractSourceCategories } from "../../source/sourceProductQuery";
import { PRODUCT_PHOTO_FIT_CLASS } from "../../components/visualWall/VisualWallImageCarousel";
import type { PilotProduct } from "../types";
import type { ModelFamily } from "../../modelFamily/types";
import { resolveProductImageUrls } from "../../modelFamily/productImages";

function product(overrides: Partial<PilotProduct> & Pick<PilotProduct, "productUrl">): PilotProduct {
  return {
    source: "jeffrey-campbell",
    brand: "JEFFREY CAMPBELL",
    productName: "Lita",
    productUrl: overrides.productUrl,
    imageUrl: "https://cdn.shopify.com/s/files/1/1/products/a.jpg",
    images: ["https://cdn.shopify.com/s/files/1/1/products/a.jpg"],
    category: "BOOT",
    color: null,
    material: null,
    toeShape: null,
    heelType: null,
    heelHeight: null,
    details: null,
    discoveredAt: "2026-08-01T00:00:00.000Z",
    variants: [],
    ...overrides,
  };
}

function family(overrides: Partial<ModelFamily> = {}): ModelFamily {
  return {
    modelFamilyId: "jeffrey-campbell--lita",
    brand: "JEFFREY CAMPBELL",
    canonicalName: "Lita",
    category: "BOOT",
    representativeProductId: "https://jeffreycampbellshoes.com/products/lita",
    representativeImage: "https://cdn.shopify.com/s/files/1/1/products/a.jpg",
    representativeImages: [
      "https://cdn.shopify.com/s/files/1/1/products/a.jpg",
      "https://cdn.shopify.com/s/files/1/1/products/b.jpg",
    ],
    variantCount: 1,
    variants: [
      {
        productId: "https://jeffreycampbellshoes.com/products/lita",
        title: "Lita",
        url: "https://jeffreycampbellshoes.com/products/lita",
        images: [
          "https://cdn.shopify.com/s/files/1/1/products/a.jpg",
          "https://cdn.shopify.com/s/files/1/1/products/b.jpg",
          "https://cdn.shopify.com/s/files/1/1/products/c.jpg",
        ],
      },
    ],
    allImages: [
      "https://cdn.shopify.com/s/files/1/1/products/a.jpg",
      "https://cdn.shopify.com/s/files/1/1/products/b.jpg",
    ],
    sourceProductIds: ["https://jeffreycampbellshoes.com/products/lita"],
    groupingConfidence: "HIGH",
    groupingReason: "test",
    sourceCategoryRefs: [
      {
        sourceId: "jeffrey-campbell",
        categoryId: "boots",
        categoryName: "Boots",
        categoryPath: "/collections/boots",
      },
      {
        sourceId: "jeffrey-campbell",
        categoryId: "pumps",
        categoryName: "Pumps",
        categoryPath: "/collections/pumps",
      },
    ],
    ...overrides,
  };
}

describe("source category completeness", () => {
  it("retains multiple source category memberships on one product", () => {
    const boots = product({
      productUrl: "https://jeffreycampbellshoes.com/products/lita",
      sourceCategories: [
        {
          categoryId: "boots",
          categoryName: "Boots",
          categoryPath: "/collections/boots",
        },
      ],
    });
    const pumps = product({
      productUrl: "https://jeffreycampbellshoes.com/products/lita",
      sourceCategories: [
        {
          categoryId: "pumps",
          categoryName: "Pumps",
          categoryPath: "/collections/pumps",
        },
      ],
    });
    const merged = mergeProductCatalog([boots], [pumps]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.sourceCategories?.map((item) => item.categoryName).sort()).toEqual([
      "Boots",
      "Pumps",
    ]);
  });

  it("does not duplicate a Model Family key when a product appears in several collections", () => {
    const merged = mergeProductCatalog(
      [
        product({ productUrl: "https://x.com/products/a", sourceCategoryName: "Boots" }),
        product({ productUrl: "https://x.com/products/b", sourceCategoryName: "Pumps" }),
      ],
      [product({ productUrl: "https://x.com/products/a", sourceCategoryName: "Pumps" })],
    );
    expect(merged).toHaveLength(2);
  });

  it("keeps specific memberships when a generic root is also present", () => {
    const merged = mergeProductCatalog(
      [
        product({
          productUrl: "https://x.com/products/a",
          sourceCategories: [
            { categoryId: "womens-shoes", categoryName: "Womens Shoes", categoryPath: "/collections/womens-shoes" },
            { categoryId: "pumps", categoryName: "Pumps", categoryPath: "/collections/pumps" },
          ],
        }),
      ],
      [],
    );
    const display = flattenBrandDisplayCategories(
      extractSourceCategories(
        [
          family({
            sourceCategoryRefs: (merged[0]?.sourceCategories ?? []).map((category) => ({
              sourceId: "jeffrey-campbell",
              ...category,
            })),
          }),
        ],
        "jeffrey-campbell",
      ),
    );
    expect(display.map((item) => item.categoryName)).toEqual(["Topuklu"]);
    expect(display.every((item) => !item.categoryName.includes(">"))).toBe(true);
    expect(display).toHaveLength(1);
  });

  it("keeps a generic Shoes chip when that is the only source category", () => {
    const display = flattenBrandDisplayCategories([
      {
        categoryId: "shoes",
        categoryName: "Shoes",
        categoryPath: "/collections/shoes",
      },
    ]);
    expect(display.map((item) => item.categoryName)).toEqual(["Shoes"]);
  });

  it("treats pumps and boots as footwear collections and mens clothing as not", () => {
    expect(isWomensFootwearCollection("pumps", "Pumps")).toBe(true);
    expect(isWomensFootwearCollection("menu-boots", "Menu Boots")).toBe(true);
    expect(isWomensFootwearCollection("mens-shirts", "Men's Shirts")).toBe(false);
    expect(isWomensFootwearCollection("color-beige-black-snake-brown-heel", "Beige Black Snake")).toBe(
      false,
    );
  });
});

describe("image completeness", () => {
  it("retains all unique Shopify gallery images", () => {
    const mapped = shopifyProductToPilot(
      {
        id: 1,
        title: "Lita Boot",
        handle: "lita",
        product_type: "Boots",
        tags: ["shoes"],
        images: [
          { src: "https://cdn.shopify.com/s/files/1/1/products/a.jpg" },
          { src: "https://cdn.shopify.com/s/files/1/1/products/b.jpg" },
          { src: "https://cdn.shopify.com/s/files/1/1/products/c.jpg" },
          { src: "https://cdn.shopify.com/s/files/1/1/products/a.jpg?v=2" },
        ],
        variants: [],
      },
      {
        id: "jeffrey-campbell",
        brand: "JEFFREY CAMPBELL",
        baseUrl: "https://jeffreycampbellshoes.com",
        collectionPaths: ["/collections/boots"],
        verifiedFootwearPaths: ["/collections/boots"],
        maxProducts: 500,
        collectMode: "full",
      },
      "2026-08-21T00:00:00.000Z",
      "/collections/boots",
      "Boots",
    );
    expect(mapped?.images.length).toBeGreaterThanOrEqual(3);
  });

  it("does not let a listing thumbnail overwrite a richer gallery", () => {
    const gallery = product({
      productUrl: "https://x.com/products/a",
      images: [
        "https://cdn.shopify.com/s/files/1/1/products/a.jpg",
        "https://cdn.shopify.com/s/files/1/1/products/b.jpg",
        "https://cdn.shopify.com/s/files/1/1/products/c.jpg",
      ],
    });
    const listing = product({
      productUrl: "https://x.com/products/a",
      imageUrl: "https://cdn.shopify.com/s/files/1/1/products/a.jpg",
      images: ["https://cdn.shopify.com/s/files/1/1/products/a.jpg"],
    });
    const merged = mergeProductCatalog([gallery], [listing]);
    expect(merged[0]?.images?.length).toBeGreaterThanOrEqual(3);
  });

  it("removes duplicate image URLs", () => {
    const urls = resolveProductImageUrls({
      productUrl: "https://x.com/p",
      imageUrl: "https://cdn.shopify.com/s/files/1/1/products/a.jpg",
      images: [
        "https://cdn.shopify.com/s/files/1/1/products/a.jpg",
        "https://cdn.shopify.com/s/files/1/1/products/a.jpg?v=9",
        "https://cdn.shopify.com/s/files/1/1/products/b.jpg",
      ],
    });
    expect(urls).toHaveLength(2);
  });

  it("preserves gallery references on a brand shard", () => {
    const slim = slimFamilyForDelivery(
      family({
        representativeImages: Array.from({ length: 12 }, (_, index) =>
          `https://cdn.shopify.com/s/files/1/1/products/${index}.jpg`,
        ),
        allImages: Array.from({ length: 12 }, (_, index) =>
          `https://cdn.shopify.com/s/files/1/1/products/${index}.jpg`,
        ),
      }),
    );
    expect(slim.representativeImages.length).toBeGreaterThan(8);
    expect(slim.representativeImages.length).toBeLessThanOrEqual(MAX_DELIVERY_IMAGES);
  });

  it("uses non-cropping contain fit for product photography", () => {
    expect(PRODUCT_PHOTO_FIT_CLASS).toContain("object-contain");
    expect(PRODUCT_PHOTO_FIT_CLASS).not.toContain("object-cover");
  });
});
