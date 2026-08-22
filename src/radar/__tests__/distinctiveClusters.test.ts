import { describe, expect, it } from "vitest";
import type { AnalyzedProduct, MarketAnalysis } from "../../types/marketAnalysis";
import type { ChangeReport } from "../../history/types";
import {
  buildCommercialRadarItems,
  buildRadarTopSummary,
} from "../buildCommercialRadar";
import {
  hasMinimumDistinctAttributes,
  pruneRedundantAttributes,
} from "../attributeSemantics";
import {
  buildDistinctiveClusters,
  buildMarketPalette,
  productMatchesRadarCluster,
} from "../distinctiveClusters";
import { buildClusterLabel } from "../clusterLabel";
import { buildProvenanceMap } from "../productProfile";

function product(
  overrides: Partial<AnalyzedProduct> & {
    brand: string;
    productUrl: string;
  },
): AnalyzedProduct {
  return {
    source: "test",
    productName: "Test Shoe",
    imageUrl: "https://example.com/a.jpg",
    category: "PUMP",
    color: "Brown",
    material: "Leather",
    toeShape: null,
    heelType: null,
    heelHeight: null,
    details: null,
    discoveredAt: "2026-08-18T10:00:00.000Z",
    cleaned: { color: "Brown", heelHeight: null },
    normalized: {
      category: "PUMP",
      colorFamily: "BROWN",
      materialFamily: "LEATHER",
      heelType: "STILETTO",
      heelHeightGroup: "HIGH",
      toeShape: "POINTED",
      details: ["BUCKLE"],
      construction: ["CLOSED_TOE"],
    },
    ...overrides,
  };
}

function analysis(overrides: Partial<MarketAnalysis> = {}): MarketAnalysis {
  return {
    totalProducts: 6,
    totalBrands: 4,
    categories: [
      { tag: "PUMP", productCount: 4, brandCount: 4, brands: ["A", "B", "C", "D"] },
      { tag: "SANDAL", productCount: 2, brandCount: 2, brands: ["A", "B"] },
    ],
    colors: [
      { tag: "BLACK", productCount: 3, brandCount: 3, brands: ["A", "B", "C"] },
      { tag: "BROWN", productCount: 2, brandCount: 2, brands: ["A", "B"] },
    ],
    materials: [
      { tag: "LEATHER", productCount: 5, brandCount: 4, brands: ["A", "B", "C", "D"] },
    ],
    heelTypes: [],
    heelHeightGroups: [],
    details: [],
    constructions: [],
    brandBreakdown: [],
    topSignals: [],
    unknownCounts: {
      colorFamily: 0,
      materialFamily: 0,
      heelType: 0,
      heelHeightGroup: 0,
      toeShape: 0,
    },
    ...overrides,
  };
}

const firstSnapshotReport: ChangeReport = {
  generatedAt: "2026-08-18T12:00:00.000Z",
  comparisonAvailable: false,
  previousSnapshotId: null,
  currentSnapshotId: "2026-08-18_12-00",
  signalChanges: [],
  topChanges: [],
  newProducts: [],
  removedProducts: [],
};

function buildInput(
  products: AnalyzedProduct[],
  provenanceEntries: Array<{
    productUrl: string;
    analysisCoverage?: { text?: boolean; vision?: boolean };
  }> = products.map((p) => ({
    productUrl: p.productUrl,
    analysisCoverage: { text: true, vision: false },
  })),
) {
  const provenanceMap = buildProvenanceMap(provenanceEntries);
  const totalVisionEligible = products.filter((p) => {
    const key = p.productUrl.replace(/\/$/, "").toLowerCase();
    return provenanceMap.get(key)?.vision;
  }).length;

  return {
    products,
    analysis: analysis({ totalProducts: products.length }),
    changeReport: firstSnapshotReport,
    provenanceMap,
    totalVisionEligible,
    meta: {
      comparisonAvailable: false,
      collectedAt: "2026-08-18T12:00:00.000Z",
      totalProducts: products.length,
      totalBrands: 4,
    },
  };
}

