import { describe, expect, it } from "vitest";
import fixture from "./fixtures/bata-product.json";
import { bataPrimaryCategory, prepareBataProducts, type BataSnapshot } from "../bata";

const checkedAt = "2026-11-02T00:00:00.000Z";
const now = Date.parse(checkedAt);
const snapshot: BataSnapshot = { status: "SOURCE_VERIFIED", checkedAt, sourceTotal: 1, products: [fixture], excludedIds: [] };

describe("BATA own colorway/gallery conversion", () => {
  it("keeps the original product name, selected URL and every real gallery image without NEW inference", () => {
    const [product] = prepareBataProducts(snapshot, now);
    expect(product.productName).toBe(fixture.product.name);
    expect(product.productUrl).toBe(fixture.url);
    expect(product.images).toEqual(fixture.product.image);
    expect(product.variants[0].sku).toBe(fixture.product.mpn);
    expect(product.category).toBe("PUMP");
    expect(product.hasNewBadge).toBe(false);
    expect(product.isNewArrivalsCollection).toBe(false);
    expect(product.publishedAt).toBeUndefined();
  });
  it("keeps a barefoot ankle boot out of Sneakers despite its broad source department", () => {
    const detail = { ...fixture, listing: { ...fixture.listing, category3: "Sneakers", name: "Lace-up Barefoot leather ankle boot for women Bata" },
      product: { ...fixture.product, name: "Lace-up Barefoot leather ankle boot for women Bata" } };
    expect(bataPrimaryCategory(detail)).toBe("BOOT");
    const [product] = prepareBataProducts({ ...snapshot, products: [detail] }, now);
    expect(product.category).toBe("BOOT");
    expect(product.sourceCategoryName).toBe("Sneakers");
  });
  it("refuses partial, stale and unreconciled source snapshots", () => {
    expect(() => prepareBataProducts({ ...snapshot, status: "PARTIAL" }, now)).toThrow();
    expect(() => prepareBataProducts(snapshot, now + 24 * 3600_000 + 1)).toThrow();
    expect(() => prepareBataProducts({ ...snapshot, sourceTotal: 2 }, now)).toThrow();
    expect(() => prepareBataProducts({ ...snapshot, products: [fixture, fixture], sourceTotal: 2 }, now)).toThrow();
  });
  it("preserves a source-qualified SKU without truncating it to the parent style", () => {
    const qualified = { ...fixture, product: { ...fixture.product, mpn: fixture.listing.id + "_04" } };
    const [product] = prepareBataProducts({ ...snapshot, products: [qualified] }, now);
    expect(product.sourceModelCode).toBe(qualified.product.mpn);
    expect(product.variants[0].sku).toBe(qualified.product.mpn);
  });
  it("rejects a wrong colorway identity, another brand, men's scope or invented gallery", () => {
    for (const changed of [
      { ...fixture, product: { ...fixture.product, mpn: "wrong-colorway" } },
      { ...fixture, product: { ...fixture.product, brand: { name: "OTHER" } } },
      { ...fixture, listing: { ...fixture.listing, "gender-name": "Men" } },
      { ...fixture, product: { ...fixture.product, image: ["https://example.com/similar-shoe.jpg"] } },
    ]) expect(() => prepareBataProducts({ ...snapshot, products: [changed] }, now)).toThrow();
  });
});
