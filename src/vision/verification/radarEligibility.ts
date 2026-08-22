import {
  CRITICAL_STRAP_FEATURES,
  VISION_VERIFICATION_THRESHOLDS,
} from "./config";
import type {
  CriticalStrapFeature,
  FeatureUsabilityStatus,
  TriState,
  VerifierStatus,
  VisualFeatureKey,
  VisualFeatureMap,
  VisualFeatureResult,
} from "./types";

export function isCriticalStrapFeature(
  key: VisualFeatureKey,
): key is CriticalStrapFeature {
  return (CRITICAL_STRAP_FEATURES as readonly string[]).includes(key);
}

export function getMinRadarConfidence(key: VisualFeatureKey): number {
  return isCriticalStrapFeature(key)
    ? VISION_VERIFICATION_THRESHOLDS.criticalStrapMinConfidence
    : VISION_VERIFICATION_THRESHOLDS.radarEligibleMinConfidence;
}

export function computeUsabilityStatus(
  confidence: number,
  hasContradiction: boolean,
  minConfidence = VISION_VERIFICATION_THRESHOLDS.radarEligibleMinConfidence,
): FeatureUsabilityStatus {
  if (hasContradiction) return "CONTRADICTION";
  if (confidence >= minConfidence) {
    return "RADAR_ELIGIBLE";
  }
  if (confidence >= VISION_VERIFICATION_THRESHOLDS.visionUncertainMinConfidence) {
    return "VISION_UNCERTAIN";
  }
  return "NOT_USABLE_FOR_RADAR";
}

export function isRadarEligibleFeature(
  feature: VisualFeatureResult,
  key?: VisualFeatureKey,
): boolean {
  const minConfidence = key
    ? getMinRadarConfidence(key)
    : VISION_VERIFICATION_THRESHOLDS.radarEligibleMinConfidence;

  return (
    feature.value === "YES" &&
    feature.confidence >= minConfidence &&
    feature.verifierStatus === "VERIFIED" &&
    feature.usabilityStatus !== "CONTRADICTION" &&
    feature.radarEligible
  );
}

export function finalizeFeatureResult(input: {
  value: TriState;
  confidence: number;
  evidenceImageIndexes: number[];
  reasoningShort: string;
  source: VisualFeatureResult["source"];
  verifierStatus: VerifierStatus;
  contradictionFlag?: boolean;
}): VisualFeatureResult {
  const usabilityStatus = computeUsabilityStatus(
    input.confidence,
    Boolean(input.contradictionFlag),
  );
  const radarEligible =
    input.value === "YES" &&
    usabilityStatus === "RADAR_ELIGIBLE" &&
    input.verifierStatus === "VERIFIED";

  return {
    ...input,
    usabilityStatus,
    radarEligible,
  };
}

export function applyVerifierToFeature(
  feature: VisualFeatureResult,
  verifierStatus: VerifierStatus,
): VisualFeatureResult {
  const downgraded =
    verifierStatus === "REJECTED"
      ? {
          ...feature,
          value: "NO" as TriState,
          verifierStatus,
          reasoningShort: `${feature.reasoningShort} (verifier rejected)`,
        }
      : { ...feature, verifierStatus };

  return finalizeFeatureResult(downgraded);
}

export function countRadarEligibleFeatures(
  features: VisualFeatureMap,
): number {
  return Object.values(features).filter(
    (feature): feature is VisualFeatureResult =>
      Boolean(feature && isRadarEligibleFeature(feature)),
  ).length;
}
