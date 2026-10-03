import { mkdtemp, mkdir, readFile, writeFile, rm, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { NEXT_OFFICIAL_SHOPIFY_BRAND_TARGETS, OFFICIAL_SHOPIFY_BRAND_TARGETS } from "../candidates";
import { collectOfficialShopifyBrand, type OfficialHttp } from "../collect";
import { officialCatalogPublishBlocker, publishOfficialBrandCatalog } from "../publish";
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

  it("refreshes official NEW membership and standalone tags only on active refresh", async () => {
    const http: OfficialHttp = { async fetchText(url) {
      if (url.includes("collections.json")) return jsonResponse({ collections: [{ handle: "new-in", title: "New In", products_count: 1 }] }, url);
      if (url.includes("/collections/new-in/products.json")) return jsonResponse({ products: [{ handle: "black-boot" }] }, url);
      const response = await fakeHttp().fetchText(url);
      if (url.includes("/collections/shoes/products.json")) {
        const data = JSON.parse(response.text);
        data.products[1].tags.push("NEW");
        return jsonResponse(data, url);
      }
      return response;
    } };
    const target = { slug: "example", brand: "EXAMPLE", origin: "https://example.test", localePath: "", collections: [{ handle: "shoes" }] };
    const baseline = await collectOfficialShopifyBrand(target, http, "2026-10-03T10:00:00Z");
    expect(baseline.catalog?.families.every((family) => !family.isNew)).toBe(true);
    const refreshed = await collectOfficialShopifyBrand(target, http, "2026-10-04T10:00:00Z", { refresh: true });
    expect(refreshed.evidence.status).toBe("FULL");
    expect(refreshed.catalog?.newArrivalsPaths).toEqual(["/collections/new-in"]);
    expect(refreshed.catalog?.families.flatMap((family) => family.variants).map((variant) => variant.newnessEvidence)).toEqual(["NEW_ARRIVALS_COLLECTION", "SOURCE_BADGE"]);
    expect(officialCatalogPublishBlocker(refreshed.catalog, refreshed.evidence)).toBeNull();
    expect(officialCatalogPublishBlocker(refreshed.catalog, { ...refreshed.evidence, refresh: false })).toBe("BASELINE_MARKED_NEW");
  });

  it("rejects a failed or malformed NEW listing so last-good cannot be replaced", async () => {
    const target = { slug: "example", brand: "EXAMPLE", origin: "https://example.test", localePath: "", collections: [{ handle: "shoes" }] };
    for (const malformed of [false, true]) {
      const http: OfficialHttp = { async fetchText(url) {
        if (url.includes("collections.json")) return jsonResponse({ collections: [{ handle: "new-in", title: "New In", products_count: 1 }] }, url);
        if (url.includes("/collections/new-in/products.json")) return malformed ? jsonResponse({}, url) : { ok: false, status: 503, url, text: "Unavailable" };
        return fakeHttp().fetchText(url);
      } };
      const result = await collectOfficialShopifyBrand(target, http, "2026-10-04T10:00:00Z", { refresh: true });
      expect(result.catalog).toBeNull();
      expect(result.evidence.status).toBe("PARTIAL");
      expect(result.evidence.blocker).toContain("NEW /collections/new-in");
    }
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

  it("preserves archived model identities and galleries while retiring stale source NEW", async () => {
    const root = await mkdtemp(join(tmpdir(), "capone-official-refresh-"));
    try {
      const dir = join(root, "data/multibrand/model-families");
      await mkdir(dir, { recursive: true });
      await mkdir(join(root, "data/registry"), { recursive: true });
      const universe = JSON.parse(await readFile("data/registry/brand-universe.json", "utf8"));
      universe.brands.push({ ...universe.brands[0], id: "example", brand: "EXAMPLE", officialUrl: "https://example.test", isActive: true });
      await writeFile(join(root, "data/registry/brand-universe.json"), JSON.stringify(universe));
      const manifest = JSON.parse(await readFile("data/multibrand/model-families/manifest.json", "utf8"));
      await writeFile(join(dir, "manifest.json"), JSON.stringify({ ...manifest, shards: [], totalFamilies: 0, shardCount: 0 }));
      const target = { slug: "example", brand: "EXAMPLE", origin: "https://example.test", localePath: "", collections: [{ handle: "shoes" }] };
      const baseline = await collectOfficialShopifyBrand(target, fakeHttp(), "2026-10-03T10:00:00Z");
      expect((await publishOfficialBrandCatalog({ root, ...baseline, http: fakeHttp() })).published).toBe(true);
      const shardFile = join(dir, "brands/example.json");
      const previous = JSON.parse(await readFile(shardFile, "utf8"));
      const archived = { ...previous[0], modelFamilyId: "example-archived", canonicalName: "Archived Boot", variants: [{ ...previous[0].variants[0], url: "https://example.test/products/archived", images: ["https://cdn.test/archive.jpg"] }], sourceSightings: previous[0].sourceSightings.map((sighting: Record<string, unknown>) => ({ ...sighting, newness: { status: "VERIFIED_NEW", evidenceType: "SOURCE_BADGE", firstVerifiedAt: "2026-10-03T10:00:00Z", lastVerifiedAt: "2026-10-03T10:00:00Z", effectiveNewAt: "2026-10-03T10:00:00Z", evidenceUrl: "https://example.test/products/archived", evidenceText: "NEW", confidence: 0.9 } })) };
      await writeFile(shardFile, JSON.stringify([...previous, archived]));
      const currentManifest = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8"));
      currentManifest.shards[0].familyCount += 1;
      currentManifest.totalFamilies += 1;
      await writeFile(join(dir, "manifest.json"), JSON.stringify(currentManifest));
      // Legacy catalogs store the same official IDs in shared core shards.
      await rename(shardFile, join(dir, "part-000.json"));
      currentManifest.shards[0].file = "part-000.json";
      await writeFile(join(dir, "manifest.json"), JSON.stringify(currentManifest));
      const http: OfficialHttp = { async fetchText(url) {
        if (url.includes("collections.json")) return jsonResponse({ collections: [{ handle: "new-in", title: "New In", products_count: 0 }] }, url);
        if (url.includes("/collections/new-in/products.json")) return jsonResponse({ products: [] }, url);
        return fakeHttp().fetchText(url);
      } };
      const refreshed = await collectOfficialShopifyBrand(target, http, "2026-10-04T10:00:00Z", { refresh: true });
      expect((await publishOfficialBrandCatalog({ root, ...refreshed, http })).published).toBe(true);
      const delivered = JSON.parse(await readFile(shardFile, "utf8"));
      expect(delivered.map((family: { modelFamilyId: string }) => family.modelFamilyId)).toContain(previous[0].modelFamilyId);
      const retained = delivered.find((family: { modelFamilyId: string }) => family.modelFamilyId === archived.modelFamilyId);
      expect(retained.variants[0].images).toEqual(["https://cdn.test/archive.jpg"]);
      expect(retained.sourceSightings[0].newness.status).not.toBe("VERIFIED_NEW");
      const afterManifest = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8"));
      const all = (await Promise.all(afterManifest.shards.map(async (shard: { file: string }) => JSON.parse(await readFile(join(dir, shard.file), "utf8"))))).flat();
      expect(all.map((family: { modelFamilyId: string }) => family.modelFamilyId).sort()).toEqual(delivered.map((family: { modelFamilyId: string }) => family.modelFamilyId).sort());
      const beforeFailed = await readFile(shardFile, "utf8");
      expect((await publishOfficialBrandCatalog({ root, catalog: null, evidence: { ...refreshed.evidence, status: "PARTIAL", blocker: "NEW unavailable" }, http })).published).toBe(false);
      expect(await readFile(shardFile, "utf8")).toBe(beforeFailed);
    } finally { await rm(root, { recursive: true, force: true }); }
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
