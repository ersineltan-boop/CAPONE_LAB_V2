import { VISION_VERIFICATION_THRESHOLDS } from "./config";
import { detectFeatureContradictions } from "./contradictionRules";
import {
  applyVerifierToFeature,
  finalizeFeatureResult,
} from "./radarEligibility";
import type {
  MultiImageAnalysisInput,
  TriState,
  VerifierBatchInput,
  VerifierDecision,
  VisualFeatureKey,
  VisualFeatureMap,
} from "./types";
import type { MultiImageVisionParsed } from "./verificationSchema";

const FEATURE_KEYS: VisualFeatureKey[] = [
  "category",
  "toeShape",
  "heelType",
  "heelHeightGroup",
  "ankleStrap",
  "slingback",
  "backless",
  "closedBack",
  "thong",
  "tStrap",
  "maryJaneStrap",
  "openToe",
  "closedToe",
  "laceUp",
  "lowVamp",
  "highVamp",
  "platform",
  "wedge",
  "buckle",
  "bow",
  "metalHardware",
];

function inferFromName(name: string, patterns: RegExp[]): boolean {
  const lower = name.toLowerCase();
  return patterns.some((pattern) => pattern.test(lower));
}

/**
 * Offline/heuristic multi-image pass — API yokken pilot pipeline'ını test etmek için.
 * Thong/slingback/mary-jane ürün adlarında ankleStrap false-positive düzeltmesi yapar.
 */
export function analyzeMultiImageOffline(
  input: MultiImageAnalysisInput & {
    textConstruction?: string[];
    textDetails?: string[];
  },
): VisualFeatureMap {
  const name = input.productName;
  const imageCount = input.imageUrls.length;
  const evidence = imageCount > 0 ? [0, Math.min(1, imageCount - 1)] : [];

  const hasThong =
    inferFromName(name, [/thong/, /flip.?flop/, /toe.?ring/]) ||
    (input.textDetails?.includes("THONG") ?? false);
  const hasSlingback =
    inferFromName(name, [/slingback/, /sling back/]) ||
    (input.textConstruction?.includes("SLINGBACK") ?? false);
  const hasMaryJane = inferFromName(name, [/mary.?jane/, /instep/]);
  const hasAnkleStrapName = inferFromName(name, [/ankle.?strap/]);
  const textAnkleStrap = input.textConstruction?.includes("ANKLE_STRAP") ?? false;
  const hasBackless = inferFromName(name, [/mule/, /slide/, /backless/]);
  const hasBallet = inferFromName(name, [/ballet/, /flat/, /ballerina/]);
  const hasPump = inferFromName(name, [/pump/, /heel/]);
  const hasWedge = inferFromName(name, [/wedge/]);
  const hasSandal = inferFromName(name, [/sandal/]);

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

  let ankleStrapValue: TriState = "UNKNOWN";
  let ankleStrapConfidence = 40;
  let ankleStrapReason = "No clear ankle strap in name";

  if (hasThong || hasSlingback || hasMaryJane) {
    ankleStrapValue = "NO";
    ankleStrapConfidence = 88;
    ankleStrapReason = hasThong
      ? "Thong silhouette — not ankle strap"
      : hasSlingback
        ? "Slingback silhouette — not ankle strap"
        : "Mary-jane instep strap — not ankle strap";
  } else if (textAnkleStrap && !hasAnkleStrapName) {
    ankleStrapValue = "NO";
    ankleStrapConfidence = 86;
    ankleStrapReason = "Text ANKLE_STRAP not supported by silhouette";
  } else if (hasAnkleStrapName || textAnkleStrap) {
    ankleStrapValue = "YES";
    ankleStrapConfidence = 82;
    ankleStrapReason = "Product name suggests ankle strap";
  }

  const features: VisualFeatureMap = {
    ankleStrap: visionFeature(ankleStrapValue, ankleStrapConfidence, ankleStrapReason),
    thong: visionFeature(hasThong ? "YES" : "NO", hasThong ? 90 : 70, "Thong visual/name"),
    slingback: visionFeature(
      hasSlingback ? "YES" : "NO",
      hasSlingback ? 88 : 65,
      "Slingback visual/name",
    ),
    maryJaneStrap: visionFeature(
      hasMaryJane ? "YES" : "NO",
      hasMaryJane ? 85 : 60,
      "Mary-jane strap",
    ),
    backless: visionFeature(
      hasBackless || hasSlingback ? "YES" : "UNKNOWN",
      hasBackless ? 86 : 50,
      "Backless/mule/slide",
    ),
    closedBack: visionFeature(
      hasPump && !hasBackless ? "YES" : "UNKNOWN",
      55,
      "Closed back inference",
    ),
    openToe: visionFeature(
      hasSandal || hasThong ? "YES" : "UNKNOWN",
      60,
      "Open toe inference",
    ),
    closedToe: visionFeature(hasBallet || hasPump ? "YES" : "UNKNOWN", 58, "Closed toe"),
    wedge: visionFeature(hasWedge ? "YES" : "NO", hasWedge ? 87 : 55, "Wedge"),
    category: visionFeature(
      "YES",
      70,
      input.category ?? "footwear",
    ),
  };

  detectFeatureContradictions(features);
  return features;
}

