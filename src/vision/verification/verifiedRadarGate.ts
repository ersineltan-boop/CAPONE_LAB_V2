import type { AnalyzedProduct } from "../../types/marketAnalysis";
import type { SignalAttribute } from "../../radar/master/types";
import { VISION_VERIFICATION_THRESHOLDS } from "./config";
import { isRadarEligibleFeature } from "./radarEligibility";
import type { VisualFeatureKey, VisualFeatureMap, VisualFeatureResult } from "./types";

const ATTRIBUTE_TO_FEATURE: Partial<Record<string, VisualFeatureKey>> = {
  ANKLE_STRAP: "ankleStrap",
  SLINGBACK: "slingback",
  BACKLESS: "backless",
  T_STRAP: "tStrap",
  OPEN_TOE: "openToe",
  CLOSED_TOE: "closedToe",
  LOW_VAMP: "lowVamp",
  HIGH_VAMP: "highVamp",
  THONG: "thong",
  LACE_UP: "laceUp",
  BOW: "bow",
  BUCKLE: "buckle",
  METAL_HARDWARE: "metalHardware",
};

export function constructionValueToFeatureKey(
  value: string,
): VisualFeatureKey | null {
  return ATTRIBUTE_TO_FEATURE[value] ?? null;
}

export function productHasStrictVerifiedAttribute(
  verifiedFeatures: VisualFeatureMap | undefined,
  attribute: SignalAttribute,
): boolean {
  if (!verifiedFeatures) return false;

  if (attribute.dimension === "CONSTRUCTION" || attribute.dimension === "DETAIL") {
    const featureKey = constructionValueToFeatureKey(attribute.value);
    if (!featureKey) return false;
    const feature = verifiedFeatures[featureKey];
    if (!feature) return false;
    return isRadarEligibleFeature(feature);
  }

  if (attribute.dimension === "TOE_SHAPE") {
    const feature = verifiedFeatures.toeShape;
    if (!feature || !isRadarEligibleFeature(feature)) return false;
    return feature.value === "YES";
  }

  return false;
}

export function isStrictRadarFeatureUsable(
  feature: VisualFeatureResult | undefined,
): boolean {
  if (!feature) return false;
  if (feature.value !== "YES") return false;
  if (feature.confidence < VISION_VERIFICATION_THRESHOLDS.radarEligibleMinConfidence) {
    return false;
  }
  if (feature.verifierStatus === "REJECTED") return false;
  if (feature.contradictionFlag) return false;
  return feature.radarEligible;
}

export function mergeVerifiedOverText(params: {
  textFeatures: VisualFeatureMap;
  visionFeatures: VisualFeatureMap;
}): VisualFeatureMap {
  const merged: VisualFeatureMap = { ...params.textFeatures };

  for (const [key, visionFeature] of Object.entries(params.visionFeatures)) {
    const featureKey = key as VisualFeatureKey;
    const textFeature = merged[featureKey];
    if (!visionFeature) continue;

    if (isRadarEligibleFeature(visionFeature)) {
      merged[featureKey] = { ...visionFeature, source: "VERIFIED_VISION" };
      continue;
    }

    if (
      textFeature &&
      textFeature.value === "YES" &&
      visionFeature.value === "NO" &&
      visionFeature.verifierStatus === "REJECTED"
    ) {
      merged[featureKey] = visionFeature;
    }
  }

  return merged;
}

export type { AnalyzedProduct };
