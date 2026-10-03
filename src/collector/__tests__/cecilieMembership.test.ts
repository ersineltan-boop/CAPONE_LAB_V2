import { describe, expect, it, vi } from "vitest";
import { collectShopifyCollectionMembership, mergeVerifiedShopifyMembership } from "../shopifyCollectionMembership";
import { loadBrandRegistry } from "../../registry/data";
import { brandToPilotSourceConfig } from "../../registry/collection/brandToCollector";

const fixture = vi.hoisted(() => ({ titleOnlyNew: false }));

vi.mock("../http", () => ({
  sleep: async () => {},
  fetchJson: async (url: string) => ({
    ok: true, status: 200,
    data: { products: url.includes("page=2") ? [] : [
      { id: 1, title: "CBBLAISE | SOFT SNEAKERS NAVY", handle: "blaise", product_type: "SHOES", tags: ["ACCESSORIES"], images: [{ src: "https://cdn.test/shoe.jpg" }] },
      { id: 2, title: "AUDREY DUFFEL BAG", handle: "duffel", product_type: "BAG", tags: ["ACCESSORIES"] },
      { id: 3, title: "SUN ORGANZA VEIL", handle: "veil", product_type: "VEIL", tags: ["ACCESSORIES"] },
    ] },
  }),
}));
vi.mock("../shopify", async (original) => ({
  ...await original<typeof import("../shopify")>(),
  listShopifyCollections: async () => ({ collections: [
    fixture.titleOnlyNew
      ? { handle: "women", title: "Women's New Arrivals", productsCount: 3 }
      : { handle: "new-in", title: "New In", productsCount: 3 },
  ], errors: [] }),
}));

describe("Cecilie verified mixed New In collection", () => {
  it("reads the pinned source collection, accepts shoes, and excludes bags and veils", async () => {
    const entry = loadBrandRegistry().get("cecilie-bahnsen")!;
    const config = brandToPilotSourceConfig(entry)!;
    expect(config.verifiedNewArrivalPaths).toEqual(["/collections/new-in"]);
    const result = await collectShopifyCollectionMembership(config);
    expect(result.errors).toEqual([]);
    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.category).toBe("SNEAKER");
    expect(result.products[0]?.isNewArrivalsCollection).toBe(true);
    expect(result.products[0]?.sourceProductTags).toEqual(["ACCESSORIES"]);
  });
  it("discovers official mixed New In collections while still rejecting non-footwear", async () => {
    const config = brandToPilotSourceConfig(loadBrandRegistry().get("cecilie-bahnsen")!)!;
    delete config.verifiedNewArrivalPaths;
    const result = await collectShopifyCollectionMembership(config);
    expect(result.crawledCollections.map((collection) => collection.path)).toEqual(["/collections/new-in"]);
    expect(result.products.map((product) => product.productName)).toEqual(["CBBLAISE | SOFT SNEAKERS NAVY"]);
    expect(result.verifiedNewArrivalPaths).toEqual(["/collections/new-in"]);
  });
  it("uses the official NEW title when its collection handle has no NEW token", async () => {
    fixture.titleOnlyNew = true;
    try {
      const config = brandToPilotSourceConfig(loadBrandRegistry().get("cecilie-bahnsen")!)!;
      delete config.verifiedNewArrivalPaths;
      const result = await collectShopifyCollectionMembership(config, { onlyNewCollections: true });
      expect(result.errors).toEqual([]);
      expect(result.verifiedNewArrivalPaths).toEqual(["/collections/women"]);
      expect(result.crawledCollections.map((collection) => collection.path)).toEqual(["/collections/women"]);
      expect(result.products).toHaveLength(1);
      expect(result.products[0]?.isNewArrivalsCollection).toBe(true);
      expect(result.products[0]?.collectionPath).toBe("/collections/women");
    } finally { fixture.titleOnlyNew = false; }
  });

  it("retires NEW after a complete empty listing discovered without manual pinning", async () => {
    const config = brandToPilotSourceConfig(loadBrandRegistry().get("cecilie-bahnsen")!)!;
    delete config.verifiedNewArrivalPaths;
    const result = await collectShopifyCollectionMembership(config);
    const old = result.products[0]!;
    const empty = { ...result, products: [], crawledCollections: result.crawledCollections.map((collection) => ({ ...collection, productsCount: 0 })) };
    expect(mergeVerifiedShopifyMembership(config, [old], empty)[0]?.isNewArrivalsCollection).toBe(false);
    expect(mergeVerifiedShopifyMembership(config, [old], { ...empty, errors: ["Incomplete listing"] })).toEqual([old]);
  });

  it("retires collection NEW on removed products but preserves their galleries and other sources", async () => {
    const config = brandToPilotSourceConfig(loadBrandRegistry().get("cecilie-bahnsen")!)!;
    const result = await collectShopifyCollectionMembership(config);
    const current = result.products[0]!;
    const archived = { ...current, productUrl: "https://ceciliebahnsen.com/products/old-shoe", images: ["https://cdn.test/archive.jpg"] };
    const other = { ...archived, source: "other", productUrl: "https://other.test/products/shoe" };
    const merged = mergeVerifiedShopifyMembership(config, [archived, other], result);
    const retired = merged.find((product) => product.productUrl === archived.productUrl)!;
    expect(retired.images).toEqual(archived.images);
    expect(retired.isNewArrivalsCollection).toBe(false);
    expect(retired.collectionPath).toBeNull();
    expect(retired.sourceCategories).toEqual([]);
    expect(merged.find((product) => product.productUrl === other.productUrl)).toEqual(other);
    expect(merged.find((product) => product.productUrl === current.productUrl)?.isNewArrivalsCollection).toBe(true);
    expect(mergeVerifiedShopifyMembership(config, [archived], { ...result, errors: ["HTTP 503 page 2"] })).toEqual([archived]);
    expect(mergeVerifiedShopifyMembership(config, [archived], { ...result, crawledCollections: [] })).toEqual([archived]);
  });

});
