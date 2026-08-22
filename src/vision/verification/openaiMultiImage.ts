import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { extractTextFromOutput } from "../diagnoseResponse";
import { getVisionModel, requireApiKey } from "../openaiVision";
import {
  MULTI_IMAGE_VISION_SYSTEM_PROMPT,
  MULTI_IMAGE_VISION_USER_PROMPT,
  VERIFIER_SYSTEM_PROMPT,
} from "./featureDefinitions";
import { parsedVisionToFeatureMap } from "./offlineAnalyzer";
import type { MultiImageAnalysisInput, VerifierBatchInput } from "./types";
import type { VisualFeatureMap } from "./types";
import {
  multiImageVisionSchema,
  verifierBatchSchema,
  type MultiImageVisionParsed,
  type VerifierBatchParsed,
} from "./verificationSchema";

export function hasVisionApiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function analyzeMultiImageLive(
  input: MultiImageAnalysisInput,
): Promise<VisualFeatureMap> {
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
        content: [{ type: "input_text", text: MULTI_IMAGE_VISION_SYSTEM_PROMPT }],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `${MULTI_IMAGE_VISION_USER_PROMPT}\nProduct: ${input.productName}\nBrand: ${input.brand}\nCategory hint: ${input.category ?? "unknown"}`,
          },
          ...imageContent,
        ],
      },
    ],
    text: {
      format: zodTextFormat(multiImageVisionSchema, "multi_image_footwear_vision"),
    },
  });

  if (response.error) {
    throw new Error(response.error.message ?? "OpenAI multi-image error");
  }

  const parsed =
    (response.output_parsed as MultiImageVisionParsed | null) ??
    JSON.parse(extractTextFromOutput(response) ?? "{}");

  return parsedVisionToFeatureMap(multiImageVisionSchema.parse(parsed));
}

export async function verifyFeaturesLive(
  input: VerifierBatchInput,
): Promise<VerifierBatchParsed> {
  const apiKey = requireApiKey();
  const model = getVisionModel();
  const client = new OpenAI({ apiKey });

  const featureList = input.features
    .map(
      (feature, index) =>
        `${index + 1}. ${feature.feature}=${feature.value} (${feature.confidence}%) — ${feature.reasoningShort}`,
    )
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
        content: [{ type: "input_text", text: VERIFIER_SYSTEM_PROMPT }],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Product: ${input.productName}\nBrand: ${input.brand}\nVerify these initial YES features:\n${featureList}`,
          },
          ...imageContent,
        ],
      },
    ],
    text: {
      format: zodTextFormat(verifierBatchSchema, "feature_verifier_batch"),
    },
  });

  if (response.error) {
    throw new Error(response.error.message ?? "OpenAI verifier error");
  }

  const parsed =
    (response.output_parsed as VerifierBatchParsed | null) ??
    JSON.parse(extractTextFromOutput(response) ?? '{"decisions":[]}');

  return verifierBatchSchema.parse(parsed);
}
