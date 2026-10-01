import { describe, expect, it } from "vitest";

import { assessSalesforceCatalog, decideSalesforcePublish } from "../coverage";
import {
  casadeiListingUrl,
  collectCasadeiWomensShoes,
  parseCasadeiMobifySearch,
} from "../casadei";
import { isColorSwatchImage } from "../gallery";
import { groupColorwaysIntoModelCards } from "../families";
import {
  collectJacquemusWomensShoes,
  isJacquemusStorefrontBlocked,
} from "../jacquemus";
import {
  collectJilSanderWomensShoes,
  jilSanderModelCode,
  parseJilSanderResultTotal,
  parseJilSanderTiles,
  parseJilSanderVariation,
  resolveJilSanderSizeSku,
} from "../jilSander";
import { SALESFORCE_INTEGRATION_PATCH } from "../index";
import type { SalesforceColorway, SalesforceHttp } from "../types";

const discoveredAt = "2026-09-30T06:00:00.000Z";

function casadeiHtml(page: { offset: number; total: number; hits: unknown[] }): string {
  const payload = {
    __PRELOADED_STATE__: {
      __STATE_MANAGEMENT_LIBRARY: {
        reduxStoreState: {
          productSearchResult: {
            "search-page_casadei_sfcc": {
              pages: { "1": page.hits },
              limit: 24,
              offset: page.offset,
              total: page.total,
            },
          },
        },
      },
    },
  };
  return `<script id="mobify-data" type="application/json">${JSON.stringify(payload)}</script>`;
}

function casadeiHit(input: {
  id: string;
  name: string;
  model: string;
  categoryId: string;
  categoryName: string;
  gender?: string;
  color?: string;
  image?: string;
  sizes?: Array<{ sku: string; size: string }>;
}): unknown {
  return {
    currency: "USD",
    price: 1295,
    productId: input.id,
    productName: input.name,
    c_url: `https://www.casadei.com/en/shoes/${input.name.toLowerCase().replace(/\s+/g, "-")}-${input.id}.html`,
    imageGroups: [{
      viewType: "zoom",
      images: [{
        link: input.image ?? `https://www.casadei.com/on/demandware.static/-/Sites-05/default/images/zoom/${input.id}_0.jpg`,
      }, {
        link: "https://www.casadei.com/on/demandware.static/-/Sites-05/default/images/swatch/color-chip.jpg",
      }],
    }],
    variants: (input.sizes ?? [{ sku: `${input.id}-35`, size: "35" }, { sku: `${input.id}-36`, size: "36" }]).map((size) => ({
      productId: size.sku,
      price: 1295,
      orderable: true,
      variationValues: { size: size.size, color: "3715" },
    })),
    representedProduct: {
      c_model: input.model,
      c_gender: input.gender ?? "FEMALE",
      c_colorDescription: input.color ?? "Porpora",
      c_materialDescription: "Suede",
      c_categoryId: input.categoryId,
      c_categoryName: input.categoryName,
    },
  };
}

const jilListing = `
<div class="search-results">81 results</div>
<div class="product-tile" data-tile-id="J16WS0042P3742001_001">
  <a href="/en-us/elbe-slipper/J16WS0042P3742001.html">
    <img alt="Elbe Slipper - Sneakers - Image 1" data-srcset="https://www.jilsander.com/dw/image/v2/BGNJ_PRD/on/demandware.static/-/Sites-jilsander-master-catalog/default/dw7be60417/images/large/J16WS0042_P3742_001_F.jpg?sw=256&amp;q=80 256w" />
  </a>
  <div class="tile-body"><div class="pdp-link"><h2 class="link"><a href="/en-us/elbe-slipper/J16WS0042P3742001.html">Elbe Slipper</a></h2></div>
  <p class="value" itemprop="price" content="790.00">$ 790</p></div>
</div>
<div class="product-tile" data-tile-id="J16WS0042P7894001_001">
  <div class="tile-body"><div class="pdp-link"><h2 class="link"><a href="/en-us/elbe-slipper/J16WS0042P7894001.html">Elbe Slipper</a></h2></div></div>
</div>
<div class="product-tile" data-tile-id="J16WS0042P3742001_001">
  <div class="tile-body"><div class="pdp-link"><h2 class="link"><a href="/en-us/elbe-slipper/J16WS0042P3742001.html">Elbe Slipper</a></h2></div></div>
</div>
`;

