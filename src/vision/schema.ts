import {
  VISION_CONSTRUCTIONS,
  VISION_DETAILS,
  VISION_HEEL_TYPES,
  VISION_SURFACE_EFFECTS,
  VISION_TOE_SHAPES,
} from "./types";

export const FOOTWEAR_VISION_JSON_SCHEMA = {
  type: "object",
  properties: {
    toeShape: {
      type: "object",
      properties: {
        value: { type: "string", enum: [...VISION_TOE_SHAPES] },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
      required: ["value", "confidence"],
      additionalProperties: false,
    },
    heelType: {
      type: "object",
      properties: {
        value: { type: "string", enum: [...VISION_HEEL_TYPES] },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
      required: ["value", "confidence"],
      additionalProperties: false,
    },
    details: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tag: { type: "string", enum: [...VISION_DETAILS] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["tag", "confidence"],
        additionalProperties: false,
      },
    },
    construction: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tag: { type: "string", enum: [...VISION_CONSTRUCTIONS] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["tag", "confidence"],
        additionalProperties: false,
      },
    },
    surfaceEffects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tag: { type: "string", enum: [...VISION_SURFACE_EFFECTS] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["tag", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["toeShape", "heelType", "details", "construction", "surfaceEffects"],
  additionalProperties: false,
} as const;

export const VISION_SYSTEM_PROMPT = `You analyze women's footwear product photos for CAPONE LAB market intelligence.

Rules:
- Only describe visible footwear attributes in the image.
- If a feature is not clearly visible, use UNKNOWN for single-value fields or leave arrays empty.
- Do not guess brand, model name, price, or color names.
- Do not infer materials unless the surface finish is visually obvious (e.g. patent shine, woven texture).
- Assign confidence 0-1 based on visual clarity.
- Use only the allowed enum values provided in the schema.`;

export const VISION_USER_PROMPT = `Analyze this footwear product image. Return structured JSON for:
- toeShape
- heelType
- details (visible embellishments/elements)
- construction (silhouette/strap structure)
- surfaceEffects (visible surface finishes)

Be conservative. Prefer UNKNOWN or empty arrays over guessing.`;
