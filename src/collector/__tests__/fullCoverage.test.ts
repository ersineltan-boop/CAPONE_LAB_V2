import { describe, expect, it } from "vitest";

import {
  FULL_COLLECTION_PAGE_CAP,
  LEGACY_BACKFILL_CAP,
  LEGACY_COLLECTION_PAGE_CAP,
  LEGACY_SAMPLE_PRODUCT_CAP,
  isFullCatalogRootPath,
  mergeFullCoverageCollectionPaths,
} from "../fullCoveragePaths";
import {
  fullModeIgnoresLegacyCaps,
  shopifyPageLimitForMode,
  shopifyPerPageForMode,
} from "../shopify";
import { shopifyProductToPilot } from "../shopify";
import type { PilotSourceConfig } from "../types";

const config: PilotSourceConfig = {
  id: "test",
  brand: "TEST",
  baseUrl: "https://example.com",
  collectionPaths: ["/collections/shop-all"],
  maxProducts: 20,
  backfillLimit: 100,
  collectMode: "full",
};

describe("full coverage collector caps", () => {
  it("full mode ignores the old 5-page collection cap", () => {
    expect(shopifyPageLimitForMode("full")).toBe(FULL_COLLECTION_PAGE_CAP);
    expect(shopifyPageLimitForMode("legacy")).toBe(LEGACY_COLLECTION_PAGE_CAP);
    expect(shopifyPageLimitForMode("full")).toBeGreaterThan(LEGACY_COLLECTION_PAGE_CAP);
  });

  it("full mode ignores the old 100-product backfill cap", () => {
    expect(fullModeIgnoresLegacyCaps("full")).toBe(true);
    expect(fullModeIgnoresLegacyCaps("backfill")).toBe(false);
    expect(LEGACY_BACKFILL_CAP).toBe(100);
    expect(LEGACY_SAMPLE_PRODUCT_CAP).toBe(100);
    expect(shopifyPerPageForMode("full")).toBe(250);
  });

  it("later pagination pages remain available in full mode", () => {
    expect(shopifyPageLimitForMode("full")).toBeGreaterThan(5);
  });

  it("merges shop-all roots with category collections", () => {
    const paths = mergeFullCoverageCollectionPaths({
      persistedPaths: ["/collections/menu-boots", "/collections/knee-high-boots"],
      collectionPaths: ["/collections/shop-all"],
      discoveredPaths: ["/collections/sandals"],
    });
    expect(paths).toContain("/collections/shop-all");
    expect(paths).toContain("/collections/menu-boots");
    expect(isFullCatalogRootPath("/collections/shop-all")).toBe(true);
  });

  it("excludes non-footwear products", () => {
    const mapped = shopifyProductToPilot(
      {
        id: 1,
        title: "Leather Tote",
        handle: "leather-tote",
        product_type: "Handbags",
        tags: ["Bags"],
        images: [{ src: "https://cdn.example.com/bag.jpg" }],
        variants: [],
      },
      config,
      "2026-08-21T00:00:00.000Z",
      "/collections/shop-all",
    );
    expect(mapped).toBeNull();
  });
});
