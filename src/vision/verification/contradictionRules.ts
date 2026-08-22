import type { ContradictionRecord, VisualFeatureKey, VisualFeatureMap } from "./types";

function getYes(
  features: VisualFeatureMap,
  key: VisualFeatureKey,
  minConfidence = 85,
): boolean {
  const feature = features[key];
  return (
    feature?.value === "YES" &&
    feature.confidence >= minConfidence &&
    !feature.contradictionFlag
  );
}

function markContradiction(
  features: VisualFeatureMap,
  keys: VisualFeatureKey[],
  message: string,
  contradictions: ContradictionRecord[],
): void {
  contradictions.push({ features: keys, message });
  for (const key of keys) {
    const feature = features[key];
    if (!feature) continue;
    feature.contradictionFlag = true;
    feature.usabilityStatus = "CONTRADICTION";
    feature.radarEligible = false;
  }
}

/**
 * Fiziksel olarak net çelişkiler — aşırı genişletilmedi.
 */
export function detectFeatureContradictions(
  features: VisualFeatureMap,
): ContradictionRecord[] {
  const contradictions: ContradictionRecord[] = [];

  if (getYes(features, "openToe") && getYes(features, "closedToe")) {
    markContradiction(
      features,
      ["openToe", "closedToe"],
      "OPEN_TOE and CLOSED_TOE cannot both be high-confidence YES",
      contradictions,
    );
  }

  if (getYes(features, "backless") && getYes(features, "closedBack")) {
    markContradiction(
      features,
      ["backless", "closedBack"],
      "BACKLESS and CLOSED_BACK cannot both be high-confidence YES",
      contradictions,
    );
  }

  return contradictions;
}

/** Strap kombinasyonları gerçek tasarımlarda birlikte bulunabilir — contradiction değil. */
export function strapsCanCoexist(
  _features: VisualFeatureMap,
): boolean {
  return true;
}
