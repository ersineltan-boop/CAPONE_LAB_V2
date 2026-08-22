import type { AnalyzedProduct } from "../../types/marketAnalysis";
import { finalizeFeatureResult } from "./radarEligibility";
import type { TriState, VisualFeatureKey, VisualFeatureMap } from "./types";

function triFromConstruction(
  product: AnalyzedProduct,
  tag: string,
): TriState {
  const has = product.normalized.construction.includes(tag);
  return has ? "YES" : "UNKNOWN";
}

function triFromDetail(product: AnalyzedProduct, tag: string): TriState {
  const has = product.normalized.details.includes(tag);
  return has ? "YES" : "UNKNOWN";
}

function textFeature(
  value: TriState,
  confidence = 60,
  reasoningShort: string,
): VisualFeatureMap[string] {
  return finalizeFeatureResult({
    value,
    confidence,
    evidenceImageIndexes: [],
    reasoningShort,
    source: "TEXT",
    verifierStatus: "SKIPPED",
  });
}

/** Mevcut text-normalized pipeline'dan eski feature snapshot'ı. */
export function extractOldFeaturesFromText(
  product: AnalyzedProduct,
): VisualFeatureMap {
  const category = product.normalized.category ?? product.category;
  const features: VisualFeatureMap = {};

  if (category && category !== "UNKNOWN" && category !== "OTHER_FOOTWEAR") {
    features.category = textFeature(
      "YES",
      55,
      `Text category: ${category}`,
    );
  }

  const toe = product.normalized.toeShape;
  if (toe && toe !== "UNKNOWN") {
    features.toeShape = textFeature("YES", 55, `Text toeShape: ${toe}`);
    if (toe === "OPEN") features.openToe = textFeature("YES", 50, "Text open toe");
    if (toe === "ROUND" || toe === "POINTED" || toe === "SQUARE") {
      features.closedToe = textFeature("YES", 45, "Text closed toe inference");
    }
  }

  const heel = product.normalized.heelType;
  if (heel && heel !== "UNKNOWN") {
    features.heelType = textFeature("YES", 55, `Text heelType: ${heel}`);
    if (heel === "WEDGE") features.wedge = textFeature("YES", 55, "Text wedge");
    if (heel === "PLATFORM") features.platform = textFeature("YES", 55, "Text platform");
  }

  const heelHeight = product.normalized.heelHeightGroup;
  if (heelHeight && heelHeight !== "UNKNOWN") {
    features.heelHeightGroup = textFeature(
      "YES",
      50,
      `Text heelHeightGroup: ${heelHeight}`,
    );
  }

  features.ankleStrap = textFeature(
    triFromConstruction(product, "ANKLE_STRAP"),
    60,
    "Text construction ANKLE_STRAP",
  );
  features.slingback = textFeature(
    triFromConstruction(product, "SLINGBACK"),
    60,
    "Text construction SLINGBACK",
  );
  features.backless = textFeature(
    triFromConstruction(product, "BACKLESS"),
    60,
    "Text construction BACKLESS",
  );
  features.tStrap = textFeature(
    triFromConstruction(product, "T_STRAP"),
    60,
    "Text construction T_STRAP",
  );
  const openToeFromConstruction =
    triFromConstruction(product, "OPEN_TOE") === "YES" ||
    triFromConstruction(product, "PEEP_TOE") === "YES";
  features.openToe = textFeature(
    openToeFromConstruction ? "YES" : "UNKNOWN",
    55,
    "Text construction open/peep toe",
  );
  features.closedToe = textFeature(
    triFromConstruction(product, "CLOSED_TOE"),
    55,
    "Text construction CLOSED_TOE",
  );
  features.lowVamp = textFeature(
    triFromConstruction(product, "LOW_VAMP"),
    55,
    "Text LOW_VAMP",
  );
  features.highVamp = textFeature(
    triFromConstruction(product, "HIGH_VAMP"),
    55,
    "Text HIGH_VAMP",
  );
  features.thong = textFeature(
    triFromDetail(product, "THONG"),
    60,
    "Text detail THONG",
  );
  features.laceUp = textFeature(
    triFromDetail(product, "LACE_UP"),
    55,
    "Text detail LACE_UP",
  );
  features.buckle = textFeature(
    triFromDetail(product, "BUCKLE"),
    55,
    "Text detail BUCKLE",
  );
  features.bow = textFeature(
    triFromDetail(product, "BOW"),
    55,
    "Text detail BOW",
  );
  features.metalHardware = textFeature(
    triFromDetail(product, "METAL_HARDWARE"),
    55,
    "Text detail METAL_HARDWARE",
  );

  if (
    features.backless?.value === "YES" &&
    features.slingback?.value !== "YES"
  ) {
    features.closedBack = textFeature("NO", 45, "Text backless implies open back");
  }

  return features;
}

export function listChangedFeatures(
  oldFeatures: VisualFeatureMap,
  newFeatures: VisualFeatureMap,
): Array<{
  feature: VisualFeatureKey;
  oldValue: TriState;
  newValue: TriState;
  oldConfidence: number;
  newConfidence: number;
  reason: string;
}> {
  const keys = new Set([
    ...Object.keys(oldFeatures),
    ...Object.keys(newFeatures),
  ]) as Set<VisualFeatureKey>;

  const changes: Array<{
    feature: VisualFeatureKey;
    oldValue: TriState;
    newValue: TriState;
    oldConfidence: number;
    newConfidence: number;
    reason: string;
  }> = [];

  for (const feature of keys) {
    const oldF = oldFeatures[feature];
    const newF = newFeatures[feature];
    if (!oldF && !newF) continue;

    const oldValue = oldF?.value ?? "UNKNOWN";
    const newValue = newF?.value ?? "UNKNOWN";
    const oldConfidence = oldF?.confidence ?? 0;
    const newConfidence = newF?.confidence ?? 0;

    if (oldValue !== newValue || Math.abs(oldConfidence - newConfidence) >= 20) {
      changes.push({
        feature,
        oldValue,
        newValue,
        oldConfidence,
        newConfidence,
        reason: newF?.reasoningShort ?? oldF?.reasoningShort ?? "",
      });
    }
  }

  return changes;
}
