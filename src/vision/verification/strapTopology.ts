import {
  CRITICAL_STRAP_FEATURES,
  VISION_VERIFICATION_THRESHOLDS,
} from "./config";
import { finalizeFeatureResult } from "./radarEligibility";
import type {
  CriticalStrapFeature,
  StrapElement,
  StrapElementType,
  StrapLocation,
  TriState,
  VisualFeatureKey,
  VisualFeatureMap,
  VisualFeatureResult,
} from "./types";

const STRAP_FEATURE_KEYS = new Set<VisualFeatureKey>(CRITICAL_STRAP_FEATURES);

function unionEvidenceIndexes(elements: StrapElement[]): number[] {
  return [...new Set(elements.flatMap((element) => element.evidenceImageIndexes))].sort(
    (a, b) => a - b,
  );
}

function maxConfidence(elements: StrapElement[]): number {
  return elements.reduce((max, element) => Math.max(max, element.confidence), 0);
}

function matchesType(element: StrapElement, types: StrapElementType[]): boolean {
  return types.includes(element.type);
}

function matchesLocation(element: StrapElement, locations: StrapLocation[]): boolean {
  return locations.includes(element.location);
}

export function topologySupportsFeature(
  feature: CriticalStrapFeature,
  elements: StrapElement[],
): boolean {
  const minConfidence = VISION_VERIFICATION_THRESHOLDS.visionUncertainMinConfidence;

  switch (feature) {
    case "thong":
      return elements.some(
        (element) =>
          matchesType(element, ["TOE_POST"]) &&
          matchesLocation(element, ["TOE"]) &&
          element.confidence >= minConfidence,
      );
    case "ankleStrap":
      return elements.some(
        (element) =>
          matchesType(element, ["ANKLE_STRAP", "ANKLE_WRAP_LACE"]) &&
          matchesLocation(element, ["ANKLE"]) &&
          (element.wrapsAround === "ANKLE" || element.wrapsAround === "FOOT") &&
          element.confidence >= minConfidence,
      );
    case "slingback":
      return elements.some(
        (element) =>
          matchesType(element, ["HEEL_SLING", "BACK_STRAP"]) &&
          matchesLocation(element, ["HEEL"]) &&
          element.confidence >= minConfidence,
      );
    case "maryJaneStrap":
      return elements.some(
        (element) =>
          matchesType(element, ["MARY_JANE_STRAP", "INSTEP_STRAP"]) &&
          matchesLocation(element, ["INSTEP"]) &&
          element.confidence >= minConfidence,
      );
    case "tStrap":
      return elements.some(
        (element) =>
          matchesType(element, ["T_STRAP_VERTICAL"]) &&
          matchesLocation(element, ["INSTEP", "FOREFOOT"]) &&
          element.confidence >= minConfidence,
      );
    default:
      return false;
  }
}

export function getSupportingStrapElements(
  feature: CriticalStrapFeature,
  elements: StrapElement[],
): StrapElement[] {
  const minConfidence = VISION_VERIFICATION_THRESHOLDS.visionUncertainMinConfidence;

  switch (feature) {
    case "thong":
      return elements.filter(
        (element) =>
          matchesType(element, ["TOE_POST"]) &&
          matchesLocation(element, ["TOE"]) &&
          element.confidence >= minConfidence,
      );
    case "ankleStrap":
      return elements.filter(
        (element) =>
          matchesType(element, ["ANKLE_STRAP", "ANKLE_WRAP_LACE"]) &&
          matchesLocation(element, ["ANKLE"]) &&
          (element.wrapsAround === "ANKLE" || element.wrapsAround === "FOOT") &&
          element.confidence >= minConfidence,
      );
    case "slingback":
      return elements.filter(
        (element) =>
          matchesType(element, ["HEEL_SLING", "BACK_STRAP"]) &&
          matchesLocation(element, ["HEEL"]) &&
          element.confidence >= minConfidence,
      );
    case "maryJaneStrap":
      return elements.filter(
        (element) =>
          matchesType(element, ["MARY_JANE_STRAP", "INSTEP_STRAP"]) &&
          matchesLocation(element, ["INSTEP"]) &&
          element.confidence >= minConfidence,
      );
    case "tStrap":
      return elements.filter(
        (element) =>
          matchesType(element, ["T_STRAP_VERTICAL"]) &&
          matchesLocation(element, ["INSTEP", "FOREFOOT"]) &&
          element.confidence >= minConfidence,
      );
    default:
      return [];
  }
}

