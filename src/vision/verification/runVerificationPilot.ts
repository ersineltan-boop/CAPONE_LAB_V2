import { getVisionModel } from "../openaiVision";
import { buildVerificationPilotReport } from "./buildVerificationReport";
import { collectRadarEligibleFeatureKeys } from "./buildVerificationReport";
import { VISION_VERIFICATION_THRESHOLDS } from "./config";
import {
  extractOldFeaturesFromText,
  listChangedFeatures,
} from "./extractOldFeatures";
import {
  analyzeMultiImageOffline,
  collectVerifierCandidates,
  runOfflineVerifier,
} from "./offlineAnalyzer";
import {
  analyzeMultiImageLive,
  hasVisionApiKey,
  verifyFeaturesLive,
} from "./openaiMultiImage";
import { applyVerifierToFeature } from "./radarEligibility";
import { selectVerificationPilotFamilies } from "./selectPilotFamilies";
import type {
  VerificationPilotProductResult,
  VerifierDecision,
  VisualFeatureKey,
  VisualFeatureMap,
} from "./types";
import type { ModelFamily } from "../../modelFamily/types";
import type { AnalyzedProduct } from "../../types/marketAnalysis";
import { detectFeatureContradictions } from "./contradictionRules";

function cloneFeatures(features: VisualFeatureMap): VisualFeatureMap {
  return structuredClone(features);
}

async function applyLiveVerifier(
  features: VisualFeatureMap,
  input: {
    brand: string;
    productName: string;
    imageUrls: string[];
  },
): Promise<VerifierDecision[]> {
  const candidates = collectVerifierCandidates(features);
  if (candidates.length === 0) return [];

  const batch = await verifyFeaturesLive({
    brand: input.brand,
    productName: input.productName,
    imageUrls: input.imageUrls,
    features: candidates,
  });

  const decisions: VerifierDecision[] = [];

  for (const decision of batch.decisions) {
    const featureKey = decision.feature as VisualFeatureKey;
    const current = features[featureKey];
    if (!current) continue;

    const candidate = candidates.find((item) => item.feature === decision.feature);
    decisions.push({
      feature: featureKey,
      initialValue: candidate?.value ?? current.value,
      initialConfidence: candidate?.confidence ?? current.confidence,
      status: decision.status,
      reasoningShort: decision.reasoningShort,
      evidenceImageIndexes: decision.evidenceImageIndexes,
    });

    features[featureKey] = applyVerifierToFeature(current, decision.status);
  }

  detectFeatureContradictions(features);
  return decisions;
}

async function analyzeFamilyProduct(input: {
  product: AnalyzedProduct;
  imageUrls: string[];
  mode: "live" | "offline";
}): Promise<VisualFeatureMap> {
  if (input.mode === "live") {
    return analyzeMultiImageLive({
      brand: input.product.brand,
      productName: input.product.productName,
      category: input.product.normalized.category ?? input.product.category,
      imageUrls: input.imageUrls,
    });
  }

  return analyzeMultiImageOffline({
    brand: input.product.brand,
    productName: input.product.productName,
    category: input.product.normalized.category ?? input.product.category,
    imageUrls: input.imageUrls,
    textConstruction: input.product.normalized.construction,
    textDetails: input.product.normalized.details,
  });
}

export async function runVerificationPilot(input: {
  families: ModelFamily[];
  products: AnalyzedProduct[];
  forceOffline?: boolean;
}): Promise<ReturnType<typeof buildVerificationPilotReport>> {
  const mode: "live" | "offline" =
    !input.forceOffline && hasVisionApiKey() ? "live" : "offline";

  const selected = selectVerificationPilotFamilies({
    families: input.families,
    products: input.products,
    limit: VISION_VERIFICATION_THRESHOLDS.pilotFamilyCount,
  });

  const productByUrl = new Map(
    input.products.map((product) => [product.productUrl, product]),
  );

  const results: VerificationPilotProductResult[] = [];

  for (const candidate of selected) {
    const product = productByUrl.get(candidate.representativeProductId);
    if (!product) continue;

    const imageUrls = candidate.representativeImages.slice(
      0,
      VISION_VERIFICATION_THRESHOLDS.maxEvidenceImages,
    );
    if (imageUrls.length === 0) continue;

    const oldFeatures = extractOldFeaturesFromText(product);
    const newFeatures = cloneFeatures(
      await analyzeFamilyProduct({ product, imageUrls, mode }),
    );

    const verifierDecisions =
      mode === "live"
        ? await applyLiveVerifier(newFeatures, {
            brand: product.brand,
            productName: product.productName,
            imageUrls,
          })
        : runOfflineVerifier(newFeatures, {
            brand: product.brand,
            productName: product.productName,
            imageUrls,
            features: collectVerifierCandidates(newFeatures),
          });

    const contradictions = detectFeatureContradictions(newFeatures);
    const changedFeatures = listChangedFeatures(oldFeatures, newFeatures);

    results.push({
      brand: candidate.brand,
      modelFamilyId: candidate.modelFamilyId,
      canonicalName: candidate.canonicalName,
      productUrl: product.productUrl,
      productName: product.productName,
      imageCount: imageUrls.length,
      imageUrls,
      oldFeatures,
      newFeatures,
      verifierDecisions,
      changedFeatures,
      contradictions,
      radarEligibleFeatures: collectRadarEligibleFeatureKeys(newFeatures),
    });
  }

  return buildVerificationPilotReport({
    model: getVisionModel(),
    verifierModel: getVisionModel(),
    mode,
    products: results,
  });
}
