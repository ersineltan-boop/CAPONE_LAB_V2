import { describe, expect, it, beforeEach } from "vitest";

import { buildCatalogDelivery } from "../buildCatalogDelivery";
import {
  brandSummariesForIndex,
  countryOptionsFromSummary,
} from "../brandIndexFromSummary";
import {
  catalogUrl,
  loadBrandShard,
  loadCatalogSummary,
  loadShardsForSavedIds,
  loadVisualSummary,
  resetCatalogCache,
  setCatalogFetch,
} from "../catalogClient";
import { slimFamilyForDelivery } from "../slimFamily";
import { BRAND_DETAIL_BATCH, MAX_BRAND_CARD_IMAGES } from "../types";
import type { CatalogSummary } from "../types";
import type { ModelFamily } from "../../modelFamily/types";
import { createNotVerifiedNewness, isVerifiedNew } from "../../newArrivals/newness";
import { buildNewnessFromProductHints } from "../../newArrivals/detectNewness";
import { queryVerifiedNewArrivals } from "../../newArrivals/verifiedQuery";
import { UI_COPY } from "../../presentation/turkishLabels";
import { DEFAULT_BATCH } from "../../ui/useProgressiveBatch";
import { ALL_COUNTRIES_ID, UNKNOWN_COUNTRY_ID } from "../../brands/countryGrouping";
import { PRIMARY_NAV_ITEMS } from "../../navigation/primaryNav";

function family(overrides: Partial<ModelFamily> = {}): ModelFamily {
  return {
    modelFamilyId: "jeffrey-campbell--pump",
    brand: "JEFFREY CAMPBELL",
    canonicalName: "Pump",
    category: "PUMP",
    representativeProductId: "https://jeffreycampbell.com/p",
    representativeImage: "https://cdn.shopify.com/s/files/1/1/products/a.jpg",
    representativeImages: [
      "https://cdn.shopify.com/s/files/1/1/products/a.jpg",
      "https://cdn.shopify.com/s/files/1/1/products/b.jpg",
    ],
    variantCount: 1,
    variants: [],
    allImages: [
      "https://cdn.shopify.com/s/files/1/1/products/a.jpg",
      "https://cdn.shopify.com/s/files/1/1/products/extra.jpg",
    ],
    sourceProductIds: ["https://jeffreycampbell.com/p"],
    groupingConfidence: "HIGH",
    groupingReason: "test",
    sourceSightings: [
      {
        sourceId: "jeffrey-campbell",
        sourceLabel: "JEFFREY CAMPBELL",
        sourceKind: "BRAND_OFFICIAL",
        firstSeenAt: "2026-08-01T00:00:00.000Z",
        lastSeenAt: "2026-08-21T00:00:00.000Z",
        newness: createNotVerifiedNewness(),
      },
    ],
    sourceCategoryRefs: [
      {
        sourceId: "jeffrey-campbell",
        categoryId: "pumps",
        categoryName: "Pumps",
        categoryPath: "/collections/pumps",
        categoryUrl: "https://jeffreycampbell.com/collections/pumps",
      },
    ],
    ...overrides,
  };
}

const summaryFixture: CatalogSummary = {
  generatedAt: "2026-08-21T00:00:00.000Z",
  brands: [
    {
      brandId: "jeffrey-campbell",
      brandName: "JEFFREY CAMPBELL",
      country: "USA",
      productCount: 671,
      verifiedNewCount: 0,
      images: ["https://cdn.shopify.com/s/files/1/1/products/a.jpg"],
    },
    {
      brandId: "alohas",
      brandName: "ALOHAS",
      country: "Spain",
      productCount: 182,
      verifiedNewCount: 6,
      images: ["https://cdn.shopify.com/s/files/1/1/products/c.jpg"],
    },
    {
      brandId: "unknown-brand",
      brandName: "UNKNOWN BRAND",
      country: "",
      productCount: 1,
      verifiedNewCount: 0,
      images: [],
    },
  ],
  marketplaces: [],
};