function deriveStrapTriState(
  supporting: StrapElement[],
  allElements: StrapElement[],
): { value: TriState; confidence: number; evidenceImageIndexes: number[]; reasoningShort: string } {
  if (supporting.length > 0) {
    return {
      value: "YES",
      confidence: maxConfidence(supporting),
      evidenceImageIndexes: unionEvidenceIndexes(supporting),
      reasoningShort: `Derived from strap topology: ${supporting.map((element) => element.type).join(", ")}`,
    };
  }

  if (allElements.length >= 2) {
    return {
      value: "NO",
      confidence: 78,
      evidenceImageIndexes: unionEvidenceIndexes(allElements),
      reasoningShort: "No matching strap element in topology map",
    };
  }

  return {
    value: "UNKNOWN",
    confidence: 35,
    evidenceImageIndexes: [],
    reasoningShort: "Insufficient strap topology evidence",
  };
}

/** Semantic strap features — topology haritasından türetilir. */
export function deriveStrapFeaturesFromTopology(
  elements: StrapElement[],
): Pick<VisualFeatureMap, CriticalStrapFeature> {
  const derived: Pick<VisualFeatureMap, CriticalStrapFeature> = {};

  for (const feature of CRITICAL_STRAP_FEATURES) {
    const supporting = getSupportingStrapElements(feature, elements);
    const tri = deriveStrapTriState(supporting, elements);
    derived[feature] = finalizeFeatureResult({
      ...tri,
      source: "VISION",
      verifierStatus: "SKIPPED",
    });
  }

  return derived;
}

export function mergeTopologyStrapFeatures(
  features: VisualFeatureMap,
  elements: StrapElement[],
): VisualFeatureMap {
  const derived = deriveStrapFeaturesFromTopology(elements);
  const merged = { ...features };

  for (const feature of CRITICAL_STRAP_FEATURES) {
    merged[feature] = derived[feature];
  }

  return merged;
}

export function refreshStrapFeatureEligibility(
  key: CriticalStrapFeature,
  feature: VisualFeatureResult,
  elements: StrapElement[],
): VisualFeatureResult {
  const minConfidence = VISION_VERIFICATION_THRESHOLDS.criticalStrapMinConfidence;
  const hasEvidence = feature.evidenceImageIndexes.length >= 1;
  const topologyOk = topologySupportsFeature(key, elements);

  const usabilityStatus =
    feature.contradictionFlag
      ? "CONTRADICTION"
      : feature.confidence >= minConfidence
        ? "RADAR_ELIGIBLE"
        : feature.confidence >= VISION_VERIFICATION_THRESHOLDS.visionUncertainMinConfidence
          ? "VISION_UNCERTAIN"
          : "NOT_USABLE_FOR_RADAR";

  const radarEligible =
    feature.value === "YES" &&
    feature.confidence >= minConfidence &&
    feature.verifierStatus === "VERIFIED" &&
    hasEvidence &&
    topologyOk &&
    !feature.contradictionFlag;

  return {
    ...feature,
    usabilityStatus,
    radarEligible,
  };
}

export function refreshAllStrapEligibility(
  features: VisualFeatureMap,
  elements: StrapElement[],
): VisualFeatureMap {
  const refreshed = { ...features };

  for (const key of CRITICAL_STRAP_FEATURES) {
    const feature = refreshed[key];
    if (!feature) continue;
    refreshed[key] = refreshStrapFeatureEligibility(key, feature, elements);
  }

  return refreshed;
}

export function countActiveStrapFeatures(
  features: VisualFeatureMap,
): CriticalStrapFeature[] {
  return CRITICAL_STRAP_FEATURES.filter(
    (feature) => features[feature]?.value === "YES",
  );
}

export function isStrapFeatureKey(key: VisualFeatureKey): key is CriticalStrapFeature {
  return STRAP_FEATURE_KEYS.has(key);
}