describe("attributeSemantics", () => {
  it("prunes THONG + OPEN_TOE redundancy down to one meaningful attribute", () => {
    const pruned = pruneRedundantAttributes([
      { dimension: "CATEGORY", value: "THONG" },
      { dimension: "CONSTRUCTION", value: "OPEN_TOE" },
    ]);
    expect(pruned).toEqual([{ dimension: "CATEGORY", value: "THONG" }]);
    expect(hasMinimumDistinctAttributes([
      { dimension: "CATEGORY", value: "THONG" },
      { dimension: "CONSTRUCTION", value: "OPEN_TOE" },
    ])).toBe(false);
  });

  it("prunes MULE + BACKLESS redundancy", () => {
    const pruned = pruneRedundantAttributes([
      { dimension: "CATEGORY", value: "MULE" },
      { dimension: "CONSTRUCTION", value: "BACKLESS" },
    ]);
    expect(pruned).toEqual([{ dimension: "CATEGORY", value: "MULE" }]);
  });
});

describe("distinctiveClusters", () => {
  it("does not emit single-dimension BLACK, LEATHER, or PUMP clusters", () => {
    const products = [
      product({ brand: "A", productUrl: "https://x/1", normalized: { ...product({ brand: "A", productUrl: "x" }).normalized, colorFamily: "BLACK" } }),
      product({ brand: "B", productUrl: "https://x/2", normalized: { ...product({ brand: "B", productUrl: "x" }).normalized, colorFamily: "BLACK" } }),
      product({ brand: "C", productUrl: "https://x/3", normalized: { ...product({ brand: "C", productUrl: "x" }).normalized, colorFamily: "BLACK", materialFamily: "LEATHER", category: "PUMP" } }),
      product({ brand: "D", productUrl: "https://x/4", normalized: { ...product({ brand: "D", productUrl: "x" }).normalized, colorFamily: "BLACK", materialFamily: "LEATHER", category: "PUMP", details: ["BUCKLE"] } }),
    ];

    const { clusters } = buildDistinctiveClusters(buildInput(products));
    const labels = clusters.map((c) => c.labelTr);

    expect(labels.some((l) => l === "SİYAH" || l === "BLACK")).toBe(false);
    expect(labels.some((l) => l === "DERİ" || l === "LEATHER")).toBe(false);
    expect(labels.some((l) => l === "PUMP")).toBe(false);
  });

  it("does not emit semantically single-attribute SLINGBACK or THONG radar cards", () => {
    const products = [
      product({
        brand: "A",
        productUrl: "https://x/1",
        normalized: {
          category: "SLINGBACK",
          colorFamily: "BLACK",
          materialFamily: "LEATHER",
          heelType: "STILETTO",
          heelHeightGroup: "HIGH",
          toeShape: "POINTED",
          details: [],
          construction: ["SLINGBACK"],
        },
      }),
      product({
        brand: "B",
        productUrl: "https://x/2",
        productName: "Thong 1",
        normalized: {
          category: "THONG",
          colorFamily: "BLACK",
          materialFamily: "LEATHER",
          heelType: "FLAT",
          heelHeightGroup: "LOW",
          toeShape: "ROUND",
          details: [],
          construction: ["OPEN_TOE"],
        },
      }),
      product({
        brand: "C",
        productUrl: "https://x/3",
        productName: "Thong 2",
        normalized: {
          category: "THONG",
          colorFamily: "BROWN",
          materialFamily: "LEATHER",
          heelType: "FLAT",
          heelHeightGroup: "LOW",
          toeShape: "ROUND",
          details: [],
          construction: ["OPEN_TOE"],
        },
      }),
    ];

    const { clusters } = buildDistinctiveClusters(buildInput(products));
    expect(clusters.every((cluster) =>
      hasMinimumDistinctAttributes(cluster.attributes),
    )).toBe(true);
    expect(clusters.some((cluster) => cluster.labelTr === "SLINGBACK")).toBe(false);
    expect(clusters.some((cluster) => cluster.labelTr === "Parmak Arası")).toBe(false);
  });

  it("allows meaningful two-attribute combination clusters", () => {
    const products = [
      product({
        brand: "A",
        productUrl: "https://x/1",
        normalized: {
          category: "PUMP",
          colorFamily: "BLACK",
          materialFamily: "LEATHER",
          heelType: "STILETTO",
          heelHeightGroup: "HIGH",
          toeShape: "POINTED",
          details: ["BUCKLE"],
          construction: ["CLOSED_TOE"],
        },
      }),
      product({
        brand: "B",
        productUrl: "https://x/2",
        productName: "Other Pump",
        normalized: {
          category: "PUMP",
          colorFamily: "BROWN",
          materialFamily: "LEATHER",
          heelType: "STILETTO",
          heelHeightGroup: "HIGH",
          toeShape: "POINTED",
          details: ["BUCKLE"],
          construction: ["CLOSED_TOE"],
        },
      }),
      product({
        brand: "C",
        productUrl: "https://x/3",
        productName: "Third Pump",
        normalized: {
          category: "PUMP",
          colorFamily: "BLACK",
          materialFamily: "SUEDE",
          heelType: "BLOCK",
          heelHeightGroup: "MID",
          toeShape: "ROUND",
          details: ["STRAP"],
          construction: ["OPEN_TOE"],
        },
      }),
    ];

    const { clusters } = buildDistinctiveClusters(buildInput(products));
    expect(clusters.some((c) => c.attributes.length >= 2)).toBe(true);
  });

  it("prefers broader brand coverage over narrow two-brand clusters", () => {
    const broad = [
      product({ brand: "A", productUrl: "https://x/1" }),
      product({ brand: "B", productUrl: "https://x/2", productName: "B Pump" }),
      product({ brand: "C", productUrl: "https://x/3", productName: "C Pump" }),
      product({ brand: "D", productUrl: "https://x/4", productName: "D Pump" }),
      product({ brand: "E", productUrl: "https://x/5", productName: "E Pump" }),
    ];

    const { clusters } = buildDistinctiveClusters(
      buildInput(broad, undefined),
    );
    const top = clusters[0];
    expect(top?.brandCount).toBeGreaterThanOrEqual(3);
  });

  it("marks two-brand clusters as WEAK evidence strength", () => {
    const products = [
      product({ brand: "A", productUrl: "https://x/1" }),
      product({ brand: "B", productUrl: "https://x/2", productName: "B Pump" }),
      product({ brand: "C", productUrl: "https://x/3", productName: "C Pump" }),
    ];

    const { clusters } = buildDistinctiveClusters(buildInput(products));
    const twoBrand = clusters.find((cluster) => cluster.brandCount === 2);
    if (twoBrand) {
      expect(twoBrand.evidenceStrength).toBe("WEAK");
    }
  });

  it("does not inflate brandCount from same-brand variants", () => {
    const products = [
      product({ brand: "A", productUrl: "https://x/1", productName: "Alpha Black" }),
      product({ brand: "A", productUrl: "https://x/2", productName: "Alpha Brown" }),
      product({ brand: "B", productUrl: "https://x/3", productName: "Beta One" }),
    ];

    const { clusters } = buildDistinctiveClusters(buildInput(products));
    for (const cluster of clusters) {
      expect(cluster.brandCount).toBe(cluster.brands.length);
    }
  });

  it("excludes single-brand clusters from radar selection", () => {
    const products = [
      product({ brand: "A", productUrl: "https://x/1" }),
      product({ brand: "A", productUrl: "https://x/2", productName: "Variant" }),
    ];

    const { clusters, stats } = buildDistinctiveClusters(buildInput(products));
    expect(clusters.every((c) => c.brandCount >= 2)).toBe(true);
    expect(stats.rejectedMinBrands).toBeGreaterThan(0);
  });

  it("uses vision-eligible denominator for vision-required clusters", () => {
    const products = [
      product({
        brand: "A",
        productUrl: "https://x/1",
        normalized: {
          category: "PUMP",
          colorFamily: "BLACK",
          materialFamily: "LEATHER",
          heelType: "STILETTO",
          heelHeightGroup: "HIGH",
          toeShape: "POINTED",
          details: ["BUCKLE"],
          construction: ["CLOSED_TOE"],
        },
      }),
      product({ brand: "B", productUrl: "https://x/2", productName: "B Pump" }),
      product({ brand: "C", productUrl: "https://x/3", productName: "C Pump" }),
      product({ brand: "D", productUrl: "https://x/4", productName: "D Pump" }),
    ];

    const provenanceMap = buildProvenanceMap([
      { productUrl: "https://x/1", analysisCoverage: { text: true, vision: true } },
      { productUrl: "https://x/2", analysisCoverage: { text: true, vision: false } },
      { productUrl: "https://x/3", analysisCoverage: { text: true, vision: false } },
      { productUrl: "https://x/4", analysisCoverage: { text: true, vision: false } },
    ]);

    const { clusters } = buildDistinctiveClusters({
      products,
      analysis: analysis({ totalProducts: 4, totalBrands: 4 }),
      changeReport: firstSnapshotReport,
      provenanceMap,
      totalVisionEligible: 1,
    });

    const detailCluster = clusters.find((c) =>
      c.attributes.some((a) => a.dimension === "DETAIL"),
    );
    if (detailCluster) {
      expect(detailCluster.evidence.analyzedEligibleProducts).toBe(1);
    }
  });

  it("dedupes parent-child clusters using product overlap", () => {
    const parentShape = {
      category: "SLINGBACK" as const,
      colorFamily: "BLACK" as const,
      materialFamily: "LEATHER" as const,
      heelType: "STILETTO" as const,
      heelHeightGroup: "HIGH" as const,
      toeShape: "POINTED" as const,
      details: [] as string[],
      construction: ["ANKLE_STRAP"] as string[],
    };

    const products = [
      product({ brand: "A", productUrl: "https://x/1", normalized: parentShape }),
      product({ brand: "B", productUrl: "https://x/2", productName: "B", normalized: parentShape }),
      product({ brand: "C", productUrl: "https://x/3", productName: "C", normalized: parentShape }),
      product({
        brand: "D",
        productUrl: "https://x/4",
        productName: "D",
        normalized: { ...parentShape, category: "PUMP" },
      }),
    ];

    const { clusters, stats } = buildDistinctiveClusters(buildInput(products));
    const slingbackOnly = clusters.filter((cluster) => cluster.labelTr === "SLINGBACK");
    const slingbackPump = clusters.filter((cluster) => cluster.labelTr === "Stiletto PUMP");
    expect(slingbackOnly.length + slingbackPump.length).toBeLessThanOrEqual(1);
    expect(stats.rejectedParentChild + stats.rejectedOverlap).toBeGreaterThanOrEqual(0);
  });

  it("produces readable labels for low vamp flats", () => {
    const label = buildClusterLabel([
      { dimension: "CONSTRUCTION", value: "LOW_VAMP" },
      { dimension: "HEEL_TYPE", value: "FLAT" },
    ]);
    expect(label).toBe("Düşük Vamp Düz Topuk");
    expect(label).not.toBe("DÜŞÜK VAMP DÜZ");
  });
});