function jilVariation(pid: string, color: string): unknown {
  return {
    product: {
      id: pid,
      productName: "Elbe Slipper",
      genderCode: "F",
      masterCategoryID: "jilsander-woman-other-shoes",
      selectedProductUrl: `/en-us/elbe-slipper/${pid}.html?quantity=1`,
      price: { sales: { value: 790, currency: "USD", formatted: "$ 790.00" } },
      images: {
        large: [
          { url: `https://www.jilsander.com/on/demandware.static/-/Sites-jilsander-master-catalog/default/abc/images/large/${pid}_A.jpg` },
          { url: `https://www.jilsander.com/on/demandware.static/-/Sites-jilsander-master-catalog/default/abc/images/swatch/${pid}.jpg` },
        ],
        swatch: [{ url: "https://www.jilsander.com/images/swatch/black.jpg" }],
      },
      variationAttributes: [
        { id: "color", values: [{ value: color, displayValue: "black", selected: true }] },
        { id: "size", values: [{ value: "35", displayValue: "5", selected: false, selectable: true }] },
      ],
    },
  };
}

describe("Salesforce Commerce women's footwear adapters", () => {
  it("reads the Casadei US shoes search, drops price and swatches, and keeps size SKUs", () => {
    const parsed = parseCasadeiMobifySearch(casadeiHtml({
      offset: 0,
      total: 2,
      hits: [
        casadeiHit({ id: "1L486C1301T05943715", name: "Patty Platform Sandal", model: "1L486C130", categoryId: "shoes-platforms", categoryName: "Platforms", color: "Porpora" }),
        casadeiHit({ id: "1L486C1301T05949000", name: "Patty Platform Sandal", model: "1L486C130", categoryId: "shoes-platforms", categoryName: "Platforms", color: "Black" }),
        casadeiHit({ id: "BAG001", name: "Night Bag", model: "BAG001", categoryId: "bags", categoryName: "Bags" }),
      ],
    }));
    expect(parsed.total).toBe(2);
    expect(parsed.currency).toBe("USD");
    expect(parsed.hits).toHaveLength(3);
    expect(parsed.hits[0]?.images.some((image) => image.includes("swatch"))).toBe(false);
    expect(parsed.hits[0]?.sizes.map((size) => size.sku)).toEqual([
      "1L486C1301T05943715-35",
      "1L486C1301T05943715-36",
    ]);
    expect(JSON.stringify(parsed.hits)).not.toContain("1295");
  });

  it("paginates Casadei, quarantines bags, groups colours, and stays a baseline", async () => {
    const pages = [
      casadeiHtml({
        offset: 0,
        total: 3,
        hits: [
          casadeiHit({ id: "SHOE1", name: "Blade Pump", model: "MODEL1", categoryId: "shoes-pumps", categoryName: "Pumps" }),
          casadeiHit({ id: "SHOE1B", name: "Blade Pump", model: "MODEL1", categoryId: "shoes-pumps", categoryName: "Pumps", color: "Nude" }),
        ],
      }),
      casadeiHtml({
        offset: 2,
        total: 3,
        hits: [
          casadeiHit({ id: "BAG9", name: "City Bag", model: "BAG9", categoryId: "city-bags", categoryName: "Bags" }),
        ],
      }),
    ];
    const http: SalesforceHttp = {
      async fetchText(url) {
        const page = url.includes("page=2") ? pages[1] : pages[0];
        return { ok: true, status: 200, text: page ?? "", url };
      },
    };
    const catalog = await collectCasadeiWomensShoes(http, { collectedAt: discoveredAt });
    expect(casadeiListingUrl(2)).toBe("https://www.casadei.com/en-us/shoes/?page=2");
    expect(catalog.status).toBe("FULL");
    expect(catalog.sourceReportedTotal).toBe(3);
    expect(catalog.scopeProductUrls).toHaveLength(3);
    expect(catalog.accepted).toHaveLength(2);
    expect(catalog.quarantined.map((item) => item.reason)).toEqual(["non-footwear"]);
    expect(catalog.families).toHaveLength(1);
    expect(catalog.families[0]?.colorways).toHaveLength(2);
    expect(catalog.families[0]?.coverImage).toMatch(/images\/zoom\//);
    expect(catalog.newProducts).toBe(0);
    expect(catalog.accepted.every((product) => product.isNew === false && product.inNewArrivals === false)).toBe(true);
    expect(catalog.scope.country).toBe("US");
    expect(catalog.scope.storefront).toBe("en-us");
    expect(catalog.scope.collectionId).toBe("shoes");
  });

  it("uses matching official US product construction and footwear HS evidence for opaque names", async () => {
    const hit=casadeiHit({id:"OPAQUE",name:"Jelly",model:"OPAQUE",categoryId:"shoes-flats",categoryName:"Flats"}) as {representedProduct:Record<string,unknown>};
    hit.representedProduct.c_hsCode="64035911";
    const http: SalesforceHttp={async fetchText(url) {return {ok:true,status:200,url,text:url.includes(".html") ? `<script type="application/ld+json">${JSON.stringify({"@type":"Product",sku:"OPAQUE",description:"A T-bar sandal",audience:{audienceType:"FEMALE"},offers:{priceCurrency:"USD"}})}</script>` : casadeiHtml({offset:0,total:1,hits:[hit]})};}};
    const result=await collectCasadeiWomensShoes(http);
    expect(result.status).toBe("FULL");
    expect(result.accepted[0]?.category).toBe("SANDAL");
    expect(result.accepted[0]?.sourceDescription).toBe("A T-bar sandal");
    hit.representedProduct.c_hsCode="42022100";
    expect((await collectCasadeiWomensShoes(http)).status).toBe("PARTIAL");
  });

  it("uses the official boot category for over-the-knee products with opaque model names", async () => {
    const http: SalesforceHttp = { async fetchText(url) { return {ok:true,status:200,url,text:casadeiHtml({offset:0,total:1,hits:[casadeiHit({id:"BOOT",name:"Blade Corsair",model:"BOOT",categoryId:"shoes-overtheknee",categoryName:"Over The Knee"})]})}; } };
    const catalog=await collectCasadeiWomensShoes(http);
    expect(catalog.status).toBe("FULL");
    expect(catalog.accepted[0]?.category).toBe("BOOT");
  });

  it("does not call a partial Casadei page FULL and keeps the previous catalog", async () => {
    const http: SalesforceHttp = {
      async fetchText(url) {
        return {
          ok: true,
          status: 200,
          text: casadeiHtml({
            offset: 0,
            total: 4,
            hits: [casadeiHit({ id: "ONLY", name: "Pump", model: "ONLY", categoryId: "shoes-pumps", categoryName: "Pumps" })],
          }),
          url,
        };
      },
    };
    const catalog = await collectCasadeiWomensShoes(http, { collectedAt: discoveredAt, maxPages: 1 });
    expect(catalog.status).not.toBe("FULL");
    expect(catalog.blocker).toBe("PAGINATION_NOT_EXHAUSTED");
    expect(decideSalesforcePublish({
      previousAccepted: 10,
      status: catalog.status,
      acceptedFootwear: catalog.accepted.length,
    })).toEqual({ publish: false, retainPrevious: true, blocker: catalog.status });
  });

  it("parses Jil Sander tiles without prices and groups colourways by model", () => {
    expect(parseJilSanderResultTotal(jilListing)).toBe(81);
    const tiles = parseJilSanderTiles(jilListing);
    expect(tiles.map((tile) => tile.productId)).toEqual(["J16WS0042P3742001", "J16WS0042P7894001"]);
    expect(JSON.stringify(tiles)).not.toContain("790");
    const variation = parseJilSanderVariation(jilVariation("J16WS0042P3742001", "001"));
    expect(variation?.images).toEqual([
      "https://www.jilsander.com/on/demandware.static/-/Sites-jilsander-master-catalog/default/abc/images/large/J16WS0042P3742001_A.jpg",
    ]);
    expect(isColorSwatchImage("https://www.jilsander.com/images/swatch/black.jpg")).toBe(true);
    expect(resolveJilSanderSizeSku({ product: { id: "8058304592259", isVariant: true } }, "8058304590000")).toBe("8058304592259");
    expect(resolveJilSanderSizeSku({
      product: { id: "J15WL0067P7689607", isVariant: false, defaultVariant: { id: "8058304350668", isVariant: true } },
    }, "8058304543626")).toBe("8058304350668");
    expect(resolveJilSanderSizeSku({
      product: { id: "J34WS0003P8572200", isVariant: false, defaultVariant: { id: "4070032253954", isVariant: true } },
    }, "4070032253954")).toBeNull();
    expect(jilSanderModelCode("J16WS0042P3742001")).toBe("J16WS0042");
    const colorways: SalesforceColorway[] = tiles.map((tile) => ({
      productId: tile.productId,
      productUrl: tile.productUrl,
      productName: tile.productName,
      color: "black",
      material: null,
      sku: "8058304592259",
      category: "SNEAKER",
      images: [`https://www.jilsander.com/images/large/${tile.productId}.jpg`],
      sizes: [{ size: "35", displaySize: "5", sku: "8058304592259", selectable: true }],
      modelCode: jilSanderModelCode(tile.productId),
      gender: "FEMALE",
      sourceCategoryId: "jilsander-woman-other-shoes",
      sourceCategoryName: "Shoes",
      inNewArrivals: false,
      isNew: false,
      hasNewBadge: false,
    }));
    const cards = groupColorwaysIntoModelCards("jil-sander", "JIL SANDER", colorways);
    expect(cards).toHaveLength(1);
    expect(cards[0]?.colorways).toHaveLength(2);
    expect(cards[0]?.isNew).toBe(false);
  });

  it("reconciles a Jil Sander grid with variation galleries and size SKUs", async () => {
    const listing = jilListing.replace("81 results", "2 results");
    const http: SalesforceHttp = {
      async fetchText(url) {
        if (url.includes("Product-Variation") && url.includes("size=")) {
          return { ok: true, status: 200, text: JSON.stringify({ product: { id: "8058304592259", isVariant: true } }), url };
        }
        if (url.includes("Product-Variation")) {
          const pid = new URL(url).searchParams.get("pid") ?? "";
          return { ok: true, status: 200, text: JSON.stringify(jilVariation(pid, "001")), url };
        }
        return { ok: true, status: 200, text: listing, url };
      },
    };
    const catalog = await collectJilSanderWomensShoes(http, { collectedAt: discoveredAt });
    expect(catalog.status).toBe("FULL");
    expect(catalog.sourceReportedTotal).toBe(2);
    expect(catalog.accepted).toHaveLength(2);
    expect(catalog.families).toHaveLength(1);
    expect(catalog.accepted.every((product) => product.sizes[0]?.sku === "8058304592259")).toBe(true);
    expect(catalog.accepted.every((product) => product.isNew === false)).toBe(true);
    expect(JSON.stringify(catalog.accepted)).not.toContain("790");
    expect(catalog.scope.collectionId).toBe("jilsander-woman-other-shoes");
    expect(catalog.scope.country).toBe("US");
  });

  it("keeps a Ring Ballerina in women's footwear instead of treating ring as jewelry", async () => {
    const listing = `
      <div>1 results</div>
      <div class="product-tile" data-tile-id="J15WZ0039P7588688_001">
        <div class="tile-body"><div class="pdp-link"><h2 class="link"><a href="/en-us/ring-ballerina/J15WZ0039P7588688.html">Ring Ballerina</a></h2></div></div>
      </div>`;
    const variation = jilVariation("J15WZ0039P7588688", "688");
    (variation as { product: { productName: string } }).product.productName = "Ring Ballerina";
    const http: SalesforceHttp = {
      async fetchText(url) {
        if (url.includes("size=")) {
          return { ok: true, status: 200, text: JSON.stringify({ product: { id: "8058304000001", isVariant: true } }), url };
        }
        if (url.includes("Product-Variation")) {
          return { ok: true, status: 200, text: JSON.stringify(variation), url };
        }
        return { ok: true, status: 200, text: listing, url };
      },
    };
    const catalog = await collectJilSanderWomensShoes(http, { collectedAt: discoveredAt });
    expect(catalog.status).toBe("FULL");
    expect(catalog.accepted.map((product) => product.category)).toEqual(["BALLERINA"]);
    expect(catalog.quarantined).toHaveLength(0);
  });

  it("keeps Jacquemus blocked and unpublished when the official site is in maintenance", async () => {
    const html = "<title>Site en cours de maintenance</title>";
    expect(isJacquemusStorefrontBlocked({ status: 403, html })).toBe(true);
    const http: SalesforceHttp = {
      async fetchText(url) {
        return { ok: false, status: 403, text: html, url };
      },
    };
    const catalog = await collectJacquemusWomensShoes(http, { collectedAt: discoveredAt });
    expect(catalog.status).toBe("BLOCKED");
    expect(catalog.status).not.toBe("FULL");
    expect(catalog.accepted).toHaveLength(0);
    expect(catalog.families).toHaveLength(0);
    expect(catalog.attempts?.length).toBeGreaterThan(1);
    expect(decideSalesforcePublish({
      previousAccepted: null,
      status: catalog.status,
      acceptedFootwear: 0,
    }).publish).toBe(false);
  });

  it("never treats a blocked source as a full catalog", () => {
    const assessment = assessSalesforceCatalog({
      blocked: true,
      sourceReportedTotal: 10,
      scopeProductUrls: [],
      accepted: [],
      quarantined: [],
      paginationExhausted: false,
      pageErrors: ["HTTP 403"],
    });
    expect(assessment.status).toBe("BLOCKED");
  });

  it("documents the shared-file integration for Codex", () => {
    expect(SALESFORCE_INTEGRATION_PATCH).toContain("src/onboarding/collect.ts");
    expect(SALESFORCE_INTEGRATION_PATCH).toContain("src/onboarding/probe.ts");
    expect(SALESFORCE_INTEGRATION_PATCH).toContain("src/registry/collection/collectByType.ts");
    expect(SALESFORCE_INTEGRATION_PATCH).toContain("jacquemus");
    expect(SALESFORCE_INTEGRATION_PATCH).toContain("baseline");
  });
});
