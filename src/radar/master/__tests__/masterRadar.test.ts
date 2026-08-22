import { describe, expect, it, vi } from "vitest";
import type { AnalyzedProduct } from "../../types/marketAnalysis";
import type { ModelFamily } from "../../modelFamily/types";
import type { ChangeReport } from "../../history/types";
import { buildMasterRadar } from "../buildMasterRadar";
import {
  containsForbiddenDimension,
  isCategoryOnlySignal,
  isSingleAttributeSignal,
  productHasRequiredAttributes,
} from "../signalAttributes";
import { discoverCategoryDirections } from "../discoverDirections";
import { buildFamilyIndex } from "../familyIndex";
import type { SignalAttribute } from "../types";

vi.mock("../../registry/data/brands", () => ({
  brandEntries: [
    {
      id: "brand-a",
      brand: "BRAND A",
      country: "IT",
      city: "Milan",
      segment: "DIRECTIONAL",
      role: "LEADER",
      footwearInfluence: 80,
      directionalInfluence: 85,
      commercialInfluence: 40,
      trackingPriority: "P1",
      officialUrl: null,
      discoverySources: [],
      isActive: true,
      notes: "",
    },
    {
      id: "brand-b",
      brand: "BRAND B",
      country: "FR",
      city: "Paris",
      segment: "PREMIUM",
      role: "EARLY_ADOPTER",
      footwearInfluence: 70,
      directionalInfluence: 65,
      commercialInfluence: 55,
      trackingPriority: "P1",
      officialUrl: null,
      discoverySources: [],
      isActive: true,
      notes: "",
    },
    {
      id: "brand-c",
      brand: "BRAND C",
      country: "US",
      city: "NY",
      segment: "CONTEMPORARY",
      role: "MARKET",
      footwearInfluence: 60,
      directionalInfluence: 45,
      commercialInfluence: 70,
      trackingPriority: "P2",
      officialUrl: null,
      discoverySources: [],
      isActive: true,
      notes: "",
    },
    {
      id: "brand-d",
      brand: "BRAND D",
      country: "ES",
      city: "Madrid",
      segment: "MASS_MARKET",
      role: "RETAIL",
      footwearInfluence: 50,
      directionalInfluence: 20,
      commercialInfluence: 80,
      trackingPriority: "P2",
      officialUrl: null,
      discoverySources: [],
      isActive: true,
      notes: "",
    },
  ],
}));

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
      construction: ["ANKLE_STRAP", "CLOSED_TOE"],
    },
    ...overrides,
  };
}

function family(
  overrides: Partial<ModelFamily> & {
    modelFamilyId: string;
    brand: string;
    representativeProductId: string;
  },
): ModelFamily {
  return {
    canonicalName: "Test Model",
    category: "PUMP",
    representativeImage: "https://example.com/a.jpg",
    representativeImages: ["https://example.com/a.jpg"],
    variantCount: 1,
    variants: [],
    allImages: ["https://example.com/a.jpg"],
    sourceProductIds: [overrides.representativeProductId],
    groupingConfidence: "MEDIUM",
    groupingReason: "singleton",
    ...overrides,
  };
}

const changeReport: ChangeReport = {
  comparisonAvailable: false,
  generatedAt: "2026-08-18T10:00:00.000Z",
  currentSnapshotId: "2026-08-18_17-36",
  previousSnapshotId: null,
  newProducts: [],
  removedProducts: [],
  signalChanges: [],
  topChanges: [],
};