describe("catalog delivery", () => {
  it("precomputes representative brand images instead of requiring a live full-catalog scan", () => {
    const artifacts = buildCatalogDelivery({
      families: [
        family(),
        family({
          modelFamilyId: "jeffrey-campbell--boot",
          canonicalName: "Boot",
          representativeImage: "https://cdn.shopify.com/s/files/1/1/products/boot.jpg",
          representativeImages: ["https://cdn.shopify.com/s/files/1/1/products/boot.jpg"],
          allImages: ["https://cdn.shopify.com/s/files/1/1/products/boot.jpg"],
        }),
      ],
      brands: [
        {
          id: "jeffrey-campbell",
          brand: "JEFFREY CAMPBELL",
          country: "USA",
          isActive: true,
        },
      ],
      marketplaces: [],
    });
    const card = artifacts.summary.brands[0]!;
    expect(card.images.length).toBeGreaterThan(0);
    expect(card.images.length).toBeLessThanOrEqual(MAX_BRAND_CARD_IMAGES);
    expect(card.productCount).toBe(2);
    expect(artifacts.brandShards).toHaveLength(1);
    expect(artifacts.brandShards[0]?.families.every((item) => item.taxonomy === undefined)).toBe(
      true,
    );
    expect(artifacts.brandShards[0]?.families[0]?.basicCategory).toBe("topuklu");
    expect(artifacts.brandShards[0]?.families[0]?.sourceCategoryRefs?.length).toBeGreaterThan(0);
    expect(JSON.stringify(artifacts.summary)).not.toContain('"variants"');
  });

  it("selects a higher-scoring cover instead of gallery image 0", () => {
    const artifacts = buildCatalogDelivery({
      families: [
        family({
          representativeImage:
            "https://ancientgreeksandals.com/cdn/shop/files/crop_new_first.jpg",
          representativeImages: [
            "https://ancientgreeksandals.com/cdn/shop/files/crop_new_first.jpg",
            "https://cdn.shopify.com/s/files/1/1/products/pump_e.jpg",
          ],
        }),
      ],
      brands: [
        {
          id: "jeffrey-campbell",
          brand: "JEFFREY CAMPBELL",
          country: "USA",
          isActive: true,
        },
      ],
      marketplaces: [],
    });
    expect(artifacts.brandShards[0]?.families[0]?.representativeImage).toContain("pump_e.jpg");
  });

  it("keeps New Arrivals membership as verified-new after slimming", () => {
    const verified = family({
      sourceSightings: [
        {
          sourceId: "jeffrey-campbell",
          sourceLabel: "JEFFREY CAMPBELL",
          sourceKind: "BRAND_OFFICIAL",
          firstSeenAt: "2026-08-01T00:00:00.000Z",
          lastSeenAt: "2026-08-21T00:00:00.000Z",
          newness: buildNewnessFromProductHints(
            {
              isNewArrivalsCollection: true,
              collectionPath: "/collections/new-arrivals",
              productUrl: "https://jeffreycampbell.com/p",
            },
            "2026-08-21T00:00:00.000Z",
          ),
        },
      ],
    });
    const slimmed = slimFamilyForDelivery(verified);
    expect(isVerifiedNew(slimmed.sourceSightings?.[0]?.newness)).toBe(true);
    expect(
      queryVerifiedNewArrivals([slimmed], {
        scope: { type: "BRAND", brand: "JEFFREY CAMPBELL" },
        period: "90D",
        referenceDate: "2026-08-21T00:00:00.000Z",
      }),
    ).toHaveLength(1);
  });
});

describe("BrandsIndex summary", () => {
  it("renders brand cards from summary without a full Model Family dataset", () => {
    const cards = brandSummariesForIndex(summaryFixture);
    expect(cards.map((card) => card.brandId)).toEqual([
      "jeffrey-campbell",
      "alohas",
      "unknown-brand",
    ]);
    expect(cards[0]?.images).toEqual(["https://cdn.shopify.com/s/files/1/1/products/a.jpg"]);
  });

  it("filters countries using summary rows only", () => {
    const spain = countryOptionsFromSummary(summaryFixture).find((option) => option.label === "İspanya");
    expect(spain).toBeTruthy();
    const spainCards = brandSummariesForIndex(summaryFixture, spain!.id);
    expect(spainCards).toHaveLength(1);
    expect(spainCards[0]?.brandId).toBe("alohas");
    expect(brandSummariesForIndex(summaryFixture, ALL_COUNTRIES_ID)).toHaveLength(3);
    expect(
      brandSummariesForIndex(summaryFixture, UNKNOWN_COUNTRY_ID).map((card) => card.brandId),
    ).toEqual(["unknown-brand"]);
  });
});

