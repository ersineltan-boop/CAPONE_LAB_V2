import { describe, expect, it } from "vitest";

import {
  detectFeatureContradictions,
  strapsCanCoexist,
} from "../contradictionRules";
import { finalizeFeatureResult, isRadarEligibleFeature } from "../radarEligibility";
import {
  analyzeMultiImageOffline,
} from "../offlineAnalyzer";
import {
  analyzeMultiImageOfflineV2,
  collectVerifierCandidatesV2,
  runOfflineVerifierV2,
} from "../offlineAnalyzerV2";
import { VISION_VERIFICATION_THRESHOLDS } from "../config";
import { selectVerificationPilotFamilies } from "../selectPilotFamilies";
import { productHasStrictVerifiedAttribute } from "../verifiedRadarGate";
import {
  deriveStrapFeaturesFromTopology,
  topologySupportsFeature,
} from "../strapTopology";
import type { StrapElement, VisualFeatureMap } from "../types";
import type { ModelFamily } from "../../../modelFamily/types";
import type { AnalyzedProduct } from "../../../types/marketAnalysis";

function feature(
  value: "YES" | "NO" | "UNKNOWN",
  confidence: number,
  overrides: Partial<ReturnType<typeof finalizeFeatureResult>> = {},
) {
  return finalizeFeatureResult({
    value,
    confidence,
    evidenceImageIndexes: [0, 2],
    reasoningShort: "test",
    source: "VISION",
    verifierStatus: overrides.verifierStatus ?? "VERIFIED",
    ...overrides,
  });
}

describe("contradictionRules V2", () => {
  it("thong + ankle strap is NOT a contradiction", () => {
    const features: VisualFeatureMap = {
      thong: feature("YES", 95),
      ankleStrap: feature("YES", 95),
    };
    expect(detectFeatureContradictions(features).length).toBe(0);
    expect(features.thong?.contradictionFlag).toBeUndefined();
    expect(features.ankleStrap?.contradictionFlag).toBeUndefined();
    expect(strapsCanCoexist(features)).toBe(true);
  });

  it("slingback + ankle strap is NOT a contradiction", () => {
    const features: VisualFeatureMap = {
      slingback: feature("YES", 95),
      ankleStrap: feature("YES", 95),
    };
    expect(detectFeatureContradictions(features).length).toBe(0);
  });

  it("mary jane + ankle strap is NOT a contradiction", () => {
    const features: VisualFeatureMap = {
      maryJaneStrap: feature("YES", 95),
      ankleStrap: feature("YES", 95),
    };
    expect(detectFeatureContradictions(features).length).toBe(0);
  });

  it("backless + closedBack contradiction yakalanıyor", () => {
    const features: VisualFeatureMap = {
      backless: feature("YES", 90),
      closedBack: feature("YES", 90),
    };
    expect(detectFeatureContradictions(features).length).toBe(1);
  });

  it("openToe + closedToe contradiction yakalanıyor", () => {
    const features: VisualFeatureMap = {
      openToe: feature("YES", 90),
      closedToe: feature("YES", 90),
    };
    expect(detectFeatureContradictions(features).length).toBe(1);
  });
});

describe("strap topology", () => {
  it("derives thong + ankle strap from complex topology", () => {
    const elements: StrapElement[] = [
      {
        type: "TOE_POST",
        location: "TOE",
        wrapsAround: "NONE",
        closure: "SLIP_ON",
        confidence: 95,
        evidenceImageIndexes: [0],
      },
      {
        type: "ANKLE_STRAP",
        location: "ANKLE",
        wrapsAround: "ANKLE",
        closure: "BUCKLE",
        confidence: 94,
        evidenceImageIndexes: [1, 2],
      },
    ];

    const derived = deriveStrapFeaturesFromTopology(elements);
    expect(derived.thong?.value).toBe("YES");
    expect(derived.ankleStrap?.value).toBe("YES");
    expect(topologySupportsFeature("thong", elements)).toBe(true);
    expect(topologySupportsFeature("ankleStrap", elements)).toBe(true);
  });
});

