import { describe, expect, it } from "vitest";

import {
  looksLikeLowResolutionShopifyUrl,
  normalizeProductImageUrls,
  pickHighestResolutionUrl,
  resolveDisplayImage,
  toCloudflareOriginalUrl,
  toShopifyOriginalUrl,
} from "../resolveImageQuality";

describe("image quality resolver", () => {
  it("resolves a low-resolution Shopify thumbnail to the original asset", () => {
    const thumb =
      "https://cdn.shopify.com/s/files/1/0247/6975/products/shoe_100x.jpg?v=1&width=200";
    const original = toShopifyOriginalUrl(thumb);
    expect(original).not.toContain("_100x");
    expect(original).not.toContain("width=200");
    expect(looksLikeLowResolutionShopifyUrl(thumb)).toBe(true);
  });

  it("keeps an already-high-resolution Shopify URL valid", () => {
    const hi =
      "https://cdn.shopify.com/s/files/1/0247/6975/products/shoe.jpg?v=9";
    expect(toShopifyOriginalUrl(hi)).toContain("/products/shoe.jpg");
    const display = resolveDisplayImage(hi);
    expect(display?.src).toContain("width=1200");
    expect(display?.srcSet).toContain("800w");
  });

  it("does not invent URLs for unknown hosts", () => {
    const url = "https://cdn.example.com/photos/shoe.jpg";
    expect(toShopifyOriginalUrl(url)).toBe(url);
    expect(resolveDisplayImage(url)?.src).toBe(url);
    expect(resolveDisplayImage(url)?.srcSet).toBeUndefined();
  });

  it("removes duplicate images after resolving size variants", () => {
    expect(
      normalizeProductImageUrls([
        "https://cdn.shopify.com/s/files/1/1/products/a_100x.jpg",
        "https://cdn.shopify.com/s/files/1/1/products/a.jpg?width=200",
        "https://cdn.shopify.com/s/files/1/1/products/b.jpg",
      ]),
    ).toHaveLength(2);
  });

  it("falls back when images are missing", () => {
    expect(pickHighestResolutionUrl([null, "", "not-a-url"])).toBeNull();
    expect(resolveDisplayImage(null)).toBeNull();
  });

  it("unwraps Cloudflare image-resizing URLs to the original catalog asset", () => {
    const resized =
      "https://assets.levelshoes.com/cdn-cgi/image/width=200,height=280,quality=85,format=webp/media/catalog/product/a/b/shoe.jpg?ts=1";
    const original = toCloudflareOriginalUrl(resized);
    expect(original).not.toContain("cdn-cgi/image");
    expect(original).toContain("/media/catalog/product/a/b/shoe.jpg");
    expect(normalizeProductImageUrls([resized])[0]).not.toContain("cdn-cgi/image");
  });
});
