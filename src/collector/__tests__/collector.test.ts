import { describe, expect, it } from "vitest";
import { isNonFootwear, normalizeFootwearCategory } from "../category";
import { shopifyProductToPilot } from "../shopify";
import type { PilotSourceConfig } from "../types";

const config: PilotSourceConfig = {
  id: "test",
  brand: "TEST",
  baseUrl: "https://example.com",
  collectionPaths: [],
  maxProducts: 30,
};

describe("footwear filter", () => {
  it("handbag ürünlerini eler", () => {
    expect(
      isNonFootwear({
        title: "Alys Black Suede",
        productType: "Clutch",
        tags: ["Category~Handbags"],
        handle: "bagalys-black-suede",
      }),
    ).toBe(true);
  });

  it("ayakkabı ürünlerini geçirir", () => {
    expect(
      isNonFootwear({
        title: "Lyra Sandal",
        productType: "Sandals",
        tags: ["Sandals"],
        handle: "lyra-sandal",
      }),
    ).toBe(false);
  });
});

describe("shopifyProductToPilot", () => {
  it("gerçek shopify alanlarını map eder", () => {
    const product = shopifyProductToPilot(
      {
        id: 1,
        title: "Lyra Sandal",
        handle: "lyra-sandal",
        body_html:
          "<p>Materials: Leather Upper | Leather Outsole<br>Heel Type: High Heel<br>Toe Style: Round Toe<br>Heel Height: 4.1 In</p>",
        product_type: "Sandals",
        tags: ["Sandals"],
        images: [{ src: "https://cdn.example.com/shoe.jpg" }],
        options: [{ name: "Color", values: ["Platinum"] }],
        variants: [{ title: "5 / Platinum", option1: "5", option2: "Platinum", sku: "SKU1" }],
        published_at: "2024-06-01T12:00:00-04:00",
        created_at: "2024-05-01T08:00:00-04:00",
        updated_at: "2025-01-01T09:00:00-05:00",
      },
      config,
      "2026-08-18T00:00:00.000Z",
    );

    expect(product?.productUrl).toBe("https://example.com/products/lyra-sandal");
    expect(product?.productName).toBe("Lyra Sandal");
    expect(product?.category).toBe("SANDAL");
    expect(product?.material).toContain("Leather");
    expect(product?.variants.length).toBeGreaterThan(0);
    expect(product?.images).toEqual(["https://cdn.example.com/shoe.jpg"]);
    expect(product?.publishedAt).toBe("2024-06-01T12:00:00-04:00");
    expect(product?.createdAt).toBe("2024-05-01T08:00:00-04:00");
    expect(product?.updatedAt).toBe("2025-01-01T09:00:00-05:00");
  });
});

describe("category normalization", () => {
  it("emin değilse OTHER_FOOTWEAR döner", () => {
    expect(
      normalizeFootwearCategory({
        title: "Unknown Shoe",
        productType: "Shoes",
        tags: ["Footwear"],
      }),
    ).toBe("OTHER_FOOTWEAR");
  });
});
