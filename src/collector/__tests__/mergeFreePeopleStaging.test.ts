import { describe, expect, it } from "vitest";

import { mergeFreePeopleStagingIntoCatalog } from "../mergeFreePeopleStaging";
import type { PilotProduct } from "../types";

function product(overrides: Partial<PilotProduct> & Pick<PilotProduct, "source" | "brand" | "productUrl">): PilotProduct {
  return {
    source: overrides.source,
    brand: overrides.brand,
    productName: overrides.productName ?? "Shoe",
    productUrl: overrides.productUrl,
    imageUrl: overrides.imageUrl ?? "https://images.urbndata.com/is/image/FreePeople/111111111_001_a",
    images: overrides.images ?? ["https://images.urbndata.com/is/image/FreePeople/111111111_001_a"],
    category: "BOOT",
    color: overrides.color ?? "Black",
    material: null,
    toeShape: null,
    heelType: null,
    heelHeight: null,
    details: overrides.details ?? "price=100 colorSource=pinia-slice colorCode=001",
    discoveredAt: "2026-08-24T00:00:00.000Z",
    variants: overrides.variants ?? [
      {
        title: "Shoe — Black",
        color: "Black",
        sku: "111111111_001",
      },
    ],
    ...overrides,
  };
}

describe("mergeFreePeopleStagingIntoCatalog", () => {
  it("adds Free People listings without overwriting official products of the same brand", () => {
    const official = product({
      source: "birkenstock",
      brand: "BIRKENSTOCK",
      productName: "Arizona",
      productUrl: "https://www.birkenstock.com/products/arizona",
      imageUrl: "https://cdn.shopify.com/arizona.jpg",
      images: ["https://cdn.shopify.com/arizona.jpg"],
      variants: [{ title: "Arizona", color: "Stone", sku: "ARIZONA-1" }],
    });
    const staging = product({
      source: "free-people",
      brand: "Birkenstock",
      productName: "Birkenstock Amsterdam Wrapped Clogs",
      productUrl: "https://www.freepeople.com/shop/birkenstock-amsterdam-wrapped-clogs/?color=023",
      color: "Taupe",
      variants: [{ title: "Clogs — Taupe", color: "Taupe", sku: "108576950_023" }],
      images: ["https://images.urbndata.com/is/image/FreePeople/108576950_023_a"],
      imageUrl: "https://images.urbndata.com/is/image/FreePeople/108576950_023_a",
    });

    const first = mergeFreePeopleStagingIntoCatalog([official], [staging]);
    expect(first.products).toHaveLength(2);
    expect(first.added).toBe(1);
    expect(first.products.find((item) => item.source === "birkenstock")?.productUrl).toBe(
      official.productUrl,
    );
    expect(first.products.find((item) => item.source === "free-people")?.brand).toBe("Birkenstock");
    expect(first.products.find((item) => item.source === "free-people")?.color).toBe("Taupe");

    const second = mergeFreePeopleStagingIntoCatalog(first.products, [staging]);
    expect(second.products).toHaveLength(2);
    expect(second.added).toBe(0);
    expect(second.replaced).toBe(1);
  });

  it("does not merge Free People identities into Farfetch or Level Shoes", () => {
    const farfetch = product({
      source: "farfetch",
      brand: "Jeffrey Campbell",
      productUrl: "https://www.farfetch.com/uk/shopping/women/jeffrey-campbell-boot-item-12345678.aspx",
      imageUrl: "https://cdn-images.farfetch-contents.com/x.jpg",
      images: ["https://cdn-images.farfetch-contents.com/x.jpg"],
      variants: [{ title: "Boot", color: "Black", sku: null }],
    });
    const level = product({
      source: "level-shoes",
      brand: "Jeffrey Campbell",
      productUrl: "https://www.levelshoes.com/jeffrey-campbell-boot-women-boots-abc123.html",
      imageUrl: "https://www.levelshoes.com/a.jpg",
      images: ["https://www.levelshoes.com/a.jpg"],
      variants: [{ title: "Boot", color: "Black", sku: null }],
    });
    const staging = product({
      source: "free-people",
      brand: "Jeffrey Campbell",
      productUrl: "https://www.freepeople.com/shop/sweet-talker-snip-toe-boots/?color=022",
      variants: [{ title: "Boots", color: "Dark Brown Brush", sku: "90404021_022" }],
      images: ["https://images.urbndata.com/is/image/FreePeople/90404021_022_a"],
      imageUrl: "https://images.urbndata.com/is/image/FreePeople/90404021_022_a",
    });

    const merged = mergeFreePeopleStagingIntoCatalog([farfetch, level], [staging]);
    expect(merged.products).toHaveLength(3);
    expect(merged.products.filter((item) => item.source === "farfetch")).toHaveLength(1);
    expect(merged.products.filter((item) => item.source === "level-shoes")).toHaveLength(1);
    expect(merged.products.filter((item) => item.source === "free-people")).toHaveLength(1);
    expect(merged.skipped).toEqual([]);
  });

  it("skips staging rows that collide on URL with a protected catalog product", () => {
    const official = product({
      source: "jeffrey-campbell",
      brand: "JEFFREY CAMPBELL",
      productUrl: "https://www.freepeople.com/shop/sweet-talker-snip-toe-boots/?color=022",
      imageUrl: "https://cdn.shopify.com/x.jpg",
      images: ["https://cdn.shopify.com/x.jpg"],
      variants: [{ title: "Official", color: "Black", sku: "OFF-1" }],
    });
    const staging = product({
      source: "free-people",
      brand: "Jeffrey Campbell",
      productUrl: "https://www.freepeople.com/shop/sweet-talker-snip-toe-boots/?color=022",
      variants: [{ title: "Boots", color: "Dark Brown Brush", sku: "90404021_022" }],
    });
    const merged = mergeFreePeopleStagingIntoCatalog([official], [staging]);
    expect(merged.products).toHaveLength(1);
    expect(merged.skipped).toHaveLength(1);
    expect(merged.products[0]?.source).toBe("jeffrey-campbell");
  });
});
