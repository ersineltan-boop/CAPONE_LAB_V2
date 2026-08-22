import { VISION_VERIFICATION_THRESHOLDS } from "./config";
import { buildVerificationPilotReport } from "./buildVerificationReport";
import { collectRadarEligibleFeatureKeys } from "./buildVerificationReport";
import {
  extractOldFeaturesFromText,
  listChangedFeatures,
} from "./extractOldFeatures";
import {
  analyzeMultiImageOfflineV2,
  collectVerifierCandidatesV2,
  runOfflineVerifierV2,
} from "./offlineAnalyzerV2";
import {
  analyzeMultiImageLiveV2,
  verifyFeaturesLiveV2,
} from "./openaiMultiImageV2";
import { applyVerifierToFeature } from "./radarEligibility";
import { detectFeatureContradictions } from "./contradictionRules";
import { refreshAllStrapEligibility } from "./strapTopology";
import type {
  PilotFamilyCandidate,
  StrapElement,
  VerificationPilotV2ProductResult,
  VerifierDecisionV2,
  VisualFeatureMap,
} from "./types";
import type { AnalyzedProduct } from "../../types/marketAnalysis";

function cloneFeatures(features: VisualFeatureMap): VisualFeatureMap {
  return structuredClone(features);
}

async function applyLiveVerifierV2(
  features: VisualFeatureMap,
  strapElements: StrapElement[],
  input: {
    brand: string;
    productName: string;
    imageUrls: string[];
  },
): Promise<VerifierDecisionV2[]> {
  const candidates = collectVerifierCandidatesV2(features);
  if (candidates.length === 0) return [];

  const batch = await verifyFeaturesLiveV2({
    brand: input.brand,
    productName: input.productName,
    imageUrls: input.imageUrls,
    features: candidates,
    strapElements,
  });

  const decisions: VerifierDecisionV2[] = [];

  for (const decision of batch.decisions) {
    const featureKey = decision.feature as keyof VisualFeatureMap;
    const current = features[featureKey];
    if (!current) continue;

    const candidate = candidates.find((item) => item.feature === decision.feature);
    decisions.push({
      feature: decision.feature as VerifierDecisionV2["feature"],
      initialValue: candidate?.value ?? current.value,
      initialConfidence: candidate?.confidence ?? current.confidence,
      status: decision.status,
      reasoningShort: decision.reasoningShort,
      evidenceImageIndexes: decision.evidenceImageIndexes,
      anatomicalLocation: decision.anatomicalLocation,
      wrapsAround: decision.wrapsAround,
      closure: decision.closure,
      topologyConfirmed: decision.topologyConfirmed,
    });

    features[featureKey] = applyVerifierToFeature(current, decision.status);
  }

  detectFeatureContradictions(features);
  refreshAllStrapEligibility(features, strapElements);
  return decisions;
}

/** Tek family için V2 vision + verifier analizi. */
export async function analyzeVerificationFamilyV2(input: {
  candidate: PilotFamilyCandidate;
  product: AnalyzedProduct;
  imageUrls: string[];
  mode: "live" | "offline";
}): Promise<VerificationPilotV2ProductResult> {
  const { candidate, product, imageUrls, mode } = input;
  const oldFeatures = extractOldFeaturesFromText(product);

  let newFeatures: VisualFeatureMap;
  let strapElements: StrapElement[];
  let verifierDecisionsV2: VerifierDecisionV2[];

  if (mode === "live") {
    const live = await analyzeMultiImageLiveV2({
      brand: product.brand,
      productName: product.productName,
      category: product.normalized.category ?? product.category,
      imageUrls,
    });
    newFeatures = cloneFeatures(live.features);
    strapElements = live.strapElements;

    verifierDecisionsV2 = await applyLiveVerifierV2(newFeatures, strapElements, {
      brand: product.brand,
      productName: product.productName,
      imageUrls,
    });
  } else {
    const offline = analyzeMultiImageOfflineV2({
      brand: product.brand,
      productName: product.productName,
      category: product.normalized.category ?? product.category,
      imageUrls,
    });
    newFeatures = cloneFeatures(offline.features);
    strapElements = offline.strapElements;

    verifierDecisionsV2 = runOfflineVerifierV2(newFeatures, strapElements, {
      brand: product.brand,
      productName: product.productName,
      imageUrls,
      features: collectVerifierCandidatesV2(newFeatures),
      strapElements,
    });
  }

  refreshAllStrapEligibility(newFeatures, strapElements);
  const contradictions = detectFeatureContradictions(newFeatures);
  const changedFeatures = listChangedFeatures(oldFeatures, newFeatures);

  const verifierDecisions = verifierDecisionsV2.map((decision) => ({
    feature: decision.feature,
    initialValue: decision.initialValue,
    initialConfidence: decision.initialConfidence,
    status: decision.status,
    reasoningShort: decision.reasoningShort,
    evidenceImageIndexes: decision.evidenceImageIndexes,
  }));

  return {
    brand: candidate.brand,
    modelFamilyId: candidate.modelFamilyId,
    canonicalName: candidate.canonicalName,
    productUrl: product.productUrl,
    productName: product.productName,
    imageCount: imageUrls.length,
    imageUrls,
    oldFeatures,
    newFeatures,
    strapElements,
    verifierDecisions,
    verifierDecisionsV2,
    changedFeatures,
    contradictions,
    radarEligibleFeatures: collectRadarEligibleFeatureKeys(newFeatures),
  };
}

export { buildVerificationPilotReport };
