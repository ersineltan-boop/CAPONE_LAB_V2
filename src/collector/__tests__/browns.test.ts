import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  brownsPublicationBlocker,
  brownsRawProductToPilot,
  collectBrowns,
  isBrownsColorSwatchImage,
  parseBrownsStorefrontProductCount,
  publishBrownsCatalog,
  type BrownsHttp,
  type BrownsRawProduct,
} from "../browns";

const HTML = `
<script>
  Shopify.theme.collection = { handle: "woman-shoes", id: parseInt("540564193544"), productCount: parseInt("2625") }
</script>
<script>
  Shopify.theme.collection = { handle: "women-shoes-trainers", id: parseInt("1"), productCount: parseInt("773") }
</script>
`;

function raw(overrides: Partial<BrownsRawProduct> = {}): BrownsRawProduct {
  return {
    id: 1,
    title: "Lidia patent-leather pumps",
    handle: "paris-texas-lidia-pumps",
    vendor: "Paris Texas",
    product_type: "Shoes",
    tags: ["Heeled Pumps", "Pumps", "Shoes", "Women"],
    images: [
      { src: "https://cdn.shopify.com/s/files/1/1/pump.jpg" },
      { src: "https://cdn.shopify.com/s/files/1/1/color-swatch.png" },
    ],
    variants: [{ title: "36", sku: "PT-36" }],
    options: [{ name: "Size", values: ["36"] }],
    ...overrides,
  };
}

function http(products: BrownsRawProduct[], count = products.length): BrownsHttp {
  const html = HTML.replace('parseInt("2625")', `parseInt("${count}")`);
  return {
    text: async () => ({ ok: true, status: 200, text: html }),
    json: async <T>(url: string) => {
      if (url.endsWith(".json") && !url.includes("products.json")) {
        return { ok: true, status: 200, data: { collection: { products_count: count + 3 } } as T };
      }
      return { ok: true, status: 200, data: { products } as T };
    },
  };
}

describe("Browns marketplace collector", () => {
  it("reads the storefront count for the women's designer shoes handle", () => {
    expect(parseBrownsStorefrontProductCount(HTML, "woman-shoes")).toBe(2625);
    expect(parseBrownsStorefrontProductCount(HTML, "missing")).toBeNull();
    expect(isBrownsColorSwatchImage("https://cdn.example/color-swatch.png")).toBe(true);
  });

  it("keeps shoes that carry merchandising accessory tags or a low-top name", () => {
    const accessory = brownsRawProductToPilot(
      raw({ tags: ["Pumps", "Shoes", "Summer Accessories", "Women"] }),
      "2026-09-28T12:00:00.000Z",
    );
    const lowTop = brownsRawProductToPilot(
      raw({
        title: "skel top low",
        handle: "amiri-skel-top-low",
        vendor: "AMIRI",
        tags: ["Low-Tops", "Shoes", "Trainers", "Women"],
      }),
      "2026-09-28T12:00:00.000Z",
    );
    expect(accessory?.category).toBe("PUMP");
    expect(lowTop?.category).toBe("SNEAKER");
    expect(lowTop?.productName).toBe("skel top low");
  });

  it("keeps the designer brand, drops swatches and prices, and does not mark the first import new", () => {
    const product = brownsRawProductToPilot(raw(), "2026-09-28T12:00:00.000Z");
    expect(product?.source).toBe("browns");
    expect(product?.brand).toBe("Paris Texas");
    expect(product?.category).toBe("PUMP");
    expect(product?.images).toEqual(["https://cdn.shopify.com/s/files/1/1/pump.jpg"]);
    expect(product?.isNewArrivalsCollection).toBe(false);
    expect(product?.hasNewBadge).toBe(false);
    expect(JSON.stringify(product)).not.toContain("price");
  });

  it("marks a reconciled women's footwear page FULL and leaves sports brands out", () => {
    return collectBrowns({
      now: "2026-09-28T12:00:00.000Z",
      http: http([
        raw(),
        raw({
          id: 2,
          title: "Air Force sneakers",
          handle: "nike-air-force",
          vendor: "Nike",
          tags: ["Trainers", "Shoes", "Women"],
        }),
        raw({
          id: 3,
          title: "men's Laurel terry slides",
          handle: "casablanca-men-s-laurel-terry-slides",
          vendor: "Casablanca",
          tags: ["Men", "Shoes", "Women"],
        }),
      ], 3),
    }).then((result) => {
      expect(result.coverage.status).toBe("FULL");
      expect(result.coverage.storefrontProductCount).toBe(3);
      expect(result.coverage.collectionResourceCount).toBe(6);
      expect(result.coverage.fetchedProducts).toBe(3);
      expect(result.coverage.scopeExcluded).toBe(2);
      expect(result.products).toHaveLength(1);
      expect(result.coverage.baselineNewArrivals).toBe(0);
      expect(result.coverage.periodicRefresh).toBe(true);
      expect(brownsPublicationBlocker(result)).toBeNull();
    });
  });

  it("stays PARTIAL when the storefront count is higher than the fetched page", async () => {
    const result = await collectBrowns({
      now: "2026-09-28T12:00:00.000Z",
      http: http([raw()], 5),
    });
    expect(result.coverage.status).toBe("PARTIAL");
    expect(result.coverage.blocker).toContain("5");
    expect(brownsPublicationBlocker(result)).toBeTruthy();
  });

  it("does not publish a partial collect or rewrite the shared catalog", async () => {
    const root = await mkdtemp(join(tmpdir(), "browns-"));
    await rm(join(root, "data"), { recursive: true, force: true });
    const result = await collectBrowns({
      now: "2026-09-28T12:00:00.000Z",
      http: http([raw()], 5),
    });
    const published = await publishBrownsCatalog(root, result);
    expect(published.published).toBe(false);
    await expect(readFile(join(root, "data/multibrand/products.json"), "utf8")).rejects.toThrow();
    await rm(root, { recursive: true, force: true });
  });
});


