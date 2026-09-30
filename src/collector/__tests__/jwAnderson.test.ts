import { describe, expect, it } from "vitest";
import { collectJwAnderson } from "../jwAnderson";
import { evaluateOfficialSourceCoverage } from "../../onboarding/validate";
import type { OnboardingHttp } from "../../onboarding/http";
import { probeBrandSource } from "../../onboarding/probe";

const origin = "https://www.jwanderson.com";
const config = { id: "jw-anderson", brand: "JW ANDERSON", baseUrl: origin, collectionPaths: [], maxProducts: 200 };
const shoe = (id: number) => ({ id, handle: `womens-leather-mules-${id}`, title: `WOMENS LEATHER MULES ${id}`,
  product_type: "MULES", tags: ["Womens Shoes"], images: [{ src: `${origin}/shoe-${id}.jpg` }],
  variants: [{ title: "38", sku: `SH${id}-38` }] });
function http(options: { count?: number; products?: ReturnType<typeof shoe>[]; repeated?: boolean; failure?: boolean; changed?: boolean; redirect?: boolean } = {}): OnboardingHttp {
  let htmlRequests = 0;
  return { async fetchText(url) {
    if (url.endsWith(".json")) return { ok: true, status: 200, url, text: JSON.stringify({ collection: { products_count: 86 } }) };
    if (url.includes("products.json")) {
      const page = Number(new URL(url).searchParams.get("page")) || 1;
      if (page > 1 && options.failure) return { ok: false, status: 503, url, text: "" };
      return { ok: true, status: 200, url, text: JSON.stringify({ products: page === 1 || options.repeated ? options.products ?? [shoe(1), shoe(2)] : [] }) };
    }
    htmlRequests += 1;
    return { ok: true, status: 200, url: options.redirect ? `${origin}/collections/mens-shoes` : url,
      text: `<button><span>Show ${options.changed && htmlRequests > 1 ? 3 : options.count ?? 2} results</span></button>` };
  } };
}

describe("JW Anderson customer-visible women's catalog", () => {
  it("persists only the verified women's collection during onboarding discovery", async () => {
    const requests: string[] = [];
    const transport = http();
    const result = await probeBrandSource({ slug: config.id, brand: config.brand, sourceUrl: origin,
      http: { fetchText: async url => { requests.push(url); return transport.fetchText(url); } } });
    expect(result.strategy).toBe("shopify-public");
    expect(result.footwearPaths).toEqual(["/collections/womens-shoes"]);
    expect(requests.some(url => url === `${origin}/products.json?limit=8`)).toBe(false);
  });
  it("reconciles storefront products while retaining the disagreeing metadata total separately", async () => {
    const result = await collectJwAnderson(config, http());
    expect(result.products).toHaveLength(2);
    expect(result.storefrontCount).toBe(2);
    expect(result.collectionResourceCount).toBe(86);
    expect(result.sourceReportedProductCount).toBe(2);
    expect(result.pagesTraversed).toBe(2);
    expect(result.errors).toEqual([]);
    expect(evaluateOfficialSourceCoverage({ ...result, acceptedProductCount: result.products.length }).full).toBe(true);
    expect(result.products[0]?.variants[0]?.sku).toBe("SH1-38");
  });
  it("blocks real missing products instead of replacing the source total with the fetched count", async () => {
    const result = await collectJwAnderson(config, http({ count: 3 }));
    expect(result.errors).toContain("JW_ANDERSON_STOREFRONT_MISMATCH:2/2/3");
    expect(evaluateOfficialSourceCoverage({ ...result, acceptedProductCount: 2 }).full).toBe(false);
  });
  it("rejects repeated pagination and failed later pages", async () => {
    for (const options of [{ repeated: true }, { failure: true }]) {
      const result = await collectJwAnderson(config, http(options));
      expect(result.paginationExhausted).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
  it("keeps even one product without a real gallery out of a FULL delivery", async () => {
    const result = await collectJwAnderson(config, http({ products: [shoe(1), { ...shoe(2), images: [] }] }));
    expect(result.products).toHaveLength(1);
    expect(result.errors).toContain("JW_ANDERSON_MISSING_GALLERY:womens-leather-mules-2");
    expect(evaluateOfficialSourceCoverage({ ...result, acceptedProductCount: 1 }).full).toBe(false);
  });
  it("does not accept mens or non-footwear entries from a mixed collection", async () => {
    const result = await collectJwAnderson(config, http({ products: [{ ...shoe(1), title: "MENS LEATHER MULES", handle: "mens-mules" },
      { ...shoe(2), title: "WOMENS LOAFER BAG", handle: "womens-loafer-bag", product_type: "BAGS" }] }));
    expect(result.products).toEqual([]);
    expect(result.errors.some(error => error.includes("NON_WOMENS_FOOTWEAR"))).toBe(true);
  });
  it("rejects a changed storefront count and a redirect to another collection", async () => {
    for (const options of [{ changed: true }, { redirect: true }]) {
      const result = await collectJwAnderson(config, http(options));
      expect(result.errors.length).toBeGreaterThan(0);
      expect(evaluateOfficialSourceCoverage({ ...result, acceptedProductCount: result.products.length }).full).toBe(false);
    }
  });
});
