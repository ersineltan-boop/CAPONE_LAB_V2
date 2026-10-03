import { describe, expect, it } from "vitest";

import {
  PAPUCEI_SOURCE,
  collectPapuceiStaging,
  parsePapuceiListingPage,
  parsePapuceiProductPage,
} from "../romania/collectors/papucei";

const OBSERVED_AT = "2026-09-17T08:00:00.000Z";

function listing(urls: string[], next?: string): string {
  return `<main><div class="col_25 product type-product">${urls
    .map((url) => `<div class="all-img"><a href="${url}">shoe</a></div>`)
    .join("")}</div>${next ? `<ul class='page-numbers'><li><a class="next page-numbers" href="${next}">→</a></li></ul>` : "<ul class='page-numbers'></ul>"}</main>`;
}

function product(input: {
  name: string;
  sku: string;
  color: string;
  images?: string[];
  current?: number;
  list?: number;
  category?: string;
}): string {
  const images = input.images ?? ["https://www.papucei.ro/wp-content/uploads/2026/09/shoe-1.jpg"];
  const current = input.current ?? 205;
  const list = input.list ?? current;
  return `<div class="woo-variation-product-gallery"><div class="woo-variation-gallery-slider-wrapper">${images
    .map((image) => `<img data-large_image="${image}">`)
    .join("")}</div></div><div class="summary entry-summary"><h1>${input.name}</h1><div class="main_price"><p class="price">${list !== current ? `<del><span class="woocommerce-Price-amount amount">${list},00&euro;</span></del>` : ""}<ins><span class="woocommerce-Price-amount amount">${current},00&euro;</span></ins></p></div><div class="col_16 img active"><a href="#" title="${input.color}">${input.color}</a></div><span class="sku_var_value" data-default="${input.sku}">${input.sku}</span><input data-product_price="${current}"><div class="product_meta"><span class="posted_in">Categories: ${input.category ?? "High heeled boots"}, Shoes</span></div></div>`;
}

