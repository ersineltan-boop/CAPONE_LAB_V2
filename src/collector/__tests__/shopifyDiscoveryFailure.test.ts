import { describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ malformed: false, products: false }));
vi.mock("../http", () => ({
  sleep: async () => {},
  fetchJson: async (url: string) => {
    if (fixture.products) {
      if (url.includes("/collections.json")) return { ok: true, data: { collections: [
        { handle: "flats", title: "Flats", products_count: 77 },
        { handle: "shoes", title: "Shoes", products_count: 3 },
      ] } };
      if (url.includes("/collections/flats/")) return { ok: true, data: {} };
      return { ok: true, data: { products: [
        { id: 1, title: "City Loafer", handle: "city-loafer", product_type: "Loafers" },
        { id: 2, title: "Men's Sneaker", handle: "mens-sneaker", product_type: "Sneakers" },
      ] } };
    }
    if (url.includes("page=2")) return { ok: false, status: 503, data: null, error: "HTTP 503 second discovery page" };
    return { ok: true, status: 200, data: fixture.malformed ? {} : { collections: Array.from({ length: 250 }, (_, id) => ({ handle: `collection-${id}`, title: "Shoes", products_count: 1 })) } };
  },
}));
import { collectShopifyFootwearBackfill, listShopifyCollections } from "../shopify";

describe("complete source NEW discovery", () => {
  it("propagates a later listing failure so prior NEW cannot be cleared using partial discovery", async () => {
    const result = await listShopifyCollections("https://source.test");
    expect(result.collections).toHaveLength(250);
    expect(result.errors).toEqual(["HTTP 503 second discovery page"]);
  });
  it("rejects a successful HTTP response whose collection payload is absent", async () => {
    fixture.malformed = true;
    try {
      const result = await listShopifyCollections("https://source.test");
      expect(result.collections).toEqual([]);
      expect(result.errors[0]).toContain("Invalid Shopify collections payload");
    } finally { fixture.malformed = false; }
  });

  it("keeps collection metadata, public rows and eligible products separate", async () => {
    fixture.products = true;
    try {
      const result = await collectShopifyFootwearBackfill({ id: "example", brand: "Example", baseUrl: "https://source.test",
        collectionPaths: ["/collections/shoes", "/collections/flats"], maxProducts: 2, collectMode: "full" });
      expect(result.shopifyCollectionEvidence).toEqual([
        { path: "/collections/shoes", scope: "candidate-root", reportedCollectionCount: 3, publicProductCount: 2, eligibleProductCount: 1, paginationExhausted: true },
        { path: "/collections/flats", scope: "category", reportedCollectionCount: 77, publicProductCount: 0, eligibleProductCount: 0, paginationExhausted: false },
      ]);
      expect(result.paginationExhausted).toBe(false);
      expect(result.errors[0]).toContain("Invalid Shopify products payload");
    } finally { fixture.products = false; }
  });
});