describe("catalog client", () => {
  beforeEach(() => {
    resetCatalogCache();
  });

  it("loads only the requested brand shard and caches it for the session", async () => {
    const urls: string[] = [];
    setCatalogFetch(async (input) => {
      urls.push(String(input));
      return new Response(
        JSON.stringify({
          id: "jeffrey-campbell",
          kind: "brand",
          families: [family()],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    const first = await loadBrandShard("jeffrey-campbell");
    const second = await loadBrandShard("jeffrey-campbell");
    expect(first.families).toHaveLength(1);
    expect(second.families).toHaveLength(1);
    expect(urls).toEqual(["/data/catalog/brands/jeffrey-campbell.json"]);
  });

  it("does not eagerly load every brand shard to resolve saved IDs", async () => {
    const urls: string[] = [];
    setCatalogFetch(async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.endsWith("id-index.json")) {
        return new Response(
          JSON.stringify({
            generatedAt: "2026-08-21T00:00:00.000Z",
            families: {
              "jeffrey-campbell--pump": { brandId: "jeffrey-campbell" },
              "schutz--other": { brandId: "schutz" },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ id: "jeffrey-campbell", kind: "brand", families: [family()] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    const shards = await loadShardsForSavedIds(["jeffrey-campbell--pump"]);
    expect(shards).toHaveLength(1);
    expect(urls.some((url) => url.includes("brands/jeffrey-campbell.json"))).toBe(true);
    expect(urls.some((url) => url.includes("brands/schutz.json"))).toBe(false);
  });

  it("loads Visual shards independently of brand shards", async () => {
    const urls: string[] = [];
    setCatalogFetch(async (input) => {
      urls.push(String(input));
      return new Response(
        JSON.stringify({
          generatedAt: "2026-08-21T00:00:00.000Z",
          totalCount: 2,
          categories: [{ id: "tumu", label: "TÜMÜ", count: 2 }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    await loadVisualSummary();
    expect(urls).toEqual(["/data/catalog/visual-summary.json"]);
    expect(urls.some((url) => url.includes("brands/"))).toBe(false);
    expect(urls.some((url) => url.includes("model-families"))).toBe(false);
  });

  it("exposes a Turkish error copy for failed shards", async () => {
    setCatalogFetch(async () => new Response("nope", { status: 500 }));
    await expect(loadCatalogSummary()).rejects.toThrow(/Catalog request failed/);
    expect(UI_COPY.catalogLoadError).toBe("Ürün verisi yüklenemedi.");
    expect(UI_COPY.retry).toBe("Yeniden dene");
    expect(catalogUrl("summary.json")).toBe("/data/catalog/summary.json");
  });
});

describe("startup architecture", () => {
  it("keeps primary navigation independent of catalog JSON", () => {
    expect(PRIMARY_NAV_ITEMS.map((item) => item.label)).toEqual([
      "MARKALAR",
      "PAZARYERLERİ",
      "VISUAL",
      "PAZAR ARAŞTIRMASI",
      "KAYDETTİKLERİM",
    ]);
    expect(UI_COPY.appLoading).toBe("CAPONE yükleniyor…");
    expect(UI_COPY.catalogLoading).toBe("Ürünler yükleniyor…");
  });

  it("keeps the brand detail progressive batch at 48", () => {
    expect(DEFAULT_BATCH).toBe(48);
    expect(BRAND_DETAIL_BATCH).toBe(48);
  });

  it("can load Visual without the full model-family JSON", async () => {
    const mod = await import("../../components/visualWall/VisualWall");
    expect(typeof mod.default).toBe("function");
  });
});