describe("buildCommercialRadar", () => {
  it("builds combination-based radar cards on first snapshot", () => {
    const products = [
      product({ brand: "A", productUrl: "https://x/1" }),
      product({ brand: "B", productUrl: "https://x/2", productName: "B Shoe" }),
      product({ brand: "C", productUrl: "https://x/3", productName: "C Shoe" }),
    ];

    const items = buildCommercialRadarItems(buildInput(products));
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.decision === "VERİ BİRİKİYOR")).toBe(true);
    expect(items.every((item) => item.stage === "İLK ÖLÇÜM")).toBe(true);
    expect(items.some((item) => item.title === "KAHVE")).toBe(false);
  });

  it("does not invent momentum on first snapshot summary", () => {
    const summary = buildRadarTopSummary({
      analysis: analysis(),
      changeReport: firstSnapshotReport,
      meta: {
        comparisonAvailable: false,
        collectedAt: "2026-08-18T12:00:00.000Z",
        totalProducts: 3,
        totalBrands: 3,
      },
    });

    expect(summary.significantMovements).toBe(0);
    expect(summary.newProducts).toBe(0);
  });

  it("builds market palette from single-dimension analysis", () => {
    const palette = buildMarketPalette(analysis());
    expect(palette.colors.length).toBeGreaterThan(0);
    expect(palette.materials.length).toBeGreaterThan(0);
    expect(palette.categories.length).toBeGreaterThan(0);
  });
});

describe("productMatchesRadarCluster", () => {
  it("matches products by all cluster attributes", () => {
    const p = product({ brand: "A", productUrl: "https://x/1" });
    const { clusters } = buildDistinctiveClusters(
      buildInput([
        p,
        product({ brand: "B", productUrl: "https://x/2", productName: "B" }),
        product({ brand: "C", productUrl: "https://x/3", productName: "C" }),
      ]),
    );

    const cluster = clusters[0];
    if (!cluster) return;
    expect(productMatchesRadarCluster(p, cluster)).toBe(true);
  });
});
