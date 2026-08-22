import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { extractTextFromOutput } from "../diagnoseResponse";
import { getVisionModel, requireApiKey } from "../openaiVision";
import {
  MULTI_IMAGE_VISION_V2_SYSTEM_PROMPT,
  MULTI_IMAGE_VISION_V2_USER_PROMPT,
  VERIFIER_V2_LOCATION_PROMPTS,
  VERIFIER_V2_SYSTEM_PROMPT,
} from "./featureDefinitionsV2";
import { detectFeatureContradictions } from "./contradictionRules";
import { finalizeFeatureResult } from "./radarEligibility";
import {
  mergeTopologyStrapFeatures,
  refreshAllStrapEligibility,
} from "./strapTopology";
import type {
  MultiImageAnalysisInput,
  StrapElement,
  VerifierBatchInput,
  VisualFeatureKey,
  VisualFeatureMap,
} from "./types";
import {
  multiImageVisionV2Schema,
  verifierBatchV2Schema,
  type MultiImageVisionV2Parsed,
  type VerifierBatchV2Parsed,
} from "./verificationSchemaV2";

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

export function parsedVisionV2ToFeatureMap(parsed: MultiImageVisionV2Parsed): {
  features: VisualFeatureMap;
  strapElements: StrapElement[];
} {
  const features: VisualFeatureMap = {};

  for (const key of FEATURE_KEYS) {
    const raw = parsed[key as keyof MultiImageVisionV2Parsed];
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

  const strapElements: StrapElement[] = parsed.strapElements.map((element) => ({
    type: element.type,
    location: element.location,
    wrapsAround: element.wrapsAround,
    closure: element.closure,
    confidence: element.confidence,
    evidenceImageIndexes: element.evidenceImageIndexes,
  }));

  const merged = mergeTopologyStrapFeatures(features, strapElements);
  detectFeatureContradictions(merged);
  const refreshed = refreshAllStrapEligibility(merged, strapElements);

  return { features: refreshed, strapElements };
}

export async function analyzeMultiImageLiveV2(
  input: MultiImageAnalysisInput,
): Promise<{ features: VisualFeatureMap; strapElements: StrapElement[] }> {
  const apiKey = requireApiKey();
  const model = getVisionModel();
  const client = new OpenAI({ apiKey });

  const imageContent = input.imageUrls.map((url) => ({
    type: "input_image" as const,
    image_url: url,
    detail: "auto" as const,
  }));

  const response = await client.responses.parse({
    model,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: MULTI_IMAGE_VISION_V2_SYSTEM_PROMPT }],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `${MULTI_IMAGE_VISION_V2_USER_PROMPT}\nProduct: ${input.productName}\nBrand: ${input.brand}\nCategory hint: ${input.category ?? "unknown"}\nNote: title is hint only, not evidence.`,
          },
          ...imageContent,
        ],
      },
    ],
    text: {
      format: zodTextFormat(multiImageVisionV2Schema, "multi_image_footwear_vision_v2"),
    },
  });

  if (response.error) {
    throw new Error(response.error.message ?? "OpenAI multi-image V2 error");
  }

  const parsed =
    (response.output_parsed as MultiImageVisionV2Parsed | null) ??
    JSON.parse(extractTextFromOutput(response) ?? "{}");

  return parsedVisionV2ToFeatureMap(multiImageVisionV2Schema.parse(parsed));
}

export async function verifyFeaturesLiveV2(
  input: VerifierBatchInput,
): Promise<VerifierBatchV2Parsed> {
  const apiKey = requireApiKey();
  const model = getVisionModel();
  const client = new OpenAI({ apiKey });

  const topologySummary =
    input.strapElements?.map(
      (element, index) =>
        `${index + 1}. ${element.type} @ ${element.location} wraps=${element.wrapsAround} closure=${element.closure} (${element.confidence}%) images=[${element.evidenceImageIndexes.join(",")}]`,
    ).join("\n") ?? "No topology map";

  const featureList = input.features
    .map((feature, index) => {
      const locationPrompt = VERIFIER_V2_LOCATION_PROMPTS[feature.feature] ?? "";
      return `${index + 1}. ${feature.feature}=${feature.value} (${feature.confidence}%) — ${feature.reasoningShort}\n   Verify: ${locationPrompt}`;
    })
    .join("\n");

  const imageContent = input.imageUrls.map((url) => ({
    type: "input_image" as const,
    image_url: url,
    detail: "auto" as const,
  }));

  const response = await client.responses.parse({
    model,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: VERIFIER_V2_SYSTEM_PROMPT }],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Product: ${input.productName}\nBrand: ${input.brand}\n\nStrap topology map:\n${topologySummary}\n\nVerify these initial YES features with anatomical location:\n${featureList}`,
          },
          ...imageContent,
        ],
      },
    ],
    text: {
      format: zodTextFormat(verifierBatchV2Schema, "feature_verifier_batch_v2"),
    },
  });

  if (response.error) {
    throw new Error(response.error.message ?? "OpenAI verifier V2 error");
  }

  const parsed =
    (response.output_parsed as VerifierBatchV2Parsed | null) ??
    JSON.parse(extractTextFromOutput(response) ?? '{"decisions":[]}');

  return verifierBatchV2Schema.parse(parsed);
}

export { hasVisionApiKey } from "./openaiMultiImage";
