import {
  CRITICAL_STRAP_FEATURES,
  VISION_VERIFICATION_THRESHOLDS,
} from "./config";
import { analyzeVerificationFamilyV2, buildVerificationPilotReport } from "./analyzeVerificationFamilyV2";
import { hasVisionApiKey } from "./openaiMultiImageV2";
import { selectPilotFamiliesByIds } from "./selectPilotFamiliesV2";
import {
  countActiveStrapFeatures,
  getSupportingStrapElements,
} from "./strapTopology";
import type {
  AnkleStrapAuditEntry,
  CriticalStrapFeature,
  TriState,
  VerificationPilotReport,
  VerificationPilotV2ProductResult,
  VerificationPilotV2Report,
} from "./types";
import type { ModelFamily } from "../../modelFamily/types";
import type { AnalyzedProduct } from "../../types/marketAnalysis";
import { isRadarEligibleFeature } from "./radarEligibility";

function countRadarEligibleCriticalStraps(
  product: VerificationPilotV2ProductResult,
): number {
  return CRITICAL_STRAP_FEATURES.filter((key) => {
    const feature = product.newFeatures[key];
    return feature && isRadarEligibleFeature(feature, key);
  }).length;
}

function buildAnkleStrapAudit(
  products: VerificationPilotV2ProductResult[],
): AnkleStrapAuditEntry[] {
  return products
    .filter((product) => product.newFeatures.ankleStrap?.value === "YES")
    .map((product) => {
      const ankle = product.newFeatures.ankleStrap!;
      const verifier = product.verifierDecisionsV2.find(
        (decision) => decision.feature === "ankleStrap",
      );
      const supporting = getSupportingStrapElements(
        "ankleStrap",
        product.strapElements,
      );
      const primary = supporting[0];

      return {
        brand: product.brand,
        canonicalName: product.canonicalName,
        productUrl: product.productUrl,
        value: ankle.value,
        confidence: ankle.confidence,
        evidenceImageIndexes: ankle.evidenceImageIndexes,
        strapLocation: verifier?.anatomicalLocation ?? primary?.location ?? "NONE",
        wrapsAround: verifier?.wrapsAround ?? primary?.wrapsAround ?? "NONE",
        closure: verifier?.closure ?? primary?.closure ?? "UNKNOWN",
        verifierStatus: ankle.verifierStatus,
        topologyConfirmed: verifier?.topologyConfirmed ?? supporting.length > 0,
        radarEligible: ankle.radarEligible,
        supportingElements: supporting,
      };
    });
}

function buildStrapYesSummaries(
  products: VerificationPilotV2ProductResult[],
  feature: CriticalStrapFeature,
) {
  return products
    .filter((product) => product.newFeatures[feature]?.value === "YES")
    .map((product) => ({
      brand: product.brand,
      canonicalName: product.canonicalName,
      productUrl: product.productUrl,
      strapFeatures: Object.fromEntries(
        CRITICAL_STRAP_FEATURES.map((key) => [
          key,
          product.newFeatures[key]?.value ?? "UNKNOWN",
        ]),
      ) as Partial<Record<CriticalStrapFeature, TriState>>,
    }));
}

