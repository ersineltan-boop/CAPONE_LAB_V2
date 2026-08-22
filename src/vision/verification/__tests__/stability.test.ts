import { describe, expect, it } from "vitest";

import {
  analyzeStabilityAcrossRuns,
  classifyFeatureStability,
  isStabilityRadarEligible,
  summarizeStability,
} from "../stabilityAnalysis";
import type { StabilityRunSnapshot } from "../stabilityAnalysis";
import type { VerificationPilotV2ProductResult } from "../types";

function mockProduct(
  modelFamilyId: string,
  features: Partial<Record<string, { value: "YES" | "NO" | "UNKNOWN"; confidence: number; verifierStatus: "VERIFIED" | "SKIPPED" | "REJECTED" }>>,
): VerificationPilotV2ProductResult {
  const newFeatures: VerificationPilotV2ProductResult["newFeatures"] = {};

  for (const [key, raw] of Object.entries(features)) {
    newFeatures[key as keyof typeof newFeatures] = {
      value: raw.value,
      confidence: raw.confidence,
      evidenceImageIndexes: [0],
      reasoningShort: "test",
      source: "VISION",
      verifierStatus: raw.verifierStatus,
      usabilityStatus: "RADAR_ELIGIBLE",
      radarEligible: raw.verifierStatus === "VERIFIED" && raw.value === "YES",
    };
  }

  return {
    brand: "TEST",
    modelFamilyId,
    canonicalName: modelFamilyId,
    productUrl: `https://example.com/${modelFamilyId}`,
    productName: modelFamilyId,
    imageCount: 2,
    imageUrls: ["https://example.com/1.jpg"],
    oldFeatures: {},
    newFeatures,
    strapElements: features.ankleStrap?.value === "YES"
      ? [{
          type: "ANKLE_STRAP",
          location: "ANKLE",
          wrapsAround: "ANKLE",
          closure: "BUCKLE",
          confidence: 95,
          evidenceImageIndexes: [0],
        }]
      : [],
    verifierDecisions: [],
    verifierDecisionsV2: [],
    changedFeatures: [],
    contradictions: [],
    radarEligibleFeatures: [],
  };
}

function mockRun(
  runId: "V2_RUN_A" | "V2_RUN_B" | "V2_RUN_C",
  products: VerificationPilotV2ProductResult[],
): StabilityRunSnapshot {
  return {
    runId,
    completedAt: new Date().toISOString(),
    products,
    apiFailures: [],
  };
}

describe("stabilityAnalysis", () => {
  it("classifies STABLE_YES when 3/3 YES", () => {
    expect(
      classifyFeatureStability(
        {
          V2_RUN_A: "YES",
          V2_RUN_B: "YES",
          V2_RUN_C: "YES",
        },
        { V2_RUN_A: true, V2_RUN_B: true, V2_RUN_C: true },
      ),
    ).toBe("STABLE_YES");
  });

  it("classifies INCOMPLETE_RUN when a run is missing", () => {
    expect(
      classifyFeatureStability(
        {
          V2_RUN_A: "YES",
          V2_RUN_B: "MISSING",
          V2_RUN_C: "YES",
        },
        { V2_RUN_A: true, V2_RUN_B: false, V2_RUN_C: true },
      ),
    ).toBe("INCOMPLETE_RUN");
  });

  it("classifies UNSTABLE when values differ", () => {
    expect(
      classifyFeatureStability(
        {
          V2_RUN_A: "YES",
          V2_RUN_B: "NO",
          V2_RUN_C: "YES",
        },
        { V2_RUN_A: true, V2_RUN_B: true, V2_RUN_C: true },
      ),
    ).toBe("UNSTABLE");
  });

  it("requires 3/3 VERIFIED for stability radar eligibility", () => {
    const eligible = isStabilityRadarEligible({
      feature: "backless",
      runSnapshots: [
        { value: "YES", confidence: 95, evidenceImageIndexes: [0], verifierStatus: "VERIFIED" },
        { value: "YES", confidence: 96, evidenceImageIndexes: [0], verifierStatus: "VERIFIED" },
        { value: "YES", confidence: 94, evidenceImageIndexes: [0], verifierStatus: "VERIFIED" },
      ],
      strapElementsByRun: [[], [], []],
    });
    expect(eligible).toBe(true);

    const ineligible = isStabilityRadarEligible({
      feature: "backless",
      runSnapshots: [
        { value: "YES", confidence: 95, evidenceImageIndexes: [0], verifierStatus: "VERIFIED" },
        { value: "YES", confidence: 96, evidenceImageIndexes: [0], verifierStatus: "SKIPPED" },
        { value: "YES", confidence: 94, evidenceImageIndexes: [0], verifierStatus: "VERIFIED" },
      ],
      strapElementsByRun: [[], [], []],
    });
    expect(ineligible).toBe(false);
  });

  it("thong + ankle strap can both be STABLE_YES across runs", () => {
    const productA = mockProduct("family-1", {
      thong: { value: "YES", confidence: 95, verifierStatus: "VERIFIED" },
      ankleStrap: { value: "YES", confidence: 94, verifierStatus: "VERIFIED" },
    });
    const runs = [
      mockRun("V2_RUN_A", [productA]),
      mockRun("V2_RUN_B", [structuredClone(productA)]),
      mockRun("V2_RUN_C", [structuredClone(productA)]),
    ];

    const observations = analyzeStabilityAcrossRuns(runs);
    const thong = observations.find((item) => item.feature === "thong");
    const ankle = observations.find((item) => item.feature === "ankleStrap");
    expect(thong?.stabilityClass).toBe("STABLE_YES");
    expect(ankle?.stabilityClass).toBe("STABLE_YES");
  });

  it("summarizes stable and unstable counts", () => {
    const stable = mockProduct("family-1", {
      thong: { value: "YES", confidence: 95, verifierStatus: "VERIFIED" },
    });
    const unstableB = mockProduct("family-1", {
      thong: { value: "NO", confidence: 95, verifierStatus: "VERIFIED" },
    });
    const runs = [
      mockRun("V2_RUN_A", [stable]),
      mockRun("V2_RUN_B", [unstableB]),
      mockRun("V2_RUN_C", [stable]),
    ];
    const summary = summarizeStability(analyzeStabilityAcrossRuns(runs));
    expect(summary.unstable).toBeGreaterThan(0);
  });
});