describe("radar eligibility V2", () => {
  it("missing/uncertain feature Radar evidence olmuyor", () => {
    expect(isRadarEligibleFeature(feature("UNKNOWN", 95), "ankleStrap")).toBe(false);
    expect(
      isRadarEligibleFeature(feature("YES", 60, { verifierStatus: "VERIFIED" }), "ankleStrap"),
    ).toBe(false);
  });

  it("verifier REJECTED feature Radar'a girmiyor", () => {
    const rejected = feature("NO", 90, { verifierStatus: "REJECTED" });
    expect(isRadarEligibleFeature(rejected, "ankleStrap")).toBe(false);
  });

  it("critical strap features require confidence >= 90", () => {
    const borderline = finalizeFeatureResult({
      value: "YES",
      confidence: 89,
      evidenceImageIndexes: [0],
      reasoningShort: "test",
      source: "VISION",
      verifierStatus: "VERIFIED",
    });
    borderline.radarEligible = true;
    expect(isRadarEligibleFeature(borderline, "ankleStrap")).toBe(false);

    const eligible = finalizeFeatureResult({
      value: "YES",
      confidence: 90,
      evidenceImageIndexes: [0],
      reasoningShort: "test",
      source: "VISION",
      verifierStatus: "VERIFIED",
    });
    eligible.radarEligible = true;
    expect(isRadarEligibleFeature(eligible, "ankleStrap")).toBe(true);
  });

  it("non-strap features keep 85 threshold", () => {
    const borderline = finalizeFeatureResult({
      value: "YES",
      confidence: 85,
      evidenceImageIndexes: [0],
      reasoningShort: "test",
      source: "VISION",
      verifierStatus: "VERIFIED",
    });
    borderline.radarEligible = true;
    expect(isRadarEligibleFeature(borderline, "backless")).toBe(true);
  });
});

describe("offline multi-image analyzer V2", () => {
  it("thong + ankle wrap topology coexists", () => {
    const { features, strapElements } = analyzeMultiImageOfflineV2({
      brand: "TEST",
      productName: "Gladiator Thong Ankle Strap Sandal",
      category: "SANDAL",
      imageUrls: ["https://example.com/1.jpg", "https://example.com/2.jpg"],
    });
    expect(strapElements.some((element) => element.type === "TOE_POST")).toBe(true);
    expect(strapElements.some((element) => element.type === "ANKLE_STRAP")).toBe(true);
    expect(features.thong?.value).toBe("YES");
    expect(features.ankleStrap?.value).toBe("YES");
  });

  it("multi-image evidence indices korunuyor", () => {
    const { features } = analyzeMultiImageOfflineV2({
      brand: "TEST",
      productName: "Slingback Pump",
      category: "PUMP",
      imageUrls: ["https://example.com/a.jpg", "https://example.com/b.jpg"],
    });
    expect(features.slingback?.evidenceImageIndexes.length).toBeGreaterThan(0);
  });

  it("verifier confirms ankle strap with topology at ANKLE location", () => {
    const { features, strapElements } = analyzeMultiImageOfflineV2({
      brand: "TEST",
      productName: "Ankle Strap Thong Sandal",
      category: "SANDAL",
      imageUrls: ["https://example.com/1.jpg"],
    });
    features.ankleStrap = feature("YES", 92);
    const decisions = runOfflineVerifierV2(features, strapElements, {
      brand: "TEST",
      productName: "Ankle Strap Thong Sandal",
      imageUrls: ["https://example.com/1.jpg"],
      features: collectVerifierCandidatesV2(features),
      strapElements,
    });
    const ankleDecision = decisions.find((decision) => decision.feature === "ankleStrap");
    expect(ankleDecision?.status).toBe("VERIFIED");
    expect(ankleDecision?.anatomicalLocation).toBe("ANKLE");
    expect(ankleDecision?.topologyConfirmed).toBe(true);
  });
});

