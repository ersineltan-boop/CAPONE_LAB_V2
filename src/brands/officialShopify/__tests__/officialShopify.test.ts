import { describe, expect, it } from "vitest";

import { NEXT_OFFICIAL_SHOPIFY_BRAND_TARGETS, OFFICIAL_SHOPIFY_BRAND_TARGETS } from "../candidates";
import { collectOfficialShopifyBrand, type OfficialHttp } from "../collect";
import { officialCatalogPublishBlocker } from "../publish";
import { isColorSwatchImage, parseStorefrontProductCount } from "../storefrontCount";

function jsonResponse(body: unknown, url: string): Awaited<ReturnType<OfficialHttp["fetchText"]>> {
  return { ok: true, status: 200, url, text: JSON.stringify(body) };
}

function product(id: number, handle: string, title: string, images: string[]) {
  return {
    id,
    title,
    handle,
    product_type: "boots",
    tags: ["variant_black-boot", "variant_white-boot"],
    images: images.map((src) => ({ src })),
    options: [{ name: "Color" }],
    variants: [{ title, sku: `SKU-${id}`, option1: title.split(" ").at(-1), price: "990.00" }],
  };
}

function fakeHttp(): OfficialHttp {
  return {
    async fetchText(url: string) {
      if (url.endsWith("/collections/shoes") && !url.includes("products.json") && !url.endsWith(".json")) {
        return { ok: true, status: 200, url, text: "<span data-filter-product-count>2 PRODUCTS</span>" };
      }
      if (url.endsWith("/collections/shoes.json")) {
        return jsonResponse({ collection: { products_count: 9 } }, url);
      }
      if (url.includes("/products.json")) {
        return jsonResponse({
          products: [
            product(1, "black-boot", "City Boot Black", [
              "https://cdn.shopify.com/s/files/1/swatch-black.png",
              "https://cdn.shopify.com/s/files/1/city-boot-black.jpg",
            ]),
            product(2, "white-boot", "City Boot White", [
              "https://cdn.shopify.com/s/files/1/city-boot-white.jpg",
            ]),
          ],
        }, url);
      }
      return { ok: false, status: 404, url, text: "" };
    },
  };
}

describe("official Shopify storefront collector", () => {
  it("reads one dedicated storefront count and ignores a disagreeing resource count", () => {
    expect(parseStorefrontProductCount('<span data-filter-product-count>88 PRODUCTS</span>')).toBe(88);
    expect(parseStorefrontProductCount(">0 product<>130 products<")).toBe(130);
    expect(parseStorefrontProductCount("Produits: 27 products and 12 products")).toBeNull();
    expect(isColorSwatchImage("https://cdn.shopify.com/s/files/swatch-black.png")).toBe(true);
  });

  it("reconciles the storefront total, drops swatches, and does not mark the baseline new", async () => {
    const target = {
      slug: "example",
      brand: "EXAMPLE",
      origin: "https://example.test",
      localePath: "",
      collections: [{ handle: "shoes" }],
    };
    const result = await collectOfficialShopifyBrand(target, fakeHttp(), "2026-09-28T12:00:00.000Z");
    expect(result.evidence.status).toBe("FULL");
    expect(result.evidence.storefrontProductCount).toBe(2);
    expect(result.evidence.collectionResourceCount).toBe(9);
    expect(result.evidence.fetchedProducts).toBe(2);
    expect(result.evidence.acceptedFootwear).toBe(2);
    expect(result.evidence.quarantined).toBe(0);
    expect(result.evidence.baselineNewArrivals).toBe(0);
    expect(result.evidence.periodicRefresh).toBe(true);
    expect(result.catalog?.families.every((family) => !family.isNew)).toBe(true);
    expect(result.catalog?.families.flatMap((family) => family.variants).every((variant) => !variant.isNew)).toBe(true);
    const images = result.catalog?.families.flatMap((family) => family.images) ?? [];
    expect(images.some((image) => image.includes("swatch"))).toBe(false);
    expect(images.some((image) => image.includes("city-boot-black"))).toBe(true);
    expect(JSON.stringify(result.catalog)).not.toContain('"price"');
    expect(officialCatalogPublishBlocker(result.catalog, result.evidence)).toBeNull();
  });

  it("stays PARTIAL when the storefront total is not the fetched count", async () => {
    const http: OfficialHttp = {
      async fetchText(url: string) {
        if (url.endsWith("/collections/shoes")) {
          return { ok: true, status: 200, url, text: ">5 products<" };
        }
        if (url.endsWith(".json") && !url.includes("products.json")) {
          return jsonResponse({ collection: { products_count: 5 } }, url);
        }
        return jsonResponse({ products: [product(1, "boot", "City Boot", ["https://cdn.shopify.com/s/files/1/boot.jpg"])] }, url);
      },
    };
    const result = await collectOfficialShopifyBrand({
      slug: "example",
      brand: "EXAMPLE",
      origin: "https://example.test",
      localePath: "",
      collections: [{ handle: "shoes" }],
    }, http, "2026-09-28T12:00:00.000Z");
    expect(result.evidence.status).toBe("PARTIAL");
    expect(result.catalog).toBeNull();
    expect(officialCatalogPublishBlocker(result.catalog, result.evidence)).not.toBeNull();
  });

  it("keeps the issue 91 targets on official footwear brands", () => {
    expect(OFFICIAL_SHOPIFY_BRAND_TARGETS.map((target) => target.slug)).toEqual([
      "isabel-marant",
      "yuul-yie",
      "le-silla",
      "k-jacques",
      "sergio-rossi",
      "fly-london",
    ]);
    expect(NEXT_OFFICIAL_SHOPIFY_BRAND_TARGETS.map((target) => target.slug)).toEqual([
      "pretty-ballerinas",
      "margaux",
      "mascar",
      "rouje",
      "repetto",
    ]);
    expect(OFFICIAL_SHOPIFY_BRAND_TARGETS.some((target) => /adidas|nike|converse|hoka|nodaleto/i.test(target.slug))).toBe(false);
    expect(parseStorefrontProductCount('<span id="FacetFiltersFormMobile-productcount">(243)</span>')).toBe(243);
  });
});
