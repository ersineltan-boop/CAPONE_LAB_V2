import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { mergeProductCatalog } from "../../collector/mergeProducts";
import type { PilotProduct } from "../../collector/types";
import type { ModelFamily } from "../../modelFamily/types";
import type { BrandRegistryEntry } from "../../registry/types/brand";
import {
  browsableMarketplaces,
  selectActiveMarketplaceEntries,
} from "../../registry/data/marketplaces";
import { getCollectableBrands } from "../../registry/collection/brandToCollector";
import {
  buildCloudRefreshPlan,
  CLOUD_REFRESH_EXCLUDED_WORKFLOWS,
  CLOUD_REFRESH_STEPS,
  CLOUD_REFRESH_TRACKED_DATA_PATHS,
  coverageToSourceStatus,
  marketplacePublishStatus,
  getCloudRefreshBrands,
  getCloudRefreshMarketplaces,
  getMembershipRefreshBrands,
  isCloudRefreshCoreDataPath,
  mergeIncomingSourceIntoCatalog,
  preserveUnrefreshedModelFamilies,
  renderCloudRefreshMarkdown,
  shouldStageCloudRefreshPath,
  summarizeSourceOutcomes,
} from "../refreshPolicy";

function brand(overrides: Partial<BrandRegistryEntry> = {}): BrandRegistryEntry {
  return {
    id: "brand-a",
    brand: "BRAND A",
    country: "US",
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

function product(
  overrides: Partial<PilotProduct> & Pick<PilotProduct, "productUrl">,
): PilotProduct {
  return {
    source: "brand-a",
    brand: "BRAND A",
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

describe("cloud refresh sequence", () => {
  it("keeps last-good families for unrefreshed and failed brands without duplicating rebuilt families", () => {
    const family = (id: string, brandName: string) =>
      ({ modelFamilyId: id, brand: brandName, variants: [] }) as unknown as ModelFamily;
    const rebuilt = [family("a-new", "BRAND A"), family("b-one", "BRAND B")];
    const prior = [family("a-old", "BRAND A"), family("b-one", "BRAND B"), family("c-one", "BRAND C")];
    expect(preserveUnrefreshedModelFamilies(rebuilt, prior, new Set(["BRAND A"])).map(
      (entry) => entry.modelFamilyId,
    )).toEqual(["a-new", "b-one", "a-old", "c-one"]);
  });
  it("uses the production data steps and excludes OpenAI, Vision and Radar", () => {
    expect([...CLOUD_REFRESH_STEPS]).toEqual([
      "collect-active-brands",
      "collect-active-marketplaces",
      "refresh-source-memberships",
      "local-analyze",
      "rebuild-model-families",
      "regenerate-coverage-reports",
    ]);
    expect(CLOUD_REFRESH_EXCLUDED_WORKFLOWS).toEqual([
      "openai",
      "openai-vision",
      "taxonomy-vision",
      "radar",
    ]);
  });

  it("collects from the Brand Registry instead of a hardcoded brand list", () => {
    const brands = [
      brand(),
      brand({
        id: "brand-b",
        brand: "BRAND B",
        officialUrl: "https://brand-b.example.com",
      }),
      brand({
        id: "needs-probe",
        brand: "NEEDS PROBE",
        collectionStatus: "NEEDS_PROBE",
        isActive: false,
      }),
      brand({
        id: "failed",
        brand: "FAILED BRAND",
        collectionStatus: "FAILED",
        isActive: false,
      }),
    ];
    const plan = buildCloudRefreshPlan({
      brands,
      marketplaces: selectActiveMarketplaceEntries({
        activePilotId: "level-shoes",
        mytheresaStatus: "NEEDS_BROWSER_OR_ADAPTER",
      }),
    });

    expect(plan.brands.map((entry) => entry.id)).toEqual(
      getCollectableBrands(brands).map((entry) => entry.id),
    );
    expect(plan.brands).toHaveLength(2);
    expect(plan.brands.some((entry) => entry.collectionStatus === "NEEDS_PROBE")).toBe(false);
    expect(plan.membershipBrands.map((entry) => entry.id)).toEqual(["brand-a", "brand-b"]);
    expect(plan.marketplaces.map((entry) => entry.id)).toEqual(["level-shoes"]);
  });

  it("excludes automation-owned brands while retaining legacy brands", () => {
    const brands = [
      brand({ id: "legacy", brand: "LEGACY" }),
      brand({ id: "wave", brand: "WAVE", discoverySources: ["wave50"] }),
      brand({ id: "automation", brand: "AUTOMATION", discoverySources: ["brand-automation"] }),
    ];
    expect(getCloudRefreshBrands(brands).map((entry) => entry.id)).toEqual(["legacy"]);
    expect(getMembershipRefreshBrands(brands).map((entry) => entry.id)).toEqual(["legacy"]);
    expect(buildCloudRefreshPlan({ brands, marketplaces: [] }).brands.map((entry) => entry.id)).toEqual([
      "legacy",
    ]);
  });

  it("passes only the planned legacy brand IDs into collection", () => {
    const source = readFileSync("src/refresh/runCloudRefresh.ts", "utf-8");
    expect(source).toMatch(/runMultibrandCollection\(\{[\s\S]*?brandIds:\s*plan\.brands\.map\(\(brand\) => brand\.id\)/);
  });

  it("includes ACTIVE/PARTIAL marketplaces from the marketplace registry", () => {
    const entries = selectActiveMarketplaceEntries({
      activePilotId: "level-shoes",
      mytheresaStatus: "NEEDS_BROWSER_OR_ADAPTER",
    });
    expect(getCloudRefreshMarketplaces(entries).map((entry) => entry.id)).toEqual(
      browsableMarketplaces(entries)
        .filter((entry) => entry.discoveryStatus === "ACTIVE" || entry.discoveryStatus === "PARTIAL")
        .map((entry) => entry.id),
    );
  });

  it("supports a brand-only daily plan so marketplace collectors run once", () => {
    const entries = selectActiveMarketplaceEntries({
      activePilotId: "level-shoes",
      activeMarketplaceIds: ["level-shoes", "farfetch", "free-people", "the-webster"],
      mytheresaStatus: "NEEDS_BROWSER_OR_ADAPTER",
    });
    expect(buildCloudRefreshPlan({
      brands: [brand()],
      marketplaces: entries,
      includeMarketplaces: false,
    }).marketplaces).toEqual([]);
  });

  it("does not schedule membership refresh for non-Shopify collectable brands", () => {
    const brands = [
      brand({ collectorType: "STRUCTURED_DATA" }),
      brand({
        id: "shopify-b",
        brand: "SHOPIFY B",
        officialUrl: "https://shopify-b.example.com",
        collectorType: "SHOPIFY_JSON",
      }),
    ];
    expect(getCloudRefreshBrands(brands).map((entry) => entry.id)).toEqual([
      "brand-a",
      "shopify-b",
    ]);
    expect(getMembershipRefreshBrands(brands).map((entry) => entry.id)).toEqual(["shopify-b"]);
  });
});

describe("cloud refresh git staging", () => {
  it("stages only tracked CAPONE data files", () => {
    expect(shouldStageCloudRefreshPath("data/multibrand/products.json")).toBe(true);
    expect(shouldStageCloudRefreshPath("data/multibrand/model-families.json")).toBe(false);
    expect(shouldStageCloudRefreshPath("data/multibrand/model-families/manifest.json")).toBe(true);
    expect(shouldStageCloudRefreshPath("data/multibrand/model-families/part-000.json")).toBe(true);
    expect(shouldStageCloudRefreshPath("data/registry/source-coverage-report.json")).toBe(true);
    expect(isCloudRefreshCoreDataPath("data/multibrand/products.json")).toBe(true);
    expect(isCloudRefreshCoreDataPath("data/multibrand/model-families/part-001.json")).toBe(true);
    expect(isCloudRefreshCoreDataPath("data/multibrand/collection-report.json")).toBe(false);
    expect(CLOUD_REFRESH_TRACKED_DATA_PATHS.length).toBeGreaterThan(5);
  });

  it("never stages catalog shards, build output, secrets or dated history", () => {
    expect(shouldStageCloudRefreshPath("public/data/catalog/summary.json")).toBe(false);
    expect(shouldStageCloudRefreshPath("dist/index.html")).toBe(false);
    expect(shouldStageCloudRefreshPath("node_modules/react/index.js")).toBe(false);
    expect(shouldStageCloudRefreshPath("logs/capone-daily.log")).toBe(false);
    expect(shouldStageCloudRefreshPath(".env")).toBe(false);
    expect(shouldStageCloudRefreshPath(".env.local")).toBe(false);
    expect(shouldStageCloudRefreshPath("data/history/2026-08-22/products.json")).toBe(false);
    expect(shouldStageCloudRefreshPath("data/multibrand/products.pre-backfill.json")).toBe(false);
  });
});

describe("cloud refresh source failure isolation", () => {
  it("preserves previous products when a source fails", () => {
    const existing = [
      product({ productUrl: "https://brand.com/a", source: "brand-a" }),
      product({
        productUrl: "https://www.levelshoes.com/old.html",
        source: "level-shoes",
        brand: "PRADA",
      }),
    ];
    const merged = mergeIncomingSourceIntoCatalog({
      existing,
      incoming: [],
      status: "failed",
    });
    expect(merged).toEqual(existing);
  });

  it("merges a partial source without dropping other sources or previous URLs", () => {
    const existing = [
      product({ productUrl: "https://brand.com/a", source: "brand-a" }),
      product({
        productUrl: "https://www.levelshoes.com/old.html",
        source: "level-shoes",
        brand: "PRADA",
      }),
    ];
    const incoming = [
      product({
        productUrl: "https://www.levelshoes.com/new.html",
        source: "level-shoes",
        brand: "PRADA",
        isNewArrivalsCollection: true,
        images: ["https://cdn.example.com/1.jpg", "https://cdn.example.com/2.jpg"],
      }),
    ];
    const merged = mergeIncomingSourceIntoCatalog({
      existing,
      incoming,
      status: "partial",
    });
    expect(merged.map((item) => item.productUrl).sort()).toEqual([
      "https://brand.com/a",
      "https://www.levelshoes.com/new.html",
      "https://www.levelshoes.com/old.html",
    ]);
    expect(
      merged.find((item) => item.productUrl.includes("new.html"))?.isNewArrivalsCollection,
    ).toBe(true);
    expect(merged.find((item) => item.productUrl.includes("new.html"))?.images).toHaveLength(2);
  });

  it("keeps source-native newness when later records omit the flag", () => {
    const existing = [
      product({
        productUrl: "https://brand.com/a",
        isNewArrivalsCollection: true,
      }),
    ];
    const incoming = [
      product({
        productUrl: "https://brand.com/a",
        isNewArrivalsCollection: false,
      }),
    ];
    const merged = mergeProductCatalog(existing, incoming);
    expect(merged[0]?.isNewArrivalsCollection).toBe(true);
  });

  it("maps FULL / PARTIAL / FAILED / NEEDS_PROBE to refresh statuses", () => {
    expect(coverageToSourceStatus("FULL", 10)).toBe("success");
    expect(coverageToSourceStatus("PARTIAL", 10)).toBe("partial");
    expect(coverageToSourceStatus("FAILED", 0)).toBe("failed");
    expect(coverageToSourceStatus("NEEDS_PROBE", 0)).toBe("skipped");
  });

  it("maps PARTIAL marketplace delivery to last-good preservation", () => {
    expect(marketplacePublishStatus("success")).toBe("success");
    expect(marketplacePublishStatus("partial")).toBe("failed");
  });
});

describe("cloud refresh summary", () => {
  it("renders the GitHub Actions job fields", () => {
    const markdown = renderCloudRefreshMarkdown({
      startedAt: "2026-08-22T04:00:00.000Z",
      finishedAt: "2026-08-22T05:10:00.000Z",
      brandCount: 27,
      marketplaceCount: 1,
      modelFamilyCount: 1200,
      successfulSources: ["BRAND A"],
      partialSources: ["Level Shoes"],
      failedSources: ["BRAND B"],
      skippedSources: [],
      dataChanged: true,
      testsPassed: true,
      productionBuildPassed: true,
      commitCreated: true,
    });
    expect(markdown).toContain("Successful sources: BRAND A");
    expect(markdown).toContain("Partial sources: Level Shoes");
    expect(markdown).toContain("Failed sources: BRAND B");
    expect(markdown).toContain("Brand count: 27");
    expect(markdown).toContain("Marketplace count: 1");
    expect(markdown).toContain("Model Family count: 1200");
    expect(markdown).toContain("Data changed: yes");
    expect(markdown).toContain("Tests passed: yes");
    expect(markdown).toContain("Production build passed: yes");
    expect(markdown).toContain("Commit/push created: yes");
  });

  it("does not treat membership overlays as collection sources", () => {
    const summary = summarizeSourceOutcomes([
      {
        id: "brand-a",
        name: "BRAND A",
        kind: "brand",
        status: "success",
        parsedProducts: 4,
        errors: [],
      },
      {
        id: "brand-a:membership",
        name: "BRAND A membership",
        kind: "membership",
        status: "failed",
        parsedProducts: 0,
        errors: ["timeout"],
      },
    ]);
    expect(summary.successfulSources).toEqual(["BRAND A"]);
    expect(summary.failedSources).toEqual([]);
  });
});