function buildManualAuditList(products: VerificationPilotV2ProductResult[]) {
  const audit: VerificationPilotV2Report["manualAuditProducts"] = [];

  for (const product of products) {
    const reasons: string[] = [];
    const ankle = product.newFeatures.ankleStrap;
    const activeStraps = countActiveStrapFeatures(product.newFeatures);

    if (
      ankle?.value === "YES" &&
      (ankle.confidence < 92 || !ankle.radarEligible)
    ) {
      reasons.push("ankle strap YES but below radar eligibility or low confidence");
    }

    if (activeStraps.length >= 3) {
      reasons.push(`complex multi-strap: ${activeStraps.join(", ")}`);
    }

    if (
      product.newFeatures.thong?.value === "YES" &&
      product.newFeatures.ankleStrap?.value === "YES" &&
      !product.newFeatures.ankleStrap?.radarEligible
    ) {
      reasons.push("thong + ankle strap combo needs visual audit");
    }

    const ankleVerifier = product.verifierDecisionsV2.find(
      (decision) => decision.feature === "ankleStrap",
    );
    if (ankleVerifier?.status === "UNCERTAIN") {
      reasons.push("verifier uncertain on ankle strap");
    }

    if (reasons.length > 0) {
      audit.push({
        brand: product.brand,
        canonicalName: product.canonicalName,
        productUrl: product.productUrl,
        reason: reasons.join("; "),
      });
    }
  }

  return audit;
}

function compareWithV1Live(
  v2Products: VerificationPilotV2ProductResult[],
  v1Report: VerificationPilotReport | null,
): VerificationPilotV2Report["v1LiveComparison"] {
  if (!v1Report) return undefined;

  const v1ById = new Map(
    v1Report.products.map((product) => [product.modelFamilyId, product]),
  );

  const criticalStrapDeltas: NonNullable<
    VerificationPilotV2Report["v1LiveComparison"]
  >["criticalStrapDeltas"] = [];

  for (const v2 of v2Products) {
    const v1 = v1ById.get(v2.modelFamilyId);
    if (!v1) continue;

    for (const feature of CRITICAL_STRAP_FEATURES) {
      const v1Value = v1.newFeatures[feature]?.value ?? "UNKNOWN";
      const v2Value = v2.newFeatures[feature]?.value ?? "UNKNOWN";
      if (v1Value !== v2Value) {
        criticalStrapDeltas.push({
          brand: v2.brand,
          canonicalName: v2.canonicalName,
          feature,
          v1Value,
          v2Value,
        });
      }
    }
  }

  return { criticalStrapDeltas };
}

export async function runVerificationPilotV2(input: {
  families: ModelFamily[];
  products: AnalyzedProduct[];
  lockedModelFamilyIds: string[];
  v1LiveReport?: VerificationPilotReport | null;
  forceOffline?: boolean;
}): Promise<VerificationPilotV2Report> {
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

  const baseReport = buildVerificationPilotReport({
    model: mode === "live" ? "gpt-5.6-terra" : "offline-v2",
    verifierModel: mode === "live" ? "gpt-5.6-terra" : "offline-v2",
    mode,
    products: results,
  });

  const multiStrapProducts = results
    .filter((product) => countActiveStrapFeatures(product.newFeatures).length >= 2)
    .map((product) => ({
      brand: product.brand,
      canonicalName: product.canonicalName,
      productUrl: product.productUrl,
      strapFeatures: Object.fromEntries(
        CRITICAL_STRAP_FEATURES.map((key) => [
          key,
          product.newFeatures[key]?.value ?? "UNKNOWN",
        ]),
      ) as Partial<Record<CriticalStrapFeature, TriState>>,
    }));

  const manualAuditProducts = buildManualAuditList(results);

  return {
    ...baseReport,
    version: "v2",
    summary: {
      ...baseReport.summary,
      radarEligibleCriticalStrapFeatureCount: results.reduce(
        (sum, product) => sum + countRadarEligibleCriticalStraps(product),
        0,
      ),
      multiStrapProductCount: multiStrapProducts.length,
      manualAuditProductCount: manualAuditProducts.length,
    },
    products: results,
    ankleStrapAudit: buildAnkleStrapAudit(results),
    slingbackYesProducts: buildStrapYesSummaries(results, "slingback"),
    thongYesProducts: buildStrapYesSummaries(results, "thong"),
    multiStrapProducts,
    manualAuditProducts,
    v1LiveComparison: compareWithV1Live(results, input.v1LiveReport ?? null),
    ...(apiFailures.length > 0 ? { apiFailures } : {}),
  };
}
