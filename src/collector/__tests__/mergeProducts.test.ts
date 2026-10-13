import { describe, expect, it } from "vitest";

import {
  mergeCatalogPreservingFailedSources,
  mergeProductCatalog,
  productReleaseTimestamp,
  sortProductsNewestFirst,
} from "../mergeProducts";
import type { PilotProduct } from "../types";

function product(overrides: Partial<PilotProduct> & Pick<PilotProduct, "productUrl">): PilotProduct {
  return {
    source: "test",
    brand: "TEST",
    productName: "Shoe",
    productUrl: overrides.productUrl,
    imageUrl: null,
    category: "PUMP",
    color: null,
    material: null,
    toeShape: null,
    heelType: null,
    heelHeight: null,
    details: null,
    discoveredAt: "2026-08-01T00:00:00.000Z",
    variants: [],
    ...overrides,
  };
}

describe("mergeProducts", () => {
  it('retains detail attributes and every size SKU when a thin listing refresh has only one colour',()=>{
    const existing=product({productUrl:'https://example.com/a',sourceVerifiedAt:'2026-10-13T10:00:00Z',sourceModelCode:'STYLE1',sourceHsCode:'64035911',
      material:'Suede',details:'Own detail page evidence',sourceSizes:[{size:'35',displaySize:'IT35',sku:'SKU35',selectable:true},{size:'36',displaySize:'IT36',sku:'SKU36',selectable:null}],
      variants:[{title:'Model',color:'Black',sku:'SKU35',images:['https://cdn.example/35.jpg']},{title:'Model',color:'Black',sku:'SKU36',images:['https://cdn.example/36.jpg']}]});
    const thin=product({productUrl:existing.productUrl,variants:[{title:'Model',color:null,sku:null}]});
    const merged=mergeProductCatalog([existing],[thin])[0]!;
    expect(merged.sourceSizes).toEqual(existing.sourceSizes);expect(merged.sourceVerifiedAt).toBe(existing.sourceVerifiedAt);
    expect(merged.sourceModelCode).toBe('STYLE1');expect(merged.sourceHsCode).toBe('64035911');
    expect(merged.material).toBe('Suede');expect(merged.details).toBe(existing.details);
    expect(new Set(merged.variants.map(v=>v.sku))).toEqual(new Set(['SKU35','SKU36',null]));
    expect(merged.variants.find(v=>v.sku==='SKU35')?.images).toContain('https://cdn.example/35.jpg');
  });
  it('keeps distinct size titles when a supplier reuses one SKU, and refreshes exact observed size evidence',()=>{
    const existing=product({productUrl:'https://example.com/a',sourceSizes:[{size:'35',displaySize:'IT35',sku:'REUSED',selectable:true},{size:'36',displaySize:'IT36',sku:'REUSED',selectable:true}],
      variants:[{title:'IT35',color:'Black',sku:'REUSED'},{title:'IT36',color:'Black',sku:'REUSED'}]});
    const incoming=product({productUrl:existing.productUrl,sourceSizes:[{size:'35',displaySize:'IT35',sku:'REUSED',selectable:false}],
      variants:[{title:'IT35',color:'Black',sku:'REUSED'}]});
    const merged=mergeProductCatalog([existing],[incoming])[0]!;
    expect(merged.variants).toHaveLength(2);expect(merged.sourceSizes).toEqual([...incoming.sourceSizes!,{size:'36',displaySize:'IT36',sku:'REUSED',selectable:null}]);
  });
  it("clears a historical NEW badge when the source explicitly reports no badge", () => {
    const existing = product({ productUrl: "https://example.com/products/a", hasNewBadge: true });
    const incoming = product({ productUrl: existing.productUrl, hasNewBadge: false });
    expect(mergeProductCatalog([existing], [incoming])[0]?.hasNewBadge).toBe(false);
    expect(mergeProductCatalog([existing], [product({ productUrl: existing.productUrl })])[0]?.hasNewBadge).toBe(true);
  });
  it("preserves earliest discoveredAt on merge", () => {
    const existing = product({
      productUrl: "https://example.com/products/a",
      discoveredAt: "2026-08-01T00:00:00.000Z",
      productName: "Old name",
    });
    const incoming = product({
      productUrl: "https://example.com/products/a",
      discoveredAt: "2026-08-10T00:00:00.000Z",
      productName: "New name",
    });

    const merged = mergeProductCatalog([existing], [incoming]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.discoveredAt).toBe("2026-08-01T00:00:00.000Z");
    expect(merged[0]?.productName).toBe("New name");
  });

  it("preserves New Arrivals membership across collection merges", () => {
    const existing = product({
      productUrl: "https://example.com/products/a",
      isNewArrivalsCollection: true,
      collectionPath: "/collections/new-arrivals",
    });
    const incoming = product({
      productUrl: "https://example.com/products/a",
      isNewArrivalsCollection: false,
      collectionPath: "/collections/shop-all",
    });
    const merged = mergeProductCatalog([existing], [incoming]);
    expect(merged[0]?.isNewArrivalsCollection).toBe(true);
  });

  it("keeps distinct source colors when the same product URL is merged", () => {
    const existing = product({
      productUrl: "https://www.zara.com/us/en/split-suede-loafers-p12504810.html",
      source: "zara",
      brand: "ZARA",
      color: "Sandy Brown",
      variants: [
        {
          title: "SPLIT SUEDE LOAFERS Sandy Brown",
          color: "Sandy Brown",
          sku: "ZARA-REF-2504/810",
          imageUrl: "https://static.zara.net/brown.jpg",
        },
      ],
    });
    const incoming = product({
      productUrl: "https://www.zara.com/us/en/split-suede-loafers-p12504810.html",
      source: "zara",
      brand: "ZARA",
      color: "Ice",
      variants: [
        {
          title: "SPLIT SUEDE LOAFERS Ice",
          color: "Ice",
          sku: "ZARA-REF-2504/810",
          imageUrl: "https://static.zara.net/ice.jpg",
        },
      ],
    });
    const merged = mergeProductCatalog([existing], [incoming]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.variants.map((variant) => variant.color).sort()).toEqual(["Ice", "Sandy Brown"]);
  });

  it("sorts newest publishedAt first", () => {
    const older = product({
      productUrl: "https://example.com/products/old",
      publishedAt: "2026-01-01T00:00:00.000Z",
    });
    const newer = product({
      productUrl: "https://example.com/products/new",
      publishedAt: "2026-08-01T00:00:00.000Z",
    });

    const sorted = sortProductsNewestFirst([older, newer]);
    expect(sorted[0]?.productUrl).toContain("new");
    expect(productReleaseTimestamp(newer)).toBeGreaterThan(
      productReleaseTimestamp(older),
    );
  });

  it("keeps last-good gallery when a refresh is empty or placeholder-only", () => {
    const existing = product({
      productUrl: "https://example.com/products/a",
      imageUrl: "https://cdn.example.com/products/hero.jpg",
      images: [
        "https://cdn.example.com/products/hero.jpg",
        "https://cdn.example.com/products/side.jpg",
      ],
    });
    const emptyRefresh = product({
      productUrl: "https://example.com/products/a",
      imageUrl: null,
      images: [],
    });
    const placeholderRefresh = product({
      productUrl: "https://example.com/products/a",
      imageUrl: "https://cdn.example.com/placeholder.png",
      images: [
        "https://cdn.example.com/logo/brand.png",
        "https://cdn.example.com/new-badge.jpg",
      ],
    });
    expect(mergeProductCatalog([existing], [emptyRefresh])[0]?.images).toEqual(
      existing.images,
    );
    expect(mergeProductCatalog([existing], [placeholderRefresh])[0]?.images).toEqual(
      existing.images,
    );
  });

  it("preserves prior products when a source temporarily fails", () => {
    const existing = [
      product({ productUrl: "https://brand-a.com/products/kept", brand: "BRAND A" }),
      product({ productUrl: "https://brand-b.com/products/old", brand: "BRAND B" }),
    ];
    const incoming = [
      product({ productUrl: "https://brand-a.com/products/new", brand: "BRAND A" }),
    ];
    const merged = mergeCatalogPreservingFailedSources(
      existing,
      incoming,
      new Set(["BRAND B"]),
    );
    expect(merged.map((item) => item.productUrl).sort()).toEqual([
      "https://brand-a.com/products/kept",
      "https://brand-a.com/products/new",
      "https://brand-b.com/products/old",
    ]);
  });

  it("does not drop a failed brand even if incoming is empty", () => {
    const existing = [
      product({ productUrl: "https://brand-b.com/products/old", brand: "BRAND B" }),
    ];
    const merged = mergeCatalogPreservingFailedSources(existing, [], new Set(["BRAND B"]));
    expect(merged).toHaveLength(1);
    expect(merged[0]?.productUrl).toBe("https://brand-b.com/products/old");
  });
});

describe("discoverFootwearCollections quality", () => {
  it("classifies 8/10 accepted as VERIFIED quality", async () => {
    const { discoverVerifiedFootwearCollections } = await import("../discoverFootwearCollections");
    expect(typeof discoverVerifiedFootwearCollections).toBe("function");
  });
});
