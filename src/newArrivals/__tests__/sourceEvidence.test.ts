import { describe, expect, it } from "vitest";
import { shopifyProductToPilot } from "../../collector/shopify";
import { analyzeProducts } from "../../analysis/analyzeProduct";
import { buildBrandSourceSighting, buildMarketplaceSourceSighting } from "../sourceSightings";
import { isVerifiedNew } from "../newness";

const config = { id: "test", brand: "TEST", baseUrl: "https://brand.test", collectionPaths: ["/collections/womens-shoes"], maxProducts: 250 };
const raw = { id: 1, handle: "new-york-mule", title: "NEW YORK Mule", product_type: "Mules", tags: [] as string[], images: [{ src: "https://brand.test/shoe.jpg" }], variants: [{ title: "38", sku: "SOURCE-38" }] };

describe("source evidence across brand and marketplace sightings", () => {
  it("keeps model names out of NEW while preserving standalone source tags", () => {
    const unverified = shopifyProductToPilot(raw, config, "2026-10-02T00:00:00.000Z", "/collections/womens-shoes")!;
    expect(unverified).not.toBeNull();
    expect(unverified.hasNewBadge).toBe(false);
    const verified = shopifyProductToPilot({ ...raw, tags: ["NEW IN"] }, config, unverified.discoveredAt, unverified.collectionPath!)!;
    expect(verified.hasNewBadge).toBe(true);
    expect(verified.variants).toEqual(unverified.variants);
    expect(verified.images).toEqual(unverified.images);
  });

  it("requires source badge or collection evidence for both source kinds", () => {
    const product = shopifyProductToPilot(raw, config, "2026-10-02T00:00:00.000Z", "/collections/womens-shoes")!;
    // Historical records can omit hasNewBadge. Names still cannot supply it.
    delete product.hasNewBadge;
    const analyzed = analyzeProducts([product]);
    expect(isVerifiedNew(buildBrandSourceSighting("TEST", analyzed).newness)).toBe(false);
    expect(isVerifiedNew(buildMarketplaceSourceSighting("level-shoes", "Level Shoes", analyzed).newness)).toBe(false);
    const badgeProduct = { ...product, hasNewBadge: true };
    const badge = analyzeProducts([badgeProduct]);
    expect(isVerifiedNew(buildBrandSourceSighting("TEST", badge).newness)).toBe(true);
    expect(isVerifiedNew(buildMarketplaceSourceSighting("level-shoes", "Level Shoes", badge).newness)).toBe(true);
  });
});
