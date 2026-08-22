import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { diagnoseResponse, extractTextFromOutput } from "./diagnoseResponse";
import { normalizeRawVision } from "./normalizeVisionEnums";
import { VISION_SYSTEM_PROMPT, VISION_USER_PROMPT } from "./schema";
import type { TokenUsage, VisionFields } from "./types";
import {
  footwearVisionSchema,
  type FootwearVisionParsed,
} from "./visionSchema";

export interface VisionApiResult {
  vision: VisionFields;
  usage: TokenUsage;
}

function clampConfidence(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function sanitizeVision(raw: FootwearVisionParsed): VisionFields {
  const validated = footwearVisionSchema.parse(normalizeRawVision(raw));

  return {
    toeShape: {
      value: validated.toeShape.value,
      confidence: clampConfidence(validated.toeShape.confidence),
    },
    heelType: {
      value: validated.heelType.value,
      confidence: clampConfidence(validated.heelType.confidence),
    },
    details: validated.details.map((d) => ({
      tag: d.tag,
      confidence: clampConfidence(d.confidence),
    })),
    construction: validated.construction.map((c) => ({
      tag: c.tag,
      confidence: clampConfidence(c.confidence),
    })),
    surfaceEffects: validated.surfaceEffects.map((s) => ({
      tag: s.tag,
      confidence: clampConfidence(s.confidence),
    })),
  };
}

export function parseVisionResponse(text: string): VisionFields {
  const raw = normalizeRawVision(JSON.parse(text));
  const parsed = footwearVisionSchema.parse(raw);
  return sanitizeVision(parsed);
}

function mapUsage(usage: OpenAI.Responses.ResponseUsage | undefined): TokenUsage {
  return {
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
  };
}

function resolveParsedVision(response: OpenAI.Responses.Response): VisionFields {
  if (response.output_parsed) {
    return sanitizeVision(response.output_parsed as FootwearVisionParsed);
  }

  const fallbackText = extractTextFromOutput(response);
  if (fallbackText) {
    return parseVisionResponse(fallbackText);
  }

  const diagnostic = diagnoseResponse(response);
  throw new Error(`OpenAI structured output missing output_parsed (${diagnostic})`);
}

export async function analyzeProductImage(
  imageUrl: string,
  apiKey: string,
  model: string,
): Promise<VisionApiResult> {
  const client = new OpenAI({ apiKey });

  const response = await client.responses.parse({
    model,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: VISION_SYSTEM_PROMPT }],
      },
      {
        role: "user",
        content: [
          { type: "input_text", text: VISION_USER_PROMPT },
          { type: "input_image", image_url: imageUrl, detail: "auto" },
        ],
      },
    ],
    text: {
      format: zodTextFormat(footwearVisionSchema, "footwear_vision_analysis"),
    },
  });

  if (response.error) {
    throw new Error(response.error.message ?? "OpenAI response error");
  }

  const vision = resolveParsedVision(response);

  return {
    vision,
    usage: mapUsage(response.usage),
  };
}

export function getVisionModel(): string {
  return process.env.OPENAI_VISION_MODEL?.trim() || "gpt-5.6-terra";
}

export function requireApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is missing. Set it in your environment before running vision analysis.",
    );
  }
  return apiKey;
}

export function mergeUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

export const emptyUsage = (): TokenUsage => ({
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
});

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
