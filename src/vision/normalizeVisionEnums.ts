import {
  VISION_CONSTRUCTIONS,
  VISION_DETAILS,
  VISION_HEEL_TYPES,
  VISION_SURFACE_EFFECTS,
  VISION_TOE_SHAPES,
  type VisionConstruction,
  type VisionDetail,
  type VisionHeelType,
  type VisionSurfaceEffect,
  type VisionToeShape,
} from "./types";

const HEEL_TYPE_ALIASES: Record<string, VisionHeelType> = {
  STILETTTO: "STILETTO",
};

export function normalizeHeelTypeValue(value: string): VisionHeelType {
  const fixed = HEEL_TYPE_ALIASES[value] ?? value;
  if ((VISION_HEEL_TYPES as readonly string[]).includes(fixed)) {
    return fixed as VisionHeelType;
  }
  return "UNKNOWN";
}

export function normalizeToeShapeValue(value: string): VisionToeShape {
  if ((VISION_TOE_SHAPES as readonly string[]).includes(value)) {
    return value as VisionToeShape;
  }
  return "UNKNOWN";
}

export function normalizeDetailTag(value: string): VisionDetail | null {
  if ((VISION_DETAILS as readonly string[]).includes(value)) {
    return value as VisionDetail;
  }
  return null;
}

export function normalizeConstructionTag(value: string): VisionConstruction | null {
  if ((VISION_CONSTRUCTIONS as readonly string[]).includes(value)) {
    return value as VisionConstruction;
  }
  return null;
}

export function normalizeSurfaceEffectTag(value: string): VisionSurfaceEffect | null {
  if ((VISION_SURFACE_EFFECTS as readonly string[]).includes(value)) {
    return value as VisionSurfaceEffect;
  }
  return null;
}

export function normalizeRawVision(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;

  const data = raw as Record<string, unknown>;

  const toeShape =
    data.toeShape && typeof data.toeShape === "object"
      ? {
          ...(data.toeShape as Record<string, unknown>),
          value: normalizeToeShapeValue(
            String((data.toeShape as Record<string, unknown>).value ?? "UNKNOWN"),
          ),
        }
      : data.toeShape;

  const heelType =
    data.heelType && typeof data.heelType === "object"
      ? {
          ...(data.heelType as Record<string, unknown>),
          value: normalizeHeelTypeValue(
            String((data.heelType as Record<string, unknown>).value ?? "UNKNOWN"),
          ),
        }
      : data.heelType;

  const details = Array.isArray(data.details)
    ? data.details
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const tag = normalizeDetailTag(String((item as Record<string, unknown>).tag ?? ""));
          if (!tag) return null;
          return { ...item, tag };
        })
        .filter(Boolean)
    : data.details;

  const construction = Array.isArray(data.construction)
    ? data.construction
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const tag = normalizeConstructionTag(
            String((item as Record<string, unknown>).tag ?? ""),
          );
          if (!tag) return null;
          return { ...item, tag };
        })
        .filter(Boolean)
    : data.construction;

  const surfaceEffects = Array.isArray(data.surfaceEffects)
    ? data.surfaceEffects
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const tag = normalizeSurfaceEffectTag(
            String((item as Record<string, unknown>).tag ?? ""),
          );
          if (!tag) return null;
          return { ...item, tag };
        })
        .filter(Boolean)
    : data.surfaceEffects;

  return {
    ...data,
    toeShape,
    heelType,
    details,
    construction,
    surfaceEffects,
  };
}
