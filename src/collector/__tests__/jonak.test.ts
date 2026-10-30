import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { jonakCategory, prepareJonakProducts, type JonakCard } from "../jonak";

const snapshot = JSON.parse(gunzipSync(readFileSync(new URL("../../../data/brands/jonak-staging/verified-listing.json.gz", import.meta.url))).toString()).catalog;

describe("JONAK verified source conversion", () => {
  it("reconciles all source records as 640 shoes and 23 explicit accessories", () => {
    const result = prepareJonakProducts(snapshot, Date.parse(snapshot.checkedAt));
    expect(result.products).toHaveLength(640);
    expect(result.excluded).toHaveLength(23);
    const sourceByUrl = new Map<string, JonakCard>(snapshot.products.map((card: JonakCard) => [card.url, card]));
    for (const product of result.products) {
      const source = sourceByUrl.get(product.productUrl)!;
      expect(product.productName).toBe(source.sourceMetadata.name);
      expect(product.images).toEqual(source.images);
      expect(product.hasNewBadge).toBe(false);
      expect(product.isNewArrivalsCollection).toBe(false);
      expect(product.publishedAt).toBeUndefined();
    }
  });

  it("uses each seasonal model's actual title, including slingback ballet flats and lowboots", () => {
    const card = (name: string): JonakCard => ({ id: "1", url: "https://www.jonak-paris.com/p/x-1.html", images: [], sourceMetadata: { id: "1", name, category: "Collection/Selection/Indian summer/Eté Indien" } });
    expect(jonakCategory(card("Pointed-toe slingback ballet flats in glossy leather | DAMOURA"))).toBe("BALLERINA");
    expect(jonakCategory(card("Lowboots with elastic bands in taupe suede | CECILE"))).toBe("ANKLE_BOOT");
    expect(jonakCategory(card("Cotton socks"))).toBe("EXCLUDED");
    expect(jonakCategory(card("Summer selection model"))).toBeNull();
  });

  it("rejects partial, stale, duplicated or damaged identity/gallery data", () => {
    const now = Date.parse(snapshot.checkedAt);
    expect(() => prepareJonakProducts({ ...snapshot, status: "PARTIAL" }, now)).toThrow();
    expect(() => prepareJonakProducts(snapshot, now + 24 * 3600_000 + 1)).toThrow();
    expect(() => prepareJonakProducts({ ...snapshot, products: snapshot.products.slice(1) }, now)).toThrow();
    const products = [...snapshot.products];
    products[1] = products[0];
    expect(() => prepareJonakProducts({ ...snapshot, products }, now)).toThrow();
    products[1] = { ...snapshot.products[1], images: [] };
    expect(() => prepareJonakProducts({ ...snapshot, products }, now)).toThrow();
  });
});