describe("Papucei Romania full-catalog staging collector", () => {
  it("reads only listing product URLs and follows the declared next page", () => {
    const parsed = parsePapuceiListingPage(`${listing([
      "https://www.papucei.ro/en/product/first-coffee/",
      "https://www.papucei.ro/en/product/first-coffee-2/?utm=x",
      "https://evil.example/en/product/not-allowed/",
    ], "https://www.papucei.ro/en/products-category/footwear/page/2/")}<a href="https://www.papucei.ro/en/product/footer-noise/">footer</a>`);
    expect(parsed.productUrls).toEqual([
      "https://www.papucei.ro/en/product/first-coffee/",
      "https://www.papucei.ro/en/product/first-coffee-2/",
    ]);
    expect(parsed.nextPageUrl).toBe("https://www.papucei.ro/en/products-category/footwear/page/2/");
  });

  it("keeps every full-resolution gallery image, color and price", () => {
    const parsed = parsePapuceiProductPage(product({
      name: "Heeled Boots First Coffee",
      sku: "PPC-1",
      color: "BLACK",
      current: 205,
      list: 249,
      images: [
        "https://www.papucei.ro/wp-content/uploads/2026/09/shoe-1.jpg",
        "https://www.papucei.ro/wp-content/uploads/2026/09/shoe-2.jpg",
        "https://www.papucei.ro/wp-content/uploads/2026/09/shoe-3.jpg",
      ],
    }), "https://www.papucei.ro/en/product/first-coffee/", OBSERVED_AT);
    expect(parsed.images).toHaveLength(3);
    expect(parsed.color).toBe("BLACK");
    expect(parsed.current_price).toBe(205);
    expect(parsed.list_price).toBe(249);
    expect(parsed.currency).toBe("EUR");
    expect(parsed.category_id).toBe("bot-cizme");
  });

  it("does not mistake a recommendation carousel item for the product color", () => {
    const html = product({ name: "Long Boots Femme Noir", sku: "PPC-2", color: "BLACK" })
      .replace(/<div class="col_16 img active">[\s\S]*?<\/div>/, "")
      + '<div class="col_16 img active"><a title="Ankle Boots Sunday in October">related</a></div>';
    const parsed = parsePapuceiProductPage(
      html,
      "https://www.papucei.ro/en/product/femme-noir/",
      OBSERVED_AT,
    );
    expect(parsed.color).toBeNull();
  });

  it("publishes staging only after terminal pagination and every detail page", async () => {
    const page2 = "https://www.papucei.ro/en/products-category/footwear/page/2/";
    const urls = [
      "https://www.papucei.ro/en/product/first-coffee/",
      "https://www.papucei.ro/en/product/first-coffee-2/",
      "https://www.papucei.ro/en/product/life-in-motion/",
    ];
    const pages = new Map<string, string>([
      [PAPUCEI_SOURCE.category_url, listing(urls.slice(0, 2), page2)],
      [page2, listing([urls[1]!, urls[2]!])],
      [urls[0]!, product({ name: "Heeled Boots First Coffee", sku: "PPC-1", color: "RED" })],
      [urls[1]!, product({ name: "Heeled Boots First Coffee", sku: "PPC-2", color: "BLACK" })],
      [urls[2]!, product({ name: "Flat Shoes Life in Motion", sku: "PPC-3", color: "BLACK", category: "Flat shoes" })],
    ]);
    const result = await collectPapuceiStaging({
      fetchHtml: async (url) => {
        const html = pages.get(url);
        if (!html) throw new Error(`missing fixture: ${url}`);
        return html;
      },
      now: () => OBSERVED_AT,
    });
    expect(result.publishable).toBe(true);
    expect(result.coverage).toMatchObject({
      source_total: 3,
      collected: 3,
      unique_models: 2,
      missing: 0,
      coverage_percent: 100,
      gallery_coverage_percent: 100,
      price_coverage_percent: 100,
      source_unavailable: false,
      pagination_complete: true,
      last_success_at: OBSERVED_AT,
    });
  });

  it("blocks a partial detail collect and preserves the previous success timestamp", async () => {
    const good = "https://www.papucei.ro/en/product/good/";
    const failed = "https://www.papucei.ro/en/product/failed/";
    const previous = "2026-09-16T08:00:00.000Z";
    const result = await collectPapuceiStaging({
      fetchHtml: async (url) => {
        if (url === PAPUCEI_SOURCE.category_url) return listing([good, failed]);
        if (url === good) return product({ name: "Flat Shoes Good", sku: "GOOD", color: "BLACK" });
        throw new Error("503");
      },
      now: () => OBSERVED_AT,
      previousLastSuccessAt: previous,
    });
    expect(result.publishable).toBe(false);
    expect(result.failed_product_urls).toEqual([failed]);
    expect(result.coverage).toMatchObject({
      status: "partial",
      source_total: 2,
      collected: 1,
      missing: 1,
      coverage_percent: 50,
      last_success_at: previous,
    });
  });

  it("does not publish when detail pages omit their full gallery", async () => {
    const url = "https://www.papucei.ro/en/product/no-gallery/";
    const withoutGallery = product({ name: "Flat Shoes No Gallery", sku: "NO-GALLERY", color: "BLACK" })
      .replace(/<img data-large_image=[^>]+>/g, "");
    const result = await collectPapuceiStaging({
      fetchHtml: async (requested) => requested === PAPUCEI_SOURCE.category_url
        ? listing([url])
        : withoutGallery,
      now: () => OBSERVED_AT,
    });
    expect(result.publishable).toBe(false);
    expect(result.coverage).toMatchObject({
      status: "partial",
      source_total: 1,
      collected: 1,
      missing: 0,
      coverage_percent: 100,
      gallery_coverage_percent: 0,
      last_success_at: null,
    });
  });

  it("reports an unreachable first page without inventing 100% coverage", async () => {
    const result = await collectPapuceiStaging({
      fetchHtml: async () => { throw new Error("403 blocked"); },
      now: () => OBSERVED_AT,
    });
    expect(result.publishable).toBe(false);
    expect(result.coverage).toMatchObject({
      status: "source_unavailable",
      source_total: null,
      collected: 0,
      missing: null,
      coverage_percent: null,
      source_unavailable: true,
      last_success_at: null,
    });
  });
});