export function parsedVisionToFeatureMap(
  parsed: MultiImageVisionParsed,
): VisualFeatureMap {
  const features: VisualFeatureMap = {};

  for (const key of FEATURE_KEYS) {
    const raw = parsed[key as keyof MultiImageVisionParsed];
    if (!raw || typeof raw !== "object" || !("value" in raw)) continue;
    features[key] = finalizeFeatureResult({
      value: raw.value,
      confidence: raw.confidence,
      evidenceImageIndexes: raw.evidenceImageIndexes,
      reasoningShort: raw.reasoningShort,
      source: "VISION",
      verifierStatus: "SKIPPED",
    });
  }

  detectFeatureContradictions(features);
  return features;
}

export function runOfflineVerifier(
  features: VisualFeatureMap,
  input: VerifierBatchInput,
): VerifierDecision[] {
  const decisions: VerifierDecision[] = [];
  const { verifierTriggerMinConfidence } = VISION_VERIFICATION_THRESHOLDS;

  for (const candidate of input.features) {
    if (
      candidate.value !== "YES" ||
      candidate.confidence < verifierTriggerMinConfidence
    ) {
      continue;
    }

    const featureKey = candidate.feature as VisualFeatureKey;
    const current = features[featureKey];
    if (!current) continue;

    let status: VerifierDecision["status"] = "UNCERTAIN";
    let reasoningShort = "Insufficient offline evidence";

    if (candidate.feature === "ankleStrap") {
      if (candidate.confidence >= 80) {
        status = "VERIFIED";
        reasoningShort = "Ankle strap geometry confirmed";
      }
    } else if (candidate.confidence >= 85) {
      status = "VERIFIED";
      reasoningShort = "Offline high-confidence pass";
    }

    decisions.push({
      feature: featureKey,
      initialValue: candidate.value,
      initialConfidence: candidate.confidence,
      status,
      reasoningShort,
      evidenceImageIndexes: candidate.evidenceImageIndexes,
    });

    if (status === "VERIFIED") {
      features[featureKey] = applyVerifierToFeature(current, "VERIFIED");
    } else if (status === "REJECTED") {
      features[featureKey] = applyVerifierToFeature(current, "REJECTED");
    } else {
      features[featureKey] = applyVerifierToFeature(current, "UNCERTAIN");
    }
  }

  detectFeatureContradictions(features);
  return decisions;
}

export function collectVerifierCandidates(
  features: VisualFeatureMap,
): VerifierBatchInput["features"] {
  const { verifierTriggerMinConfidence } = VISION_VERIFICATION_THRESHOLDS;
  const candidates: VerifierBatchInput["features"] = [];

  for (const feature of [
    "ankleStrap",
    "slingback",
    "thong",
    "maryJaneStrap",
    "backless",
    "closedBack",
    "tStrap",
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
