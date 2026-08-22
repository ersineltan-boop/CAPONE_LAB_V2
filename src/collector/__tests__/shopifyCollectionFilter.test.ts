import { describe, expect, it } from "vitest";

import { FULL_COLLECTION_CRAWL_CAP, FULL_VARIANT_CAP } from "../fullCoveragePaths";
import {
  authoritativeFootwearReportedCount,
  selectShopifyFootwearCollectionsToCrawl,
} from "../shopifyCollectionFilter";

describe("Shopify footwear collection crawl selection", () => {
  it("includes all women's footwear collections up to a safety ceiling, not a sample of 2", () => {
    const collections = [
      { handle: "womens-shoes", title: "Women's Shoes", productsCount: 900 },
      { handle: "sandals", title: "Sandals", productsCount: 200 },
      { handle: "boots", title: "Boots", productsCount: 180 },
      { handle: "handbags", title: "Handbags", productsCount: 400 },
      { handle: "mens-shoes", title: "Men's Shoes", productsCount: 90 },
    ];
    const selected = selectShopifyFootwearCollectionsToCrawl(
      collections,
      ["/collections/womens-shoes"],
      200,
    );
    expect(selected.paths).toEqual(
      expect.arrayContaining([
        "/collections/womens-shoes",
        "/collections/sandals",
        "/collections/boots",
      ]),
    );
    expect(selected.paths).not.toContain("/collections/handbags");
    expect(selected.paths).not.toContain("/collections/mens-shoes");
    expect(selected.footwearCollectionCount).toBe(3);
    expect(selected.hitCollectionCrawlCap).toBe(false);
  });

  it("marks the safety ceiling without treating it as a sampling cap of 100", () => {
    const collections = Array.from({ length: 220 }, (_, index) => ({
      handle: `sandals-${index}`,
      title: "Sandals",
      productsCount: 12,
    }));
    const selected = selectShopifyFootwearCollectionsToCrawl(collections, [], 200);
    expect(FULL_COLLECTION_CRAWL_CAP).toBeGreaterThan(100);
    expect(selected.selected).toHaveLength(200);
    expect(selected.hitCollectionCrawlCap).toBe(true);
    expect(FULL_VARIANT_CAP).toBeGreaterThan(20);
  });

  it("uses the women's footwear root count, not an inflated unrelated collection", () => {
    const counts = new Map<string, number>([
      ["/collections/womens-shoes", 1400],
      ["/collections/all", 9167],
      ["/collections/sandals", 200],
    ]);
    expect(
      authoritativeFootwearReportedCount(counts, [
        "/collections/womens-shoes",
        "/collections/sandals",
      ]),
    ).toBe(1400);
    expect(
      authoritativeFootwearReportedCount(counts, [
        "/collections/all",
        "/collections/womens-shoes",
        "/collections/sandals",
      ]),
    ).toBe(1400);
  });

  it("skips store-wide mixed catalogs when specific footwear collections exist", () => {
    const selected = selectShopifyFootwearCollectionsToCrawl(
      [
        { handle: "all", title: "All", productsCount: 9000 },
        { handle: "sandals", title: "Sandals", productsCount: 200 },
        { handle: "boots", title: "Boots", productsCount: 180 },
      ],
      [],
      200,
    );
    expect(selected.paths).toEqual(
      expect.arrayContaining(["/collections/sandals", "/collections/boots"]),
    );
    expect(selected.paths).not.toContain("/collections/all");
  });

  it("does not treat generic New In as footwear when the collection has no shoe token", () => {
    const selected = selectShopifyFootwearCollectionsToCrawl(
      [
        { handle: "new-in", title: "New In", productsCount: 45 },
        { handle: "new-season", title: "FW26", productsCount: 202 },
        { handle: "shoes-boots", title: "Boots", productsCount: 85 },
      ],
      [],
      200,
    );
    expect(selected.paths).toContain("/collections/shoes-boots");
    expect(selected.paths).not.toContain("/collections/new-in");
    expect(selected.paths).not.toContain("/collections/new-season");
  });
});
