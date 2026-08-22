import { z } from "zod";
import {
  VISION_CONSTRUCTIONS,
  VISION_DETAILS,
  VISION_HEEL_TYPES,
  VISION_SURFACE_EFFECTS,
  VISION_TOE_SHAPES,
} from "./types";

function enumTuple<T extends readonly string[]>(values: T) {
  return values as unknown as [T[number], ...T[number][]];
}

const scoredValue = <T extends readonly string[]>(values: T) =>
  z.object({
    value: z.enum(enumTuple(values)),
    confidence: z.number().min(0).max(1),
  });

const scoredTag = <T extends readonly string[]>(values: T) =>
  z.object({
    tag: z.enum(enumTuple(values)),
    confidence: z.number().min(0).max(1),
  });

export const footwearVisionSchema = z.object({
  toeShape: scoredValue(VISION_TOE_SHAPES),
  heelType: scoredValue(VISION_HEEL_TYPES),
  details: z.array(scoredTag(VISION_DETAILS)),
  construction: z.array(scoredTag(VISION_CONSTRUCTIONS)),
  surfaceEffects: z.array(scoredTag(VISION_SURFACE_EFFECTS)),
});

export type FootwearVisionParsed = z.infer<typeof footwearVisionSchema>;
