import { describe, expect, it } from "vitest";
import { collectMargaux } from "../margaux";
import { evaluateOfficialSourceCoverage } from "../../onboarding/validate";
import type { OnboardingHttp } from "../../onboarding/http";
import { shopifyProductToPilot } from "../shopify";
const origin = "https://www.margauxny.com";
const config = { id: "margaux", brand: "MARGAUX", baseUrl: origin, collectionPaths: [], maxProducts: 200 };
const shoe = (id: number) => ({ id, handle: `the-demi-${id}`, title: `The Demi ${id}`, product_type: "Demi",
  tags: ["ballets", "Top SKU", "cap toe"], images: [{ src: `${origin}/${id}.jpg` }], variants: [{ title: "38", sku: `D${id}-38` }] });
const accessory = { ...shoe(3), handle: "boot-sock", title: "The Boot Sock", product_type: "Sock", tags: ["shoes"] };
function transport(options: { count?: number; missingCategory?: boolean; failPage?: boolean; repeated?: boolean;
  changed?: boolean; filtered?: boolean; outside?: boolean; noGallery?: boolean; unknown?: boolean } = {}): OnboardingHttp {
  let html = 0;
  const shoes = [shoe(1), { ...shoe(2), images: options.noGallery ? [] : shoe(2).images }];
  const all = [...shoes, accessory, ...(options.unknown ? [{ ...shoe(4), title: "Unknown", product_type: "Unknown" }] : [])];
  return { async fetchText(url) {
    const u = new URL(url);
    if (!u.pathname.endsWith("products.json")) {
      html++;
      return { ok: true, status: 200, url: options.filtered ? `${url}?filter.v.availability=1` : url,
        text: `<span id="ProductCountDesktop">${options.changed && html > 1 ? 4 : options.count ?? all.length} products</span>` };
    }
    const page = Number(u.searchParams.get("page"));
    if (options.failPage && page === 2) return { ok: false, status: 503, url, text: "" };
    const batch = u.pathname.includes("/shop/") ? all : u.pathname.includes("/flats/")
      ? [...(options.missingCategory ? shoes.slice(0, 1) : shoes), ...(options.outside ? [shoe(99)] : [])] : [];
    return { ok: true, status: 200, url, text: JSON.stringify({ products: page === 1 || options.repeated ? batch : [] }) };
  } };
}
describe("Margaux official mixed storefront reconciliation", () => {
  it("identifies both storefront requests openly instead of using the shared obsolete browser UA", async () => {
    const delegate = transport();
    const headers: Array<Record<string, string> | undefined> = [];
    const result = await collectMargaux(config, { async fetchText(url, options) {
      if (!new URL(url).pathname.endsWith("products.json")) {
        headers.push(options?.headers);
        if (options?.headers?.["User-Agent"] !== "CAPONE-LAB/1.0 (public catalog verification)") {
          return { ok: false, status: 404, url, text: "404 Not Found" };
        }
      }
      return delegate.fetchText(url, options);
    } });
    expect(result.errors).toEqual([]);
    expect(headers).toHaveLength(2);
    expect(headers.every(x => x?.Accept === "text/html")).toBe(true);
  });
  it("proves opaque models by category membership and excludes accessories with misleading shoe tags", async () => {
    const result = await collectMargaux(config, transport());
    expect(result.errors).toEqual([]);
    expect(result.storefrontCount).toBe(3);
    expect(result.sourceReportedProductCount).toBe(2);
    expect(result.products).toHaveLength(2);
    expect(result.excludedAccessories).toEqual([{ url: `${origin}/products/boot-sock`, type: "Sock" }]);
    expect(result.products[0]).toMatchObject({ category: "BALLERINA", sourceProductType: "Demi", sourceProductTags: ["ballets", "Top SKU", "cap toe"] });
    expect(result.products[0]?.variants[0]?.sku).toBe("D1-38");
    expect(evaluateOfficialSourceCoverage({ ...result, acceptedProductCount: 2 }).full).toBe(true);
  });
  it("blocks missing source records, unknown types, missing membership and out-of-scope category products", async () => {
    for (const options of [{ count: 4 }, { unknown: true }, { missingCategory: true }, { outside: true }]) {
      const result = await collectMargaux(config, transport(options));
      expect(result.errors.length).toBeGreaterThan(0);
      expect(evaluateOfficialSourceCoverage({ ...result, acceptedProductCount: result.products.length }).full).toBe(false);
    }
  });
  it("rejects failed or repeated pagination, missing galleries, changed counts and filtered storefronts", async () => {
    for (const options of [{ failPage: true }, { repeated: true }, { noGallery: true }, { changed: true }, { filtered: true }]) {
      const result = await collectMargaux(config, transport(options));
      expect(result.errors.length).toBeGreaterThan(0);
      expect(evaluateOfficialSourceCoverage({ ...result, acceptedProductCount: result.products.length }).full).toBe(false);
    }
  });
  it("does not let explicit category evidence override non-footwear or alter default generic mapping", () => {
    expect(shopifyProductToPilot(shoe(1), config, "2026-09-30")).toBeNull();
    expect(shopifyProductToPilot({ ...accessory, title: "Cotton Tote", handle: "cotton-tote", product_type: "Tote" }, { ...config, verifiedFootwearPaths: ["/collections/flats"] },
      "2026-09-30", "/collections/flats", "Flats", "BALLERINA")).toBeNull();
    expect(shopifyProductToPilot({ ...shoe(1), product_type: "Top" }, { ...config, verifiedFootwearPaths: ["/collections/flats"] },
      "2026-09-30", "/collections/flats", "Flats", "BALLERINA")).toBeNull();
    expect(shopifyProductToPilot({ ...shoe(1), tags: ["cap"] }, { ...config, verifiedFootwearPaths: ["/collections/flats"] },
      "2026-09-30", "/collections/flats", "Flats", "BALLERINA")).toBeNull();
  });
});
