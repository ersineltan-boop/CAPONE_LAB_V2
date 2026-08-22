import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { extractTextFromOutput } from "../../vision/diagnoseResponse";
import { getVisionModel, requireApiKey } from "../../vision/openaiVision";
import { hasVisionApiKey } from "../../vision/verification/openaiMultiImage";
import type { ModelFamily } from "../../modelFamily/types";
import { selectAnalysisImages } from "../../modelFamily/familyImages";
import { imageUrlFingerprint } from "../../modelFamily/familyImages";
import { TAXONOMY_VISION_PROMPT_VERSION } from "./constants";
import { TAXONOMY_VISION_SYSTEM_PROMPT, TAXONOMY_VISION_USER_PROMPT } from "./prompts";
import {
  taxonomyVisionResponseSchema,
  type TaxonomyVisionProposal,
} from "./schema";

export { hasVisionApiKey };

export interface AnalyzeFamilyVisionInput {
  family: ModelFamily;
  imageUrls?: string[];
}

export interface AnalyzeFamilyVisionResult {
  proposals: TaxonomyVisionProposal[];
  imageUrls: string[];
  imageFingerprint: string;
  promptVersion: string;
  model: string;
  provider: "openai";
}

export async function analyzeFamilyVisionLive(
  input: AnalyzeFamilyVisionInput,
): Promise<AnalyzeFamilyVisionResult> {
  const apiKey = requireApiKey();
  const model = getVisionModel();
  const client = new OpenAI({ apiKey });
  const imageUrls = input.imageUrls ?? selectAnalysisImages(input.family, 3);
  const imageFingerprint = imageUrlFingerprint(imageUrls);

  const imageContent = imageUrls.map((url) => ({
    type: "input_image" as const,
    image_url: url,
    detail: "auto" as const,
  }));

  const category =
    input.family.primaryCategory ?? input.family.taxonomy?.primaryCategory ?? "UNCLASSIFIED";

  const response = await client.responses.parse({
    model,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: TAXONOMY_VISION_SYSTEM_PROMPT }],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `${TAXONOMY_VISION_USER_PROMPT}\nBrand: ${input.family.brand}\nProduct: ${input.family.canonicalName}\nCategory: ${category}`,
          },
          ...imageContent,
        ],
      },
    ],
    text: {
      format: zodTextFormat(taxonomyVisionResponseSchema, "taxonomy_vision_enrichment"),
    },
  });

  if (response.error) {
    throw new Error(response.error.message ?? "OpenAI taxonomy vision error");
  }

  const parsed =
    response.output_parsed ??
    taxonomyVisionResponseSchema.parse(JSON.parse(extractTextFromOutput(response) ?? "{}"));

  return {
    proposals: parsed.proposals,
    imageUrls,
    imageFingerprint,
    promptVersion: TAXONOMY_VISION_PROMPT_VERSION,
    model,
    provider: "openai",
  };
}
