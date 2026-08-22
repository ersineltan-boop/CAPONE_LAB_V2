import { describe, expect, it } from "vitest";
import {
  createBrandRegistry,
  createSourceRegistry,
  filterBrandsP1,
  filterBrandsP2,
  filterBrandsByCountry,
  filterBrandsBySegment,
  filterProductionSources,
  filterTrendMarketSources,
  loadBrandRegistry,
  loadSourceRegistry,
  RegistryValidationException,
  resetRegistryCache,
  validateBrandEntry,
  validateSourceEntry,
} from "../index";
import type { BrandRegistryEntry } from "../types/brand";
import type { TrendSourceRegistryEntry } from "../types/source";

const sampleBrand = (
  overrides: Partial<BrandRegistryEntry> = {},
): BrandRegistryEntry => ({
  id: "brand-sample",
  brand: "Sample Brand",
  country: "Fransa",
  city: "Paris",
  segment: "LUXURY",
  role: "LEADER",
  footwearInfluence: 60,
  directionalInfluence: 80,
  commercialInfluence: 55,
  trackingPriority: "P1",
  officialUrl: "https://example.com",
  collectionPaths: ["/collections/shoes"],
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
});

const sampleSource = (
  overrides: Partial<TrendSourceRegistryEntry> = {},
): TrendSourceRegistryEntry => ({
  id: "src-sample",
  name: "Sample Source",
  country: "İtalya",
  layer: "FOOTWEAR_TRADE",
  role: "MARKET",
  weight: 0.7,
  officialUrl: null,
  accessMode: "MANUAL",
  refreshCadence: "weekly",
  isActive: true,
  notes: "",
  ...overrides,
});

describe("brand validation", () => {
  it("footwearInfluence ve directionalInfluence bağımsız alanlar olarak doğrulanır", () => {
    const entry = sampleBrand({
      footwearInfluence: 40,
      directionalInfluence: 90,
    });
    expect(validateBrandEntry(entry)).toEqual([]);
    expect(entry.footwearInfluence).not.toBe(entry.directionalInfluence);
  });

  it("yinelenen marka id reddedilir", () => {
    expect(() =>
      createBrandRegistry([
        sampleBrand({ id: "brand-a" }),
        sampleBrand({ id: "brand-a", brand: "Other" }),
      ]),
    ).toThrow(RegistryValidationException);
  });

  it("geçersiz influence aralığı reddedilir", () => {
    const errors = validateBrandEntry(
      sampleBrand({ footwearInfluence: 150 }),
    );
    expect(errors.some((e) => e.code === "INVALID_INFLUENCE")).toBe(true);
  });
});

describe("source validation", () => {
  it("PRODUCTION layer yalnızca PRODUCTION_SIGNAL role ile eşleşir", () => {
    const mismatch = validateSourceEntry(
      sampleSource({ layer: "PRODUCTION", role: "MARKET" }),
    );
    expect(mismatch.some((e) => e.code === "PRODUCTION_LAYER_MISMATCH")).toBe(
      true,
    );

    const valid = validateSourceEntry(
      sampleSource({ layer: "PRODUCTION", role: "PRODUCTION_SIGNAL" }),
    );
    expect(valid).toEqual([]);
  });

  it("yinelenen kaynak id reddedilir", () => {
    expect(() =>
      createSourceRegistry([
        sampleSource({ id: "src-a" }),
        sampleSource({ id: "src-a", name: "Duplicate" }),
      ]),
    ).toThrow(RegistryValidationException);
  });
});

describe("source partitioning", () => {
  it("PRODUCTION kaynakları trend-market listesine karışmaz", () => {
    const registry = createSourceRegistry([
      sampleSource({ id: "src-trade", layer: "FOOTWEAR_TRADE", role: "MARKET" }),
      sampleSource({
        id: "src-cn",
        layer: "PRODUCTION",
        role: "PRODUCTION_SIGNAL",
        country: "Çin",
      }),
    ]);

    expect(registry.trendMarketSources()).toHaveLength(1);
    expect(registry.productionSources()).toHaveLength(1);
    expect(filterTrendMarketSources(registry.all())).toHaveLength(1);
    expect(filterProductionSources(registry.all())).toHaveLength(1);
  });
});

describe("brand filters", () => {
  const brands = [
    sampleBrand({ id: "b1", trackingPriority: "P1", country: "Fransa", segment: "LUXURY" }),
    sampleBrand({ id: "b2", trackingPriority: "P2", country: "İtalya", segment: "PREMIUM" }),
    sampleBrand({ id: "b3", trackingPriority: "P3", country: "Fransa", segment: "CONTEMPORARY", isActive: false }),
  ];

  it("P1/P2/P3 filtreleri çalışır", () => {
    expect(filterBrandsP1(brands)).toHaveLength(1);
    expect(filterBrandsP2(brands)).toHaveLength(1);
  });

  it("ülke ve segment filtreleri çalışır", () => {
    expect(filterBrandsByCountry(brands, "Fransa")).toHaveLength(2);
    expect(filterBrandsBySegment(brands, "LUXURY")).toHaveLength(1);
  });
});

describe("data loaders", () => {
  it("seed dosyası geçerli registry yükler", () => {
    resetRegistryCache();
    expect(loadBrandRegistry().size).toBeGreaterThan(0);
    expect(loadSourceRegistry().size).toBe(0);
  });
});

describe("registry scale", () => {
  it("yüzlerce kayıt Map tabanlı registry'de O(1) erişim sağlar", () => {
    const many: BrandRegistryEntry[] = Array.from({ length: 300 }, (_, i) =>
      sampleBrand({
        id: `brand-${i}`,
        brand: `Brand ${i}`,
        trackingPriority: i % 3 === 0 ? "P1" : i % 3 === 1 ? "P2" : "P3",
      }),
    );

    const registry = createBrandRegistry(many);
    expect(registry.size).toBe(300);
    expect(registry.get("brand-299")?.brand).toBe("Brand 299");
  });
});
