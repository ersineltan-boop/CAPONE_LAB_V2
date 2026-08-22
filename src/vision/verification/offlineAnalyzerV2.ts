import { VISION_VERIFICATION_THRESHOLDS } from "./config";
import { detectFeatureContradictions } from "./contradictionRules";
import {
  applyVerifierToFeature,
  finalizeFeatureResult,
} from "./radarEligibility";
import {
  deriveStrapFeaturesFromTopology,
  refreshAllStrapEligibility,
} from "./strapTopology";
import type {
  MultiImageAnalysisInput,
  StrapElement,
  StrapClosure,
  StrapElementType,
  StrapLocation,
  StrapWrapsAround,
  TriState,
  VerifierBatchInput,
  VerifierDecisionV2,
  VisualFeatureMap,
} from "./types";

function inferFromName(name: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(name.toLowerCase()));
}

function element(
  type: StrapElementType,
  location: StrapLocation,
  wrapsAround: StrapWrapsAround,
  closure: StrapClosure,
  confidence: number,
  evidence: number[],
): StrapElement {
  return { type, location, wrapsAround, closure, confidence, evidenceImageIndexes: evidence };
}

/**
 * Offline V2 — topology-first heuristics for tests / no-API fallback.
 * Text/name is hint only; does NOT auto-set strap YES from title.
 */
export function analyzeMultiImageOfflineV2(
  input: MultiImageAnalysisInput,
): { features: VisualFeatureMap; strapElements: StrapElement[] } {
  const name = input.productName;
  const imageCount = input.imageUrls.length;
  const evidence = imageCount > 0 ? [0, Math.min(1, imageCount - 1)] : [];

  const hintThong = inferFromName(name, [/thong/, /flip.?flop/, /toe.?ring/]);
  const hintSlingback = inferFromName(name, [/slingback/, /sling back/]);
  const hintMaryJane = inferFromName(name, [/mary.?jane/]);
  const hintAnkleWrap = inferFromName(name, [/ankle.?strap/, /gladiator/]);
  const hintTStrap = inferFromName(name, [/t-?strap/]);
  const hasBackless = inferFromName(name, [/mule/, /slide/, /backless/]);
  const hasBallet = inferFromName(name, [/ballet/, /flat/, /ballerina/]);
  const hasWedge = inferFromName(name, [/wedge/]);

  const strapElements: StrapElement[] = [];

  if (hintThong) {
    strapElements.push(
      element("TOE_POST", "TOE", "NONE", "SLIP_ON", 92, evidence),
    );
  }
  if (hintSlingback) {
    strapElements.push(
      element("HEEL_SLING", "HEEL", "HEEL", "BUCKLE", 90, evidence),
    );
  }
  if (hintMaryJane) {
    strapElements.push(
      element("MARY_JANE_STRAP", "INSTEP", "FOOT", "BUCKLE", 88, evidence),
    );
  }
  if (hintAnkleWrap) {
    strapElements.push(
      element("ANKLE_STRAP", "ANKLE", "ANKLE", "BUCKLE", 91, evidence),
    );
  }
  if (hintTStrap) {
    strapElements.push(
      element("T_STRAP_VERTICAL", "INSTEP", "FOOT", "BUCKLE", 89, evidence),
      element("FOREFOOT_STRAP", "FOREFOOT", "FOOT", "BUCKLE", 87, evidence),
    );
  }

  const strapFeatures = deriveStrapFeaturesFromTopology(strapElements);

  function visionFeature(
    value: TriState,
    confidence: number,
    reasoningShort: string,
  ) {
    return finalizeFeatureResult({
      value,
      confidence,
      evidenceImageIndexes: evidence,
      reasoningShort,
      source: "VISION",
      verifierStatus: "SKIPPED",
    });
  }

  const features: VisualFeatureMap = {
    ...strapFeatures,
    backless: visionFeature(
      hasBackless || hintSlingback ? "YES" : "UNKNOWN",
      hasBackless ? 86 : 50,
      "Backless/mule/slide",
    ),
    closedBack: visionFeature("UNKNOWN", 55, "Closed back inference"),
    openToe: visionFeature("UNKNOWN", 60, "Open toe inference"),
    closedToe: visionFeature(hasBallet ? "YES" : "UNKNOWN", 58, "Closed toe"),
    wedge: visionFeature(hasWedge ? "YES" : "NO", hasWedge ? 87 : 55, "Wedge"),
    category: visionFeature("YES", 70, input.category ?? "footwear"),
  };

  detectFeatureContradictions(features);
  const refreshed = refreshAllStrapEligibility(features, strapElements);

  return { features: refreshed, strapElements };
}

