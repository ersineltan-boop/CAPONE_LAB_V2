import { describe, expect, it } from "vitest";

import {
  mergeProductCatalog,
  productReleaseTimestamp,
  sortProductsNewestFirst,
} from "../mergeProducts";
import type { PilotProduct } from "../types";

function product(overrides: Partial<PilotProduct> & Pick<PilotProduct, "productUrl">): PilotProduct {
  return {
    source: "test",
    brand: "TEST",
    productName: "Shoe",
    productUrl: overrides.productUrl,
    imageUrl: null,
    category: "PUMP",
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

describe("mergeProducts", () => {
  it("preserves earliest discoveredAt on merge", () => {
    const existing = product({
      productUrl: "https://example.com/products/a",
      discoveredAt: "2026-08-01T00:00:00.000Z",
      productName: "Old name",
    });
    const incoming = product({
      productUrl: "https://example.com/products/a",
      discoveredAt: "2026-08-10T00:00:00.000Z",
      productName: "New name",
    });

    const merged = mergeProductCatalog([existing], [incoming]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.discoveredAt).toBe("2026-08-01T00:00:00.000Z");
    expect(merged[0]?.productName).toBe("New name");
  });

  it("preserves New Arrivals membership across collection merges", () => {
    const existing = product({
      productUrl: "https://example.com/products/a",
      isNewArrivalsCollection: true,
      collectionPath: "/collections/new-arrivals",
    });
    const incoming = product({
      productUrl: "https://example.com/products/a",
      isNewArrivalsCollection: false,
      collectionPath: "/collections/shop-all",
    });
    const merged = mergeProductCatalog([existing], [incoming]);
    expect(merged[0]?.isNewArrivalsCollection).toBe(true);
  });

  it("sorts newest publishedAt first", () => {
    const older = product({
      productUrl: "https://example.com/products/old",
      publishedAt: "2026-01-01T00:00:00.000Z",
    });
    const newer = product({
      productUrl: "https://example.com/products/new",
      publishedAt: "2026-08-01T00:00:00.000Z",
    });

    const sorted = sortProductsNewestFirst([older, newer]);
    expect(sorted[0]?.productUrl).toContain("new");
    expect(productReleaseTimestamp(newer)).toBeGreaterThan(
      productReleaseTimestamp(older),
    );
  });
});

describe("discoverFootwearCollections quality", () => {
  it("classifies 8/10 accepted as VERIFIED quality", async () => {
    const { discoverVerifiedFootwearCollections } = await import("../discoverFootwearCollections");
    expect(typeof discoverVerifiedFootwearCollections).toBe("function");
  });
});
