import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  familiesMissingFromDelivery,
  omitNonFootwearFamilies,
  reclassifyWaveFamily,
  removeDuplicateVariants,
} from "../deliveryLink";
import { planWomensCollections } from "../collections";
import { classifyOfficialFootwear, isNonFootwearCatalogItem } from "../primaryCategory";
import { buildWaveCoverage, fullCatalogPassBlocker } from "../coverage";
import { groupColorwaysIntoFamilies } from "../families";
import { classifyWomensFootwear } from "../footwearScope";
import { decideLastGoodPublish } from "../lastGood";
import { assignProductNewness } from "../newness";
import { buildDeterministicWaveBrands } from "../officialBrands";
import { mapPool } from "../pool";
import { classifyStorefrontResponse, collectShopifyWomensCatalog, listAllShopifyCollections, paginateCollectionProducts } from "../shopifyAdapter";
import type { ModelFamily } from "../../../modelFamily/types";
import type { WaveHttp } from "../types";
import { WAVE_COLLECTOR_CONCURRENCY } from "../types";

describe("brands wave 50", () => {
  it("builds a deterministic 100-brand list starting with Naked Wolfe", () => {
    const universe = JSON.parse(readFileSync("data/registry/brand-universe.json", "utf-8")) as {
      brands: Array<{ id: string; brand: string; officialUrl: string; collectorType: string }>;
    };
    const first = buildDeterministicWaveBrands(universe.brands);
    const second = buildDeterministicWaveBrands(universe.brands);
    expect(first).toHaveLength(100);
    expect(first[0]?.slug).toBe("naked-wolfe");
    expect(first[0]?.referenceFootwearTotal).toBe(328);
    expect(first[0]?.referenceNewArrivals).toBe(126);
    expect(first.map((brand) => brand.slug)).toEqual(second.map((brand) => brand.slug));
    expect(new Set(first.map((brand) => brand.slug)).size).toBe(100);
    expect(first.every((brand) => brand.officialUrl.startsWith("https://"))).toBe(true);
    expect(first[1]?.slug).not.toBe("prada");
  });

  it("keeps women's footwear and drops men, bags, and accessories", () => {
    expect(classifyWomensFootwear({ title: "Bedford Black", productType: "Boots", handle: "bedford" }).decision).toBe(
      "footwear",
    );
    expect(classifyWomensFootwear({ title: "Sporty", productType: "Sneakers", handle: "sporty" }).decision).toBe(
      "footwear",
    );
    expect(classifyWomensFootwear({ title: "Mule", productType: "Sandals/Slides", handle: "slide" }).decision).toBe(
      "footwear",
    );
    expect(classifyWomensFootwear({ title: "Tote", productType: "Bags", handle: "tote" }).decision).toBe("excluded");
    expect(classifyWomensFootwear({ title: "Cap", productType: "Hats", handle: "cap" }).decision).toBe("excluded");
    expect(classifyWomensFootwear({ title: "Chain", productType: "Jewelry", handle: "chain" }).decision).toBe(
      "excluded",
    );
    expect(classifyWomensFootwear({ title: "Wipe", productType: "Shoe Care", handle: "wipe" }).decision).toBe(
      "excluded",
    );
    expect(classifyWomensFootwear({ title: "Shade", productType: "Sunglasses", handle: "shade" }).decision).toBe(
      "excluded",
    );
    expect(classifyWomensFootwear({ title: "Brief", productType: "Underwear", handle: "brief" }).decision).toBe(
      "excluded",
    );
    expect(
      classifyWomensFootwear({ title: "Men's Runner", productType: "Sneakers", handle: "mens-runner" }).decision,
    ).toBe("excluded");
    expect(
      classifyWomensFootwear({ title: "Cap Toe Boot", productType: "Boots", handle: "cap-toe-boot" }).decision,
    ).toBe("footwear");
    expect(
      classifyWomensFootwear({ title: "Hue Double Black Aviator", productType: "", handle: "hue-double-black-aviator" })
        .decision,
    ).toBe("excluded");
    expect(
      classifyWomensFootwear({
        title: "Nappa over-the-knee boots black",
        productType: "Shoes",
        handle: "nappa-over-the-knee-boots-black",
        tags: ["recommended-product:mercer-leather-tote-black"],
      }).decision,
    ).toBe("footwear");
  });

  it("requires source NEW evidence even for a URL added after baseline", () => {
    expect(assignProductNewness({ productUrl: "https://brand.test/products/a", inNewArrivals: false }, null)).toEqual({
      isNew: false,
      newnessEvidence: null,
    });
    expect(assignProductNewness({ productUrl: "https://brand.test/products/b", inNewArrivals: true }, null)).toEqual({
      isNew: true,
      newnessEvidence: "NEW_ARRIVALS_COLLECTION",
    });
    expect(assignProductNewness({ productUrl: "https://brand.test/products/a", inNewArrivals: false, hasNewBadge: true }, null)).toEqual({
      isNew: true, newnessEvidence: "SOURCE_BADGE",
    });
    const previous = new Set(["https://brand.test/products/a"]);
    expect(
      assignProductNewness({ productUrl: "https://brand.test/products/c", inNewArrivals: false }, previous),
    ).toEqual({ isNew: false, newnessEvidence: null });
    expect(
      assignProductNewness({ productUrl: "https://brand.test/products/a", inNewArrivals: false }, previous),
    ).toEqual({ isNew: false, newnessEvidence: null });
  });

  it("groups colorways under one model and keeps every gallery image", () => {
    const families = groupColorwaysIntoFamilies("NAKED WOLFE", "naked-wolfe", [
      {
        handle: "bedford-black",
        productUrl: "https://nakedwolfe.com/products/bedford-black",
        title: "Bedford Black Leather",
        color: null,
        sku: "1",
        images: ["https://cdn.test/a.jpg", "https://cdn.test/b.jpg"],
        category: "BALLERINA",
        productType: "Flats",
        tags: ["FOOTWEAR", "variant_bedford-white"],
        inNewArrivals: true,
        isNew: true,
        newnessEvidence: "NEW_ARRIVALS_COLLECTION",
      },
      {
        handle: "bedford-white",
        productUrl: "https://nakedwolfe.com/products/bedford-white",
        title: "Bedford White Leather",
        color: null,
        sku: "2",
        images: ["https://cdn.test/c.jpg", "https://cdn.test/a.jpg"],
        category: "BALLERINA",
        productType: "Flats",
        tags: ["FOOTWEAR", "variant_bedford-black"],
        inNewArrivals: false,
        isNew: false,
        newnessEvidence: null,
      },
      {
        handle: "sporty-green",
        productUrl: "https://nakedwolfe.com/products/sporty-green",
        title: "Sporty Green Suede",
        color: "Green",
        sku: "3",
        images: ["https://cdn.test/d.jpg"],
        category: "SNEAKER",
        productType: "Sneakers",
        tags: ["FOOTWEAR"],
        inNewArrivals: false,
        isNew: false,
        newnessEvidence: null,
      },
    ]);
    const bedford = families.find((family) => family.canonicalName.toLowerCase().includes("bedford"));
    expect(bedford?.variants).toHaveLength(2);
    expect(bedford?.images).toEqual([
      "https://cdn.test/a.jpg",
      "https://cdn.test/b.jpg",
      "https://cdn.test/c.jpg",
    ]);
    expect(families).toHaveLength(2);
    expect(families.some((family) => family.variants.length === 1 && family.canonicalName.includes("Sporty"))).toBe(
      true,
    );
  });

  it("recrawls an empty official NEW collection so historical badges can retire", () => {
    const plan = planWomensCollections([
      { handle: "shoes", title: "Shoes", productsCount: 20 },
      { handle: "new-in", title: "New In", productsCount: 0 },
    ]);
    expect(plan.newArrivalsPaths).toEqual(["/collections/new-in"]);
  });

  it("selects the official women's catalog and ignores men's and bag collections", () => {
    const plan = planWomensCollections([
      { handle: "view-all-womens", title: "Women's View All", productsCount: 545 },
      { handle: "handbags", title: "Bags", productsCount: 17 },
      { handle: "new-arrivals", title: "Women's New Arrivals", productsCount: 170 },
      { handle: "new-arrivals-1", title: "Men's New Arrivals", productsCount: 43 },
      { handle: "new-season-women", title: "New Season - Women", productsCount: 48 },
      { handle: "accessories-new-arrivals", title: "Women's New Bags & Accessories", productsCount: 72 },
      { handle: "shoe-care", title: "Shoe Care", productsCount: 7 },
    ]);
    expect(plan.catalogPaths).toEqual(["/collections/view-all-womens"]);
    expect(plan.newArrivalsPaths).toEqual(["/collections/new-arrivals"]);
    const toteme = planWomensCollections([
      { handle: "shoes", title: "Shoes", productsCount: 116 },
      { handle: "shoes-boots", title: "Boots", productsCount: 87 },
      { handle: "shoes-flats", title: "Flats", productsCount: 38 },
      { handle: "shoes-pumps-mules", title: "Pumps & Mules", productsCount: 73 },
      { handle: "new-in", title: "New In", productsCount: 65 },
    ]);
    expect(toteme.catalogPaths).toEqual([
      "/collections/shoes-boots",
      "/collections/shoes-flats",
      "/collections/shoes-pumps-mules",
    ]);
    expect(toteme.newArrivalsPaths).toEqual(["/collections/new-in"]);
    const totemeShopAll = planWomensCollections([
      { handle: "shop-all", title: "Shop all", productsCount: 1445 },
      { handle: "shoes", title: "Shoes", productsCount: 219 },
      { handle: "shoes-boots", title: "Boots", productsCount: 87 },
      { handle: "shoes-flats", title: "Flats", productsCount: 38 },
      { handle: "shoes-pumps-mules", title: "Pumps & Mules", productsCount: 73 },
      { handle: "new-in", title: "New In", productsCount: 65 },
      { handle: "new-in-drop39", title: "New In Drop 39", productsCount: 12 },
    ]);
    expect(totemeShopAll.catalogPaths).toEqual(["/collections/shoes"]);
    expect(totemeShopAll.newArrivalsPaths).toEqual(["/collections/new-in"]);
    const parisTexas = planWomensCollections([
      { handle: "all", title: "All products", productsCount: 344 },
      { handle: "boots", title: "Boots", productsCount: 212 },
      { handle: "mules-sandals", title: "Mules & Sandals", productsCount: 69 },
    ]);
    expect(parisTexas.catalogPaths).toEqual(["/collections/all"]);
    const simone = planWomensCollections([
      { handle: "all", title: "Shop All", productsCount: 692 },
      { handle: "flats", title: "Flats", productsCount: 163 },
      { handle: "shoes", title: "Women's Shoes", productsCount: 21 },
      { handle: "men-shoes", title: "Men's Shoes", productsCount: 6 },
    ]);
    expect(simone.catalogPaths).toEqual(["/collections/flats", "/collections/shoes"]);
    const alohas = planWomensCollections([
      { handle: "new-in", title: "New In", productsCount: 40 },
      { handle: "new-in-drop39", title: "New In Drop 39", productsCount: 18 },
      { handle: "new-in-boots", title: "New In Boots", productsCount: 9 },
      { handle: "shoes", title: "Shoes", productsCount: 260 },
    ]);
    expect(alohas.newArrivalsPaths).toEqual(["/collections/new-in"]);
    expect(alohas.catalogPaths).toEqual(["/collections/shoes"]);
    const facets = Array.from({ length: 20 }, (_, index) => ({
      handle: `black-heels-${index}`,
      title: "Black Heels",
      productsCount: 40,
    }));
    const madden = planWomensCollections([{ handle: "all", title: "All", productsCount: 4000 }, ...facets]);
    expect(madden.catalogPaths).toEqual(["/collections/all"]);
    const atp = planWomensCollections([
      { handle: "shop-all", title: "Shop all", productsCount: 1966 },
      { handle: "us-shoes", title: "Shoes", productsCount: 881 },
      { handle: "shoes", title: "Shoes", productsCount: 337 },
      { handle: "sandals", title: "Sandals", productsCount: 432 },
    ]);
    expect(atp.catalogPaths).toEqual(["/collections/us-shoes"]);
    const flabelus = planWomensCollections([
      { handle: "all", title: "All", productsCount: 1714 },
      { handle: "heel", title: "Heel", productsCount: 40 },
      { handle: "lewis-oxford", title: "Lewis Oxford", productsCount: 12 },
      { handle: "mary-jane", title: "Mary Jane", productsCount: 30 },
    ]);
    expect(flabelus.catalogPaths).toEqual(["/collections/all"]);
  });

  it("refuses to replace last-good with an empty, partial, or sample collect", () => {
    const complete = buildWaveCoverage({
      sourceTotal: 328,
      collected: 328,
      excluded: 60,
      paginationExhausted: true,
      galleryComplete: 328,
      taxonomyPassed: true,
      womenFootwearOnly: true,
      sampleOnly: false,
    });
    expect(fullCatalogPassBlocker(complete)).toBeNull();
    expect(
      decideLastGoodPublish({
        previousCollected: 328,
        candidate: { productUrls: Array.from({ length: 328 }, (_, index) => `https://x/${index}`) },
        coverage: complete,
      }).publish,
    ).toBe(true);

    const sample = buildWaveCoverage({ ...complete, sampleOnly: true, sourceTotal: 8, collected: 8, galleryComplete: 8 });
    expect(fullCatalogPassBlocker(sample)).toBe("SAMPLE_NOT_FULL_CATALOG");
    expect(
      decideLastGoodPublish({
        previousCollected: 328,
        candidate: { productUrls: ["https://x/1"] },
        coverage: sample,
      }),
    ).toMatchObject({ publish: false, retainPrevious: true });

    expect(
      decideLastGoodPublish({
        previousCollected: 328,
        candidate: null,
        coverage: null,
      }),
    ).toMatchObject({ publish: false, retainPrevious: true, blocker: "EMPTY_OR_FAILED_COLLECT" });

    const partial = buildWaveCoverage({ ...complete, sourceTotal: 328, collected: 100, galleryComplete: 100 });
    expect(
      decideLastGoodPublish({
        previousCollected: 328,
        candidate: { productUrls: Array.from({ length: 100 }, (_, index) => `https://x/${index}`) },
        coverage: partial,
      }).blocker,
    ).toBe("FULL_CATALOG_COVERAGE_NOT_VERIFIED");
    expect(
      decideLastGoodPublish({
        previousCollected: null,
        candidate: { productUrls: Array.from({ length: 287 }, (_, index) => `https://x/${index}`) },
        coverage: buildWaveCoverage({
          sourceTotal: 287,
          collected: 287,
          excluded: 60,
          paginationExhausted: true,
          galleryComplete: 287,
          taxonomyPassed: true,
          womenFootwearOnly: true,
          sampleOnly: false,
        }),
        referenceFootwearTotal: 328,
        referenceNewArrivals: 126,
        newArrivalsFootwear: 135,
      }).blocker,
    ).toBe("REFERENCE_FOOTWEAR_MISMATCH");
  });

  it("keeps collector concurrency at or below 10", async () => {
    let active = 0;
    let maxActive = 0;
    await mapPool(Array.from({ length: 25 }, (_, index) => index), WAVE_COLLECTOR_CONCURRENCY, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 15));
      active -= 1;
    });
    expect(maxActive).toBeLessThanOrEqual(10);
    expect(maxActive).toBeGreaterThan(1);
  });

  it("blocks incomplete collection discovery and invalid NEW payloads instead of clearing evidence", async () => {
    const http: WaveHttp = { async fetch(url) {
      const data = url.includes("collections.json")
        ? { collections: Array.from({ length: 250 }, (_, i) => ({ handle: `shoes-${i}`, title: "Shoes", products_count: 1 })) }
        : {};
      const ok = !url.includes("page=2");
      return { ok, status: ok ? 200 : 503, url, data: ok ? data : null, text: "" };
    } };
    expect((await listAllShopifyCollections(http, "https://brand.test")).error).toContain("page 2");
    expect((await paginateCollectionProducts(http, "https://brand.test", "/collections/new-in")).error).toBe("INVALID_PRODUCTS_PAYLOAD");
  });

  it("collects a fixture catalog without treating non-footwear as source total", async () => {
    const pages: Record<string, unknown> = {
      "https://nakedwolfe.com/collections.json?limit=250&page=1": {
        collections: [
          { handle: "view-all-womens", title: "Women's View All", products_count: 4 },
          { handle: "new-arrivals", title: "Women's New Arrivals", products_count: 1 },
          { handle: "handbags", title: "Bags", products_count: 1 },
        ],
      },
      "https://nakedwolfe.com/collections/view-all-womens/products.json?limit=250&page=1": {
        products: [
          { id: 1, title: "Bedford Black Leather", handle: "bedford-black", product_type: "Flats", tags: ["FOOTWEAR", "variant_bedford-white"], images: [{ src: "https://cdn.test/a.jpg" }, { src: "https://cdn.test/b.jpg" }], variants: [{ sku: "1", title: "36" }] },
          { id: 2, title: "Bedford White Leather", handle: "bedford-white", product_type: "Flats", tags: ["FOOTWEAR", "variant_bedford-black"], images: [{ src: "https://cdn.test/c.jpg" }], variants: [{ sku: "2", title: "37" }] },
          { id: 3, title: "City Tote", handle: "city-tote", product_type: "Bags", tags: ["BAG"], images: [{ src: "https://cdn.test/bag.jpg" }], variants: [] },
          { id: 4, title: "Men's Runner", handle: "mens-runner", product_type: "Sneakers", tags: ["MENS"], images: [{ src: "https://cdn.test/m.jpg" }], variants: [] },
        ],
      },
      "https://nakedwolfe.com/collections/new-arrivals/products.json?limit=250&page=1": {
        products: [
          { id: 1, title: "Bedford Black Leather", handle: "bedford-black", product_type: "Flats", tags: ["FOOTWEAR"], images: [{ src: "https://cdn.test/a.jpg" }], variants: [] },
        ],
      },
    };
    const http: WaveHttp = {
      async fetch(url: string) {
        const data = pages[url] ?? null;
        return { ok: Boolean(data), status: data ? 200 : 404, url, data, text: data ? JSON.stringify(data) : "" };
      },
    };
    const result = await collectShopifyWomensCatalog({
      seed: {
        slug: "naked-wolfe",
        brand: "NAKED WOLFE",
        officialUrl: "https://nakedwolfe.com",
        womenCollectionPath: "/collections/view-all-womens",
        newArrivalsPath: "/collections/new-arrivals",
      },
      http,
      now: "2026-09-26T12:00:00.000Z",
      previousUrls: null,
    });
    expect(result.blocker).toBeNull();
    expect(result.catalog?.coverage.sourceTotal).toBe(2);
    expect(result.catalog?.coverage.collected).toBe(2);
    expect(result.catalog?.coverage.missing).toBe(0);
    expect(result.catalog?.coverage.excluded).toBe(2);
    expect(result.catalog?.newArrivalsFootwear).toBe(1);
    expect(result.catalog?.families).toHaveLength(1);
    expect(result.catalog?.families[0]?.variants).toHaveLength(2);
    expect(result.catalog?.families[0]?.variants.filter((variant) => variant.isNew)).toHaveLength(1);
    expect(result.catalog?.families[0]?.images).toEqual([
      "https://cdn.test/a.jpg",
      "https://cdn.test/b.jpg",
      "https://cdn.test/c.jpg",
    ]);
  });

  it("routes unreachable hosts and non-shopify storefronts to separate queues", () => {
    expect(
      classifyStorefrontResponse({
        homepage: { ok: false, status: 403, url: "https://x", data: null, text: "cf-challenge" },
        products: { ok: false, status: 403, url: "https://x/products.json", data: null, text: "" },
        collections: { ok: false, status: 403, url: "https://x/collections.json", data: null, text: "" },
      }),
    ).toBe("SOURCE_UNAVAILABLE");
    expect(
      classifyStorefrontResponse({
        homepage: { ok: true, status: 200, url: "https://x", data: null, text: "<html>shop</html>" },
        products: { ok: false, status: 404, url: "https://x/products.json", data: null, text: "missing" },
        collections: { ok: false, status: 404, url: "https://x/collections.json", data: null, text: "missing" },
      }),
    ).toBe("CUSTOM_ADAPTER_REQUIRED");
    expect(
      classifyStorefrontResponse({
        homepage: { ok: true, status: 200, url: "https://x", data: null, text: "<html></html>" },
        products: { ok: true, status: 200, url: "https://x/products.json", data: { products: [] }, text: "{}" },
        collections: null,
      }),
    ).toBe("ACCESSIBLE");
  });

  it("maps official product types onto short footwear categories", () => {
    expect(classifyOfficialFootwear({ title: "Bedford Black", productType: "Flats" })).toBe("BALLET_FLAT");
    expect(classifyOfficialFootwear({ title: "Haute Black Suede", productType: "Boots" })).toBe("BOOT");
    expect(classifyOfficialFootwear({ title: "Blizzard Black", productType: "Loafers" })).toBe("LOAFER");
    expect(classifyOfficialFootwear({ title: "Court", productType: "Heels" })).toBe("PUMP");
    expect(classifyOfficialFootwear({ title: "Runner", productType: "Sneaker" })).toBe("SNEAKER");
    expect(classifyOfficialFootwear({ title: "Harlow Black Suede", productType: "Slippers" })).toBe("LOAFER");
    expect(
      classifyOfficialFootwear({
        title: "SAPATOS ABF-97 ESTELA SUEDE CAMEL",
        productType: "Sapato",
        description: "estes mocassins ABF-97 distinguem-se pela silhueta intemporal",
      }),
    ).toBe("LOAFER");
    expect(
      classifyOfficialFootwear({
        title: "SAPATOS EXE VIENA 500 BLACK",
        productType: "Sapato",
        description: "Salto com altura de 9 cm.",
      }),
    ).toBe("PUMP");
    expect(
      classifyOfficialFootwear({
        title: "SAPATOS ABF-97 DILMA 400 GREEN",
        productType: "Sapato",
        description: "a sola baixa e flexível garante leveza",
      }),
    ).toBe("BALLET_FLAT");
    expect(
      classifyOfficialFootwear({
        title: "MOCASSINS ABF-97 ALEXA",
        productType: "Mocassins",
      }),
    ).toBe("LOAFER");
    expect(classifyOfficialFootwear({ title: "Ellie Suede Almond-Toe Flats", productType: "Shoes" })).toBe(
      "BALLET_FLAT",
    );
    expect(classifyOfficialFootwear({ title: "Anok Sling 105 Leopard", productType: "SHOES" })).toBe("PUMP");
    expect(classifyOfficialFootwear({ title: "Lupita Slipper 95 Leopard", productType: "SHOES" })).toBe("MULE");
    expect(
      classifyOfficialFootwear({
        title: "Ribbon Linen Grey",
        productType: "Ribbon",
        description: "Linen slipper in light brown with light grey piping and light grey laces.",
      }),
    ).toBe("LOAFER");
    expect(
      classifyOfficialFootwear({
        title: "Amaranta Kids",
        productType: "Kids",
        description: "Velvet mary jane in mustard with mustard piping and buckle closure.",
      }),
    ).toBe("BALLET_FLAT");
    expect(
      classifyOfficialFootwear({
        title: "Finch",
        productType: "Belgian",
        description: "Velvet belgian in light brown with light brown instep.",
      }),
    ).toBe("LOAFER");
    expect(
      classifyOfficialFootwear({
        title: "Mermaid Coffee",
        productType: "Mermaid",
        description: "V-hollow ballerina in dark beige linen.",
      }),
    ).toBe("BALLET_FLAT");
    expect(
      classifyOfficialFootwear({
        title: "The Old Sport Beige",
        productType: "Old Sport",
        description: "Beige aged linen lace-up flatform ankle boot with burgundy leather toe cap.",
      }),
    ).toBe("BOOT");
    expect(classifyOfficialFootwear({ title: "Costa - Tennis à bride en toile", productType: "Chaussures" })).toBe(
      "SNEAKER",
    );
    expect(classifyOfficialFootwear({ title: "Petite Kina - Babies cuir bleu marine", productType: "Chaussures" })).toBe(
      "BALLET_FLAT",
    );
    expect(classifyOfficialFootwear({ title: "Malaga - Bottes cuir verni leopard", productType: "Chaussures" })).toBe(
      "BOOT",
    );
    expect(classifyOfficialFootwear({ title: "Cyprus Boat Shoe Platina Leather", productType: "Boat Shoe" })).toBe(
      "LOAFER",
    );
    expect(
      classifyOfficialFootwear({
        title: "FORMAL SLIP ON",
        productType: "Shoes",
        description: "This pair of loafers revisits an emblematic style.",
      }),
    ).toBe("LOAFER");
    expect(classifyOfficialFootwear({ title: "Boss Lady Welly Mini", productType: "Footwear" })).toBe("BOOT");
    expect(
      classifyOfficialFootwear({
        title: "ZABELLE FLAT - LUWAK",
        productType: "SHOES",
        description: "A flat padded shearling sandal with crossover straps.",
      }),
    ).toBe("SANDAL");
    expect(classifyOfficialFootwear({ title: "Butterfly Flat", productType: "Footwear" })).toBe("BALLET_FLAT");
    expect(
      classifyOfficialFootwear({
        title: "Butterfly Slipper",
        productType: "Footwear",
        description: "This slipper features a tonal butterfly wing at toe and a chrome block heel.",
      }),
    ).toBe("MULE");
    expect(
      classifyOfficialFootwear({
        title: "Mafalda Navy",
        productType: "Mafalda",
        description: "Velvet mafalda in dark blue with dark blue piping and dark blue velvet lace.",
      }),
    ).toBe("BALLET_FLAT");
    expect(classifyOfficialFootwear({ title: "TOP-DOWN", productType: "Pump" })).toBe("PUMP");
    expect(
      classifyOfficialFootwear({
        title: "Wendy Kids",
        productType: "Kids",
        tags: "Archive Sale, Slipper",
      }),
    ).toBe("LOAFER");
    expect(isNonFootwearCatalogItem({ title: "Cathy - Chaussettes damier courtes noir" })).toBe(true);
    expect(isNonFootwearCatalogItem({ title: "Madeleine - Sac épaule cuir verni rouge" })).toBe(true);
    expect(isNonFootwearCatalogItem({ title: "Malaga - Bottes cuir verni leopard" })).toBe(false);
  });

  it("links only catalog urls that are missing from brand pages", () => {
    const existing = {
      modelFamilyId: "existing",
      brand: "TOTEME",
      canonicalName: "Existing",
      category: "BOOT",
      primaryCategory: "BOOT",
      representativeProductId: "https://toteme.com/products/old",
      representativeImage: null,
      representativeImages: [],
      variantCount: 1,
      variants: [
        {
          productId: "https://toteme.com/products/old",
          title: "Old",
          url: "https://toteme.com/products/old",
          color: null,
          material: null,
          images: [],
        },
      ],
      allImages: [],
      sourceProductIds: ["https://toteme.com/products/old"],
      groupingConfidence: "HIGH",
      groupingReason: "single-product",
    } satisfies ModelFamily;
    const incoming: ModelFamily = {
      ...existing,
      modelFamilyId: "toteme--new",
      variants: [
        existing.variants[0]!,
        {
          productId: "https://toteme.com/products/new",
          title: "New",
          url: "https://toteme.com/products/new",
          color: "Black",
          material: null,
          images: ["https://cdn.test/new.jpg"],
        },
      ],
      variantCount: 2,
    };
    const linked = familiesMissingFromDelivery([existing], [incoming]);
    expect(linked).toHaveLength(1);
    expect(linked[0]?.variants.map((variant) => variant.url)).toEqual(["https://toteme.com/products/new"]);
    expect(familiesMissingFromDelivery([existing, linked[0]!], [incoming])).toEqual([]);
    const stored = reclassifyWaveFamily({
      ...existing,
      brand: "NAKED WOLFE",
      category: "OTHER_FOOTWEAR",
      primaryCategory: "UNCLASSIFIED",
      sourceSightings: [
        {
          sourceId: "naked-wolfe",
          sourceLabel: "NAKED WOLFE",
          sourceKind: "BRAND_OFFICIAL",
          firstSeenAt: "2026-09-26T00:00:00.000Z",
          lastSeenAt: "2026-09-26T00:00:00.000Z",
          newness: {
            status: "NOT_VERIFIED",
            evidenceType: null,
            firstVerifiedAt: null,
            lastVerifiedAt: null,
            effectiveNewAt: null,
            evidenceUrl: null,
            evidenceText: null,
            confidence: 0,
          },
          sourceCategories: [{ categoryId: "boots", categoryName: "Boots" }],
        },
      ],
    });
    expect(stored.primaryCategory).toBe("BOOT");
    expect(stored.category).toBe("BOOT");
    const duplicated: ModelFamily = {
      ...incoming,
      modelFamilyId: "exe--dup",
      variants: [
        {
          productId: "https://exe.test/products/old",
          title: "Old color",
          url: "https://exe.test/products/old",
          color: "Black",
          material: null,
          images: [],
        },
        {
          productId: "https://exe.test/products/new-color",
          title: "New color",
          url: "https://exe.test/products/new-color",
          color: "Camel",
          material: null,
          images: ["https://cdn.test/camel.jpg"],
        },
      ],
    };
    const deduped = removeDuplicateVariants(
      [
        {
          ...existing,
          variants: [
            {
              ...existing.variants[0]!,
              url: "https://exe.test/products/old",
              productId: "https://exe.test/products/old",
            },
          ],
          sourceProductIds: ["https://exe.test/products/old"],
        },
      ],
      [duplicated],
    );
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.variants.map((variant) => variant.url)).toEqual(["https://exe.test/products/new-color"]);
    const sock: ModelFamily = {
      ...existing,
      modelFamilyId: "carel--sock",
      canonicalName: "Cathy - Chaussettes damier",
      variants: [
        {
          ...existing.variants[0]!,
          title: "Cathy - Chaussettes damier courtes noir",
          url: "https://carel.fr/products/cathy",
        },
      ],
    };
    expect(omitNonFootwearFamilies([sock, existing])).toEqual([existing]);
  });
});