export function collectVerifierCandidatesV2(
  features: VisualFeatureMap,
): VerifierBatchInput["features"] {
  const { verifierTriggerMinConfidence } = VISION_VERIFICATION_THRESHOLDS;
  const candidates: VerifierBatchInput["features"] = [];

  for (const feature of [
    "ankleStrap",
    "slingback",
    "thong",
    "maryJaneStrap",
    "tStrap",
    "backless",
    "closedBack",
    "openToe",
    "closedToe",
  ] as const) {
    const result = features[feature];
    if (!result) continue;
    if (result.value !== "YES") continue;
    if (result.confidence < verifierTriggerMinConfidence) continue;
    candidates.push({
      feature,
      value: result.value,
      confidence: result.confidence,
      reasoningShort: result.reasoningShort,
      evidenceImageIndexes: result.evidenceImageIndexes,
    });
  }

  return candidates;
}

export function runOfflineVerifierV2(
  features: VisualFeatureMap,
  strapElements: StrapElement[],
  input: VerifierBatchInput,
): VerifierDecisionV2[] {
  const decisions: VerifierDecisionV2[] = [];
  const { verifierTriggerMinConfidence } = VISION_VERIFICATION_THRESHOLDS;

  for (const candidate of input.features) {
    if (
      candidate.value !== "YES" ||
      candidate.confidence < verifierTriggerMinConfidence
    ) {
      continue;
    }

    const featureKey = candidate.feature;
    const current = features[featureKey as keyof VisualFeatureMap];
    if (!current) continue;

    let status: VerifierDecisionV2["status"] = "UNCERTAIN";
    let reasoningShort = "Insufficient offline evidence";
    let anatomicalLocation: VerifierDecisionV2["anatomicalLocation"] = "NONE";
    let wrapsAround: VerifierDecisionV2["wrapsAround"] = "NONE";
    let closure: VerifierDecisionV2["closure"] = "UNKNOWN";
    let topologyConfirmed = false;

    const supporting = strapElements.filter((element) => {
      if (candidate.feature === "thong") {
        return element.type === "TOE_POST" && element.location === "TOE";
      }
      if (candidate.feature === "ankleStrap") {
        return (
          (element.type === "ANKLE_STRAP" || element.type === "ANKLE_WRAP_LACE") &&
          element.location === "ANKLE"
        );
      }
      if (candidate.feature === "slingback") {
        return (
          (element.type === "HEEL_SLING" || element.type === "BACK_STRAP") &&
          element.location === "HEEL"
        );
      }
      if (candidate.feature === "maryJaneStrap") {
        return (
          (element.type === "MARY_JANE_STRAP" || element.type === "INSTEP_STRAP") &&
          element.location === "INSTEP"
        );
      }
      if (candidate.feature === "tStrap") {
        return element.type === "T_STRAP_VERTICAL";
      }
      return false;
    });

    if (supporting.length > 0) {
      status = "VERIFIED";
      topologyConfirmed = true;
      const primary = supporting[0];
      anatomicalLocation = primary.location;
      wrapsAround = primary.wrapsAround;
      closure = primary.closure;
      reasoningShort = `Topology confirms ${primary.type} at ${primary.location}`;
    } else if (candidate.confidence >= 85) {
      status = "VERIFIED";
      reasoningShort = "Offline high-confidence pass without explicit topology";
    }

    decisions.push({
      feature: featureKey as VerifierDecisionV2["feature"],
      initialValue: candidate.value,
      initialConfidence: candidate.confidence,
      status,
      reasoningShort,
      evidenceImageIndexes: candidate.evidenceImageIndexes,
      anatomicalLocation,
      wrapsAround,
      closure,
      topologyConfirmed,
    });

    if (status === "VERIFIED") {
      features[featureKey as keyof VisualFeatureMap] = applyVerifierToFeature(
        current,
        "VERIFIED",
      );
    } else if (status === "REJECTED") {
      features[featureKey as keyof VisualFeatureMap] = applyVerifierToFeature(
        current,
        "REJECTED",
      );
    } else {
      features[featureKey as keyof VisualFeatureMap] = applyVerifierToFeature(
        current,
        "UNCERTAIN",
      );
    }
  }

  detectFeatureContradictions(features);
  refreshAllStrapEligibility(features, strapElements);
  return decisions;
}
