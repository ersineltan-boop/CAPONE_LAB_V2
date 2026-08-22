import { describe, expect, it, vi } from "vitest";
import type { BrandRegistryEntry } from "../types/brand";
import {
  brandToPilotSourceConfig,
  getCollectableBrands,
  isCollectableBrand,
} from "../collection/brandToCollector";
import { collectBrandByCollectorType } from "../collection/collectByType";

function entry(
  overrides: Partial<BrandRegistryEntry> = {},
): BrandRegistryEntry {
  return {
    id: "brand-a",
    brand: "BRAND A",
    country: "ABD",
    segment: "PREMIUM",
    role: "MARKET",
    footwearInfluence: 50,
    directionalInfluence: 50,
    commercialInfluence: 50,
    trackingPriority: "P2",
    officialUrl: "https://brand-a.example.com",
    collectionPaths: ["/collections/shoes"],
    footwearCollectionHandles: ["shoes"],
    collectionDiscoveryStatus: "VERIFIED",
    collectorType: "SHOPIFY_PUBLIC",
    collectionStatus: "READY_AUTOMATIC",
    productLimit: 20,
    supportsMultipleImages: true,
    discoverySources: [],
    isActive: true,
    notes: "",
    classificationStatus: "REVIEWED",
    radarEligible: true,
    ...overrides,
  };
}

vi.mock("../../collector/shopify", () => ({
  collectShopifyCollectionProducts: vi.fn(async () => ({
    products: [
      {
        source: "brand-a",
        brand: "BRAND A",
        productName: "Shoe",
        productUrl: "https://brand-a.example.com/products/shoe",
        imageUrl: "https://cdn.example.com/1.jpg",
        images: [
          "https://cdn.example.com/1.jpg",
          "https://cdn.example.com/2.jpg",
        ],
        category: "PUMP",
        color: "Black",
        material: "Leather",
        toeShape: null,
        heelType: null,
        heelHeight: null,
        details: null,
        discoveredAt: "2026-08-18T10:00:00.000Z",
        variants: [],
      },
    ],
    discoveredLinks: new Set(["https://brand-a.example.com/products/shoe"]),
    errors: [],
  })),
  collectShopifyFootwearBackfill: vi.fn(async () => ({
    products: [
      {
        source: "brand-a",
        brand: "BRAND A",
        productName: "Shoe",
        productUrl: "https://brand-a.example.com/products/shoe",
        imageUrl: "https://cdn.example.com/1.jpg",
        images: [
          "https://cdn.example.com/1.jpg",
          "https://cdn.example.com/2.jpg",
        ],
        category: "PUMP",
        color: "Black",
        material: "Leather",
        toeShape: null,
        heelType: null,
        heelHeight: null,
        details: null,
        discoveredAt: "2026-08-18T10:00:00.000Z",
        variants: [],
      },
    ],
    discoveredLinks: new Set(["https://brand-a.example.com/products/shoe"]),
    errors: [],
    hitBackfillLimit: false,
    catalogFootwearCount: 1,
  })),
}));

vi.mock("../../collector/discoverFootwearCollections", () => ({
  discoverVerifiedFootwearCollections: vi.fn(async () => ({
    status: "VERIFIED",
    verifiedPaths: ["/collections/shoes"],
    handles: ["shoes"],
    urls: ["https://brand-a.example.com/collections/shoes"],
    candidates: [],
  })),
  pickPreferredFootwearCollectionPaths: vi.fn(
    (_handles?: readonly string[], _paths?: readonly string[], fallback?: readonly string[]) =>
      fallback && fallback.length > 0 ? [...fallback] : ["/collections/shoes"],
  ),
}));

vi.mock("../../collector/discoverPaths", () => ({
  resolveCollectionPaths: vi.fn(async () => ["/collections/shoes"]),
  discoverCollectionPaths: vi.fn(async () => ["/collections/shoes"]),
}));

describe("registry-driven collection", () => {
  it("active READY_AUTOMATIC brand collector'a girer", () => {
    expect(isCollectableBrand(entry())).toBe(true);
    expect(getCollectableBrands([entry()])).toHaveLength(1);
  });

  it("inactive brand collector'a girmez", () => {
    expect(isCollectableBrand(entry({ isActive: false }))).toBe(false);
    expect(
      getCollectableBrands([entry(), entry({ id: "brand-b", isActive: false })]),
    ).toHaveLength(1);
  });

  it("Shopify brand mevcut shopify collector'ını kullanır", async () => {
    const result = await collectBrandByCollectorType(entry());
    expect(result.method).toBe("shopify");
    expect(result.products[0]?.images).toHaveLength(2);
  });

  it("duplicate brand iki kez collect edilmez", () => {
    const brands = getCollectableBrands([
      entry(),
      entry({ id: "brand-a-dup", brand: "BRAND A" }),
    ]);
    expect(brands).toHaveLength(1);
  });

  it("brandToPilotSourceConfig registry alanlarını map eder", () => {
    const config = brandToPilotSourceConfig(entry());
    expect(config).toEqual({
      id: "brand-a",
      brand: "BRAND A",
      baseUrl: "https://brand-a.example.com",
      collectionPaths: ["/collections/shoes"],
      verifiedFootwearPaths: ["/collections/shoes"],
      maxProducts: 20,
      backfillLimit: 100,
      collectMode: "full",
    });
  });

  it("CUSTOM_ADAPTER otomatik collect etmez", async () => {
    const result = await collectBrandByCollectorType(
      entry({ collectorType: "CUSTOM_ADAPTER" }),
    );
    expect(result.products).toHaveLength(0);
    expect(result.errors[0]).toContain("CUSTOM_ADAPTER");
  });
});

describe("runMultibrand failure isolation", () => {
  it("bir brand fail olsa bile diğer brand collect edilebilir", async () => {
    const { collectBrandByCollectorType: collect } = await import(
      "../collection/collectByType"
    );

    const good = await collect(entry());
    const bad = await collect(
      entry({
        id: "brand-b",
        brand: "BRAND B",
        officialUrl: null,
        collectorType: "LINK_ONLY",
        collectionStatus: "DISABLED",
        isActive: false,
      }),
    );

    expect(good.products.length).toBeGreaterThan(0);
    expect(bad.products).toHaveLength(0);
  });
});

describe("brand probe candidates", () => {
  it("NEEDS_PROBE kayıtları isActive=false olsa bile probe adayıdır", async () => {
    const { getProbeCandidateBrands } = await import(
      "../collection/brandToCollector"
    );
    const candidates = getProbeCandidateBrands([
      entry({
        collectorType: "UNKNOWN",
        collectionStatus: "NEEDS_PROBE",
        isActive: false,
      }),
      entry({ collectorType: "SHOPIFY_PUBLIC", collectionStatus: "READY_AUTOMATIC" }),
      entry({ collectorType: "UNKNOWN", collectionStatus: "FAILED", isActive: false }),
    ]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.collectionStatus).toBe("NEEDS_PROBE");
  });
});