describe("offline multi-image analyzer V1", () => {
  it("thong ürün adında ankleStrap NO without auto-reject on coexistence", () => {
    const features = analyzeMultiImageOffline({
      brand: "TEST",
      productName: "Micro Wedge Thong Sandal",
      category: "SANDAL",
      imageUrls: ["https://example.com/1.jpg", "https://example.com/2.jpg"],
    });
    expect(features.thong?.value).toBe("YES");
    expect(features.ankleStrap?.value).toBe("NO");
  });
});

describe("selectPilotFamilies", () => {
  it("30 family seçer ve marka çeşitliliği korur", () => {
    const products: AnalyzedProduct[] = [];
    const families: ModelFamily[] = [];

    for (let index = 0; index < 80; index += 1) {
      const brand = `BRAND ${index % 15}`;
      const url = `https://example.com/p/${index}`;
      products.push({
        source: "test",
        brand,
        productName: index % 3 === 0 ? "Thong Sandal" : "Ankle Strap Pump",
        productUrl: url,
        imageUrl: "https://example.com/img.jpg",
        category: "SANDAL",
        color: null,
        material: null,
        toeShape: null,
        heelType: null,
        heelHeight: null,
        details: null,
        discoveredAt: "2026-08-19T00:00:00.000Z",
        cleaned: { color: null, heelHeight: null },
        normalized: {
          category: "SANDAL",
          colorFamily: "BLACK",
          materialFamily: "LEATHER",
          heelType: "FLAT",
          heelHeightGroup: "FLAT",
          toeShape: "OPEN",
          details: index % 3 === 0 ? ["THONG"] : [],
          construction:
            index % 3 === 0
              ? ["BACKLESS", "OPEN_TOE"]
              : ["ANKLE_STRAP", "SLINGBACK"],
        },
      });
      families.push({
        modelFamilyId: `family-${index}`,
        brand,
        canonicalName: `Model ${index}`,
        category: "SANDAL",
        representativeProductId: url,
        representativeImage: "https://example.com/img.jpg",
        representativeImages: [
          "https://example.com/1.jpg",
          "https://example.com/2.jpg",
          "https://example.com/3.jpg",
          "https://example.com/4.jpg",
        ],
        variantCount: 2,
        variants: [],
        allImages: [],
        sourceProductIds: [url],
        groupingConfidence: "HIGH",
        groupingReason: "test",
      });
    }

    const selected = selectVerificationPilotFamilies({ families, products, limit: 30 });
    expect(selected.length).toBe(30);
    const brandSet = new Set(selected.map((item) => item.brand));
    expect(brandSet.size).toBeGreaterThan(10);
  });
});

describe("verifiedRadarGate", () => {
  it("strict verified attribute requires YES + threshold + verified", () => {
    const features: VisualFeatureMap = {
      ankleStrap: feature("YES", 90, { verifierStatus: "VERIFIED" }),
    };
    expect(
      productHasStrictVerifiedAttribute(features, {
        dimension: "CONSTRUCTION",
        value: "ANKLE_STRAP",
      }),
    ).toBe(true);

    features.ankleStrap = feature("YES", 90, { verifierStatus: "REJECTED" });
    expect(
      productHasStrictVerifiedAttribute(features, {
        dimension: "CONSTRUCTION",
        value: "ANKLE_STRAP",
      }),
    ).toBe(false);
  });
});

describe("config thresholds V2", () => {
  it("critical strap threshold 90", () => {
    expect(VISION_VERIFICATION_THRESHOLDS.criticalStrapMinConfidence).toBe(90);
  });

  it("general radar threshold 85", () => {
    expect(VISION_VERIFICATION_THRESHOLDS.radarEligibleMinConfidence).toBe(85);
  });
});