describe("master radar ruleset", () => {
  it("A) category alone cannot be a signal", () => {
    expect(isCategoryOnlySignal([])).toBe(true);
    expect(isSingleAttributeSignal([{ dimension: "TOE_SHAPE", value: "POINTED" }])).toBe(true);
  });

  it("B) color/material cannot enter radar signal attributes", () => {
    expect(
      containsForbiddenDimension([
        { dimension: "COLOR" as never, value: "BLACK" },
      ]),
    ).toBe(true);
  });

  it("C) same model family with many variants counts once", () => {
    const products = [
      product({ brand: "BRAND A", productUrl: "https://x/1", productName: "Julie Pump Black" }),
      product({ brand: "BRAND A", productUrl: "https://x/2", productName: "Julie Pump Bordo", color: "Bordo", cleaned: { color: "Bordo", heelHeight: null } }),
    ];
    const families = [
      family({
        modelFamilyId: "brand-a--julie",
        brand: "BRAND A",
        representativeProductId: "https://x/1",
        variantCount: 2,
        sourceProductIds: ["https://x/1", "https://x/2"],
      }),
      family({
        modelFamilyId: "brand-b--aria",
        brand: "BRAND B",
        representativeProductId: "https://x/3",
        canonicalName: "Aria Pump",
      }),
    ];
    products.push(
      product({
        brand: "BRAND B",
        productUrl: "https://x/3",
        productName: "Aria Pump",
        normalized: {
          category: "PUMP",
          colorFamily: "BLACK",
          materialFamily: "LEATHER",
          heelType: "STILETTO",
          heelHeightGroup: "HIGH",
          toeShape: "POINTED",
          details: ["BUCKLE"],
          construction: ["ANKLE_STRAP", "CLOSED_TOE"],
        },
      }),
    );

    const indexed = buildFamilyIndex(families, new Map(products.map((p) => [p.productUrl, p])));
    const { earlySignals } = discoverCategoryDirections({
      category: "PUMP",
      families: indexed,
      provenanceMap: new Map(),
      comparisonAvailable: false,
    });

    const signal = earlySignals.find((entry) =>
      entry.allEvidence.some((item) => item.modelFamilyId === "brand-a--julie"),
    );
    if (signal) {
      expect(
        signal.allEvidence.filter((item) => item.modelFamilyId === "brand-a--julie"),
      ).toHaveLength(1);
    }
  });

  it("F) missing required attribute excludes product from cluster", () => {
    const required: SignalAttribute[] = [
      { dimension: "CONSTRUCTION", value: "ANKLE_STRAP" },
      { dimension: "TOE_SHAPE", value: "POINTED" },
    ];
    const match = product({
      brand: "BRAND A",
      productUrl: "https://x/1",
    });
    const miss = product({
      brand: "BRAND B",
      productUrl: "https://x/2",
      normalized: {
        category: "PUMP",
        colorFamily: "BLACK",
        materialFamily: "LEATHER",
        heelType: "STILETTO",
        heelHeightGroup: "HIGH",
        toeShape: "POINTED",
        details: [],
        construction: ["CLOSED_TOE"],
      },
    });
    const provenanceMap = new Map([
      [match.productUrl.toLowerCase(), { text: true, vision: true }],
      [miss.productUrl.toLowerCase(), { text: true, vision: true }],
    ]);

    expect(productHasRequiredAttributes(match, required, provenanceMap)).toBe(true);
    expect(productHasRequiredAttributes(miss, required, provenanceMap)).toBe(false);
  });

  it("H) insufficient evidence yields no signal cards", () => {
    const products = [
      product({ brand: "UNKNOWN BRAND", productUrl: "https://x/1" }),
      product({ brand: "UNKNOWN BRAND 2", productUrl: "https://x/2" }),
    ];
    const families = [
      family({
        modelFamilyId: "u1",
        brand: "UNKNOWN BRAND",
        representativeProductId: "https://x/1",
      }),
      family({
        modelFamilyId: "u2",
        brand: "UNKNOWN BRAND 2",
        representativeProductId: "https://x/2",
      }),
    ];

    const result = buildMasterRadar({
      products,
      families,
      changeReport,
      provenanceMap: new Map(),
      collectedAt: "2026-08-18T10:00:00.000Z",
    });

    expect(result.allSignals).toHaveLength(0);
  });

  it("I) one snapshot => momentum null", () => {
    const products = [
      product({ brand: "BRAND A", productUrl: "https://x/1" }),
      product({ brand: "BRAND B", productUrl: "https://x/2" }),
      product({ brand: "BRAND C", productUrl: "https://x/3" }),
    ];
    const families = products.map((entry, index) =>
      family({
        modelFamilyId: `f-${index}`,
        brand: entry.brand,
        representativeProductId: entry.productUrl,
      }),
    );

    const result = buildMasterRadar({
      products,
      families,
      changeReport,
      provenanceMap: new Map(),
      collectedAt: "2026-08-18T10:00:00.000Z",
    });

    for (const signal of result.allSignals) {
      expect(signal.momentumScore).toBeNull();
    }
  });

  it("K) evidence cards are unique model families", () => {
    const products = [
      product({ brand: "BRAND A", productUrl: "https://x/1" }),
      product({ brand: "BRAND B", productUrl: "https://x/2" }),
      product({ brand: "BRAND C", productUrl: "https://x/3" }),
    ];
    const families = products.map((entry, index) =>
      family({
        modelFamilyId: `f-${index}`,
        brand: entry.brand,
        representativeProductId: entry.productUrl,
      }),
    );

    const result = buildMasterRadar({
      products,
      families,
      changeReport,
      provenanceMap: new Map(),
      collectedAt: "2026-08-18T10:00:00.000Z",
    });

    for (const signal of result.allSignals) {
      const ids = signal.allEvidence.map((item) => item.modelFamilyId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
