import {
  countRadarEligibleFeatures,
  isRadarEligibleFeature,
} from "./radarEligibility";
import type {
  ImportantCorrection,
  VerificationPilotProductResult,
  VerificationPilotReport,
  VerificationPilotSummary,
  VisualFeatureKey,
} from "./types";

const CRITICAL_FEATURES: VisualFeatureKey[] = [
  "ankleStrap",
  "slingback",
  "thong",
  "maryJaneStrap",
  "backless",
];

export function buildVerificationSummary(
  products: VerificationPilotProductResult[],
): VerificationPilotSummary {
  let verifiedFeatures = 0;
  let rejectedOldFeatures = 0;
  let uncertainFeatures = 0;
  let contradictionCount = 0;
  let criticalLabelChanges = 0;
  let radarEligibleFeatureCount = 0;

  for (const product of products) {
    contradictionCount += product.contradictions.length;
    radarEligibleFeatureCount += product.radarEligibleFeatures.length;

    for (const decision of product.verifierDecisions) {
      if (decision.status === "VERIFIED") verifiedFeatures += 1;
      if (decision.status === "REJECTED") rejectedOldFeatures += 1;
      if (decision.status === "UNCERTAIN") uncertainFeatures += 1;
    }

    for (const change of product.changedFeatures) {
      if (CRITICAL_FEATURES.includes(change.feature)) {
        criticalLabelChanges += 1;
      }
      if (
        change.oldValue === "YES" &&
        change.newValue === "NO" &&
        CRITICAL_FEATURES.includes(change.feature)
      ) {
        rejectedOldFeatures += 1;
      }
    }
  }

  return {
    analyzedModelFamilies: products.length,
    verifiedFeatures,
    rejectedOldFeatures,
    uncertainFeatures,
    contradictionCount,
    criticalLabelChanges,
    radarEligibleFeatureCount,
  };
}

export function buildImportantCorrections(
  products: VerificationPilotProductResult[],
  limit = 20,
): ImportantCorrection[] {
  const corrections: ImportantCorrection[] = [];

  for (const product of products) {
    for (const change of product.changedFeatures) {
      if (!CRITICAL_FEATURES.includes(change.feature)) continue;
      const newFeature = product.newFeatures[change.feature];
      const oldFeature = product.oldFeatures[change.feature];
      const verifier = product.verifierDecisions.find(
        (decision) => decision.feature === change.feature,
      );

      corrections.push({
        brand: product.brand,
        canonicalName: product.canonicalName,
        productUrl: product.productUrl,
        oldLabel: `${change.feature}=${change.oldValue}`,
        newLabel: `${change.feature}=${change.newValue}`,
        reason:
          verifier?.reasoningShort ??
          newFeature?.reasoningShort ??
          change.reason,
        evidenceImageIndexes:
          newFeature?.evidenceImageIndexes ??
          oldFeature?.evidenceImageIndexes ??
          [],
      });
    }

    for (const decision of product.verifierDecisions) {
      if (decision.status !== "REJECTED") continue;
      if (corrections.some((c) => c.productUrl === product.productUrl && c.oldLabel.includes(decision.feature))) {
        continue;
      }
      corrections.push({
        brand: product.brand,
        canonicalName: product.canonicalName,
        productUrl: product.productUrl,
        oldLabel: `${decision.feature}=${decision.initialValue}`,
        newLabel: `${decision.feature}=NO/REJECTED`,
        reason: decision.reasoningShort,
        evidenceImageIndexes: decision.evidenceImageIndexes,
      });
    }
  }

  return corrections
    .sort((a, b) => b.evidenceImageIndexes.length - a.evidenceImageIndexes.length)
    .slice(0, limit);
}

export function collectRadarEligibleFeatureKeys(
  features: VerificationPilotProductResult["newFeatures"],
): VisualFeatureKey[] {
  return Object.entries(features)
    .filter(([key, feature]) =>
      feature && isRadarEligibleFeature(feature, key as VisualFeatureKey),
    )
    .map(([key]) => key as VisualFeatureKey);
}

export function buildVerificationPilotReport(input: {
  model: string;
  verifierModel: string;
  mode: "live" | "offline";
  products: VerificationPilotProductResult[];
}): VerificationPilotReport {
  const summary = buildVerificationSummary(input.products);
  return {
    generatedAt: new Date().toISOString(),
    model: input.model,
    verifierModel: input.verifierModel,
    mode: input.mode,
    summary,
    products: input.products,
    mostImportantCorrections: buildImportantCorrections(input.products),
  };
}