describe("Browns automatic verified NEW refresh", () => {
  const collection = { handle: "new-in", title: "New In", productsCount: 1,
    path: "/collections/new-in", url: "https://www.brownsfashion.com/collections/new-in" };
  const membership = (products: NonNullable<ReturnType<typeof brownsRawProductToPilot>>[], errors: string[] = []) => async () => ({
    products, errors, discoveredCollections: [collection], crawledCollections: [collection],
    skippedCollections: [], pagesTraversed: 1, verifiedNewArrivalPaths: [collection.path],
  });

  it("uses source membership on refresh, without turning the first import NEW", async () => {
    const source = raw({ tags: ["Women", "Shoes", "Pumps", "New In"] });
    expect(brownsRawProductToPilot(source, "2026-10-03")?.hasNewBadge).toBe(false);
    const incoming = { ...brownsRawProductToPilot(source, "2026-10-03", true)!, isNewArrivalsCollection: true, collectionPath: collection.path, collectionLabel: collection.title };
    const result = await collectBrowns({ refresh: true, http: http([source]), membership: membership([incoming]) });
    expect(result.coverage.status).toBe("FULL");
    expect(result.coverage.verifiedNewProducts).toBe(1);
    expect(result.products[0].isNewArrivalsCollection).toBe(true);
    expect(result.products[0].hasNewBadge).toBe(true);
    expect(result.products[0].collectionPath).toBe("/collections/new-in");
    expect(brownsPublicationBlocker(result)).toBeNull();
  });

  it("blocks promotion when the current NEW collection cannot be verified", async () => {
    const result = await collectBrowns({ refresh: true, http: http([raw()]), membership: membership([], ["HTTP 403"]) });
    expect(result.coverage.status).toBe("PARTIAL");
    expect(brownsPublicationBlocker(result)).toContain("NEW_MEMBERSHIP_BLOCKED");
  });

  it("preserves archived products and galleries and retires expired collection membership", async () => {
    const root = await mkdtemp(join(tmpdir(), "browns-refresh-"));
    try {
      const catalogPath = join(root, "data/multibrand/model-families/marketplaces/browns.json");
      const current = { ...brownsRawProductToPilot(raw(), "2026-09-01")!, images: ["https://cdn.example/old-detail.jpg"], isNewArrivalsCollection: true };
      const archived = { ...brownsRawProductToPilot(raw({ id: 2, handle: "archived-pump" }), "2026-09-01")!, isNewArrivalsCollection: true };
      await mkdir(join(root, "data/registry"), { recursive: true });
      await mkdir(join(root, "data/multibrand/model-families/marketplaces"), { recursive: true });
      await writeFile(catalogPath, JSON.stringify({ products: [current, archived], families: [] }));
      await writeFile(join(root, "data/registry/marketplace-pilot.json"), JSON.stringify({ activeMarketplaceIds: ["browns"] }));
      const result = await collectBrowns({ refresh: true, http: http([raw()]), membership: membership([]) });
      expect((await publishBrownsCatalog(root, result)).published).toBe(true);
      const stored = JSON.parse(await readFile(catalogPath, "utf8"));
      expect(stored.products).toHaveLength(2);
      expect(stored.products[0].images).toContain("https://cdn.example/old-detail.jpg");
      expect(stored.products.every((product: { isNewArrivalsCollection: boolean }) => !product.isNewArrivalsCollection)).toBe(true);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
