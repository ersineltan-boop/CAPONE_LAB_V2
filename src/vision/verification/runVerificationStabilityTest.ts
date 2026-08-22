import {
  STABILITY_RUN_IDS,
  VISION_VERIFICATION_THRESHOLDS,
  type StabilityRunId,
} from "./config";
import { analyzeVerificationFamilyV2 } from "./analyzeVerificationFamilyV2";
import { selectPilotFamiliesByIds } from "./selectPilotFamiliesV2";
import { hasVisionApiKey } from "./openaiMultiImageV2";
import {
  analyzeStabilityAcrossRuns,
  buildAuditProductMatrix,
  runsFullyCompleted,
  summarizeStability,
  type StabilityRunSnapshot,
} from "./stabilityAnalysis";
import {
  STABILITY_AUDIT_PRODUCTS,
} from "./config";
import type {
  VerificationPilotV2ProductResult,
  VerificationStabilityReport,
} from "./types";
import type { ModelFamily } from "../../modelFamily/types";
import type { AnalyzedProduct } from "../../types/marketAnalysis";
import { getVisionModel } from "../openaiVision";

async function executeStabilityRun(input: {
  runId: StabilityRunId;
  families: ModelFamily[];
  products: AnalyzedProduct[];
  lockedModelFamilyIds: string[];
  forceOffline?: boolean;
}): Promise<StabilityRunSnapshot> {
  const mode: "live" | "offline" =
    !input.forceOffline && hasVisionApiKey() ? "live" : "offline";

  const selected = selectPilotFamiliesByIds({
    families: input.families,
    modelFamilyIds: input.lockedModelFamilyIds,
  });

  const productByUrl = new Map(
    input.products.map((product) => [product.productUrl, product]),
  );

  const results: VerificationPilotV2ProductResult[] = [];
  const apiFailures: string[] = [];

  for (const candidate of selected) {
    const product = productByUrl.get(candidate.representativeProductId);
    if (!product) {
      apiFailures.push(`${candidate.modelFamilyId}: missing product`);
      continue;
    }

    const imageUrls = candidate.representativeImages.slice(
      0,
      VISION_VERIFICATION_THRESHOLDS.maxEvidenceImages,
    );
    if (imageUrls.length === 0) {
      apiFailures.push(`${candidate.modelFamilyId}: no images`);
      continue;
    }

    try {
      const result = await analyzeVerificationFamilyV2({
        candidate,
        product,
        imageUrls,
        mode,
      });
      results.push(result);
    } catch (error) {
      apiFailures.push(
        `${candidate.modelFamilyId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return {
    runId: input.runId,
    completedAt: new Date().toISOString(),
    products: results,
    apiFailures,
  };
}

export async function runVerificationStabilityTest(input: {
  families: ModelFamily[];
  products: AnalyzedProduct[];
  lockedModelFamilyIds: string[];
  forceOffline?: boolean;
}): Promise<VerificationStabilityReport> {
  const selected = selectPilotFamiliesByIds({
    families: input.families,
    modelFamilyIds: input.lockedModelFamilyIds,
  });

  const productByUrl = new Map(
    input.products.map((product) => [product.productUrl, product]),
  );

  const expectedFamilies = selected.map((candidate) => {
    const product = productByUrl.get(candidate.representativeProductId);
    return {
      modelFamilyId: candidate.modelFamilyId,
      brand: candidate.brand,
      canonicalName: candidate.canonicalName,
      productUrl: product?.productUrl ?? candidate.representativeProductId,
    };
  });

  const runs: StabilityRunSnapshot[] = [];

  for (const runId of STABILITY_RUN_IDS) {
    const snapshot = await executeStabilityRun({
      runId,
      families: input.families,
      products: input.products,
      lockedModelFamilyIds: input.lockedModelFamilyIds,
      forceOffline: input.forceOffline,
    });
    runs.push(snapshot);
  }

  const observations = analyzeStabilityAcrossRuns(runs, expectedFamilies);
  const summary = summarizeStability(observations);
  const auditProductMatrices = buildAuditProductMatrix(runs, STABILITY_AUDIT_PRODUCTS);
  const expectedFamilyCount = input.lockedModelFamilyIds.length;
  const allApiFailures = runs.flatMap((run) =>
    run.apiFailures.map((failure) => `${run.runId}: ${failure}`),
  );

  const mode: "live" | "offline" =
    !input.forceOffline && hasVisionApiKey() ? "live" : "offline";

  return {
    generatedAt: new Date().toISOString(),
    version: "stability-v1",
    model: mode === "live" ? getVisionModel() : "offline-v2",
    mode,
    expectedFamilyCount,
    runsCompleted: runs.length,
    allRunsFullyCompleted: runsFullyCompleted(runs, expectedFamilyCount),
    summary: {
      totalCriticalFeatureObservations: summary.totalCriticalFeatureObservations,
      completeObservations: summary.completeObservations,
      incompleteRunObservations: summary.incompleteRunObservations,
      familiesWithCompleteTripleRun: summary.familiesWithCompleteTripleRun,
      stableYes: summary.stableYes,
      stableNo: summary.stableNo,
      unstable: summary.unstable,
      stableRadarEligible: summary.stableRadarEligible,
      featureStabilityRates: summary.featureStabilityRates,
      mostUnstableFeatures: summary.mostUnstableFeatures,
    },
    observations,
    unstableCombinations: summary.unstableCombinations,
    auditProductMatrices,
    runs: runs.map((run) => ({
      runId: run.runId,
      completedAt: run.completedAt,
      analyzedFamilies: run.products.length,
      apiFailures: run.apiFailures,
      products: run.products,
    })),
    apiFailures: allApiFailures,
  };
}
