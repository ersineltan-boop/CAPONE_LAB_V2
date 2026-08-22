import type { AnalyzedProduct } from "../types/marketAnalysis";
import type { VisionProductRecord } from "../vision/types";
import { LOW_CONFIDENCE_THRESHOLD } from "../vision/types";
import type {
  AnalysisCoverage,
  FieldConfidence,
  NormalizedProductInsight,
  SourceOfTruth,
} from "./types";

function visionUsable(record: VisionProductRecord | null | undefined): boolean {
  return Boolean(record && !record.error);
}

function scoredValueUsable(
  value: string,
  confidence: number,
  threshold = LOW_CONFIDENCE_THRESHOLD,
): boolean {
  return value !== "UNKNOWN" && confidence >= threshold;
}

function pickSingleValue(
  visionField: { value: string; confidence: number } | undefined,
  textValue: string | null | undefined,
  threshold = LOW_CONFIDENCE_THRESHOLD,
): { value: string | null; source: "text" | "vision" | "none"; confidence: number | null } {
  if (
    visionField &&
    scoredValueUsable(visionField.value, visionField.confidence, threshold)
  ) {
    return {
      value: visionField.value,
      source: "vision",
      confidence: visionField.confidence,
    };
  }

  const text = textValue && textValue !== "UNKNOWN" ? textValue : null;
  if (text) {
    return { value: text, source: "text", confidence: null };
  }

  if (visionField && visionField.value !== "UNKNOWN") {
    return {
      value: visionField.value,
      source: "vision",
      confidence: visionField.confidence,
    };
  }

  return { value: null, source: "none", confidence: null };
}

function pickTagArray(
  visionTags: Array<{ tag: string; confidence: number }> | undefined,
  textTags: string[] | undefined,
  threshold = LOW_CONFIDENCE_THRESHOLD,
): { values: string[]; source: "text" | "vision" | "none" } {
  const visionHigh = (visionTags ?? []).filter(
    (t) => t.confidence >= threshold,
  );

  if (visionHigh.length > 0) {
    return {
      values: visionHigh.map((t) => t.tag),
      source: "vision",
    };
  }

  if (textTags && textTags.length > 0) {
    return { values: textTags, source: "text" };
  }

  const visionAny = (visionTags ?? [])
    .filter((t) => t.tag)
    .map((t) => t.tag);

  if (visionAny.length > 0) {
    return { values: visionAny, source: "vision" };
  }

  return { values: [], source: "none" };
}

function averageConfidence(tags: Array<{ confidence: number }>): number | null {
  if (tags.length === 0) return null;
  const sum = tags.reduce((acc, t) => acc + t.confidence, 0);
  return sum / tags.length;
}

export function mergeProductInsight(
  textProduct: AnalyzedProduct,
  visionRecord: VisionProductRecord | null | undefined,
): NormalizedProductInsight {
  const vision = visionUsable(visionRecord) ? visionRecord!.vision : null;

  const color = textProduct.cleaned.color ?? textProduct.color;
  const material = textProduct.material;

  const toe = pickSingleValue(
    vision?.toeShape,
    textProduct.normalized.toeShape,
  );
  const heel = pickSingleValue(
    vision?.heelType,
    textProduct.normalized.heelType,
  );
  const details = pickTagArray(vision?.details, textProduct.normalized.details);
  const construction = pickTagArray(
    vision?.construction,
    textProduct.normalized.construction,
  );

  const surfaceVision = vision?.surfaceEffects ?? [];
  const surfaceHigh = surfaceVision.filter(
    (s) => s.confidence >= LOW_CONFIDENCE_THRESHOLD,
  );
  const surfaceEffects =
    surfaceHigh.length > 0
      ? surfaceHigh.map((s) => s.tag)
      : surfaceVision.map((s) => s.tag);

  const confidence: FieldConfidence = {
    toeShape: toe.confidence,
    heelType: heel.confidence,
    details: averageConfidence(
      (vision?.details ?? []).filter((d) => details.values.includes(d.tag)),
    ),
    construction: averageConfidence(
      (vision?.construction ?? []).filter((c) =>
        construction.values.includes(c.tag),
      ),
    ),
    surfaceEffects: averageConfidence(
      surfaceVision.filter((s) => surfaceEffects.includes(s.tag)),
    ),
  };

  const sourceOfTruth: SourceOfTruth = {
    color: "text",
    material: "text",
    category: "text",
    toeShape: toe.source,
    heelType: heel.source,
    details: details.source,
    construction: construction.source,
    surfaceEffects:
      surfaceEffects.length > 0 && vision ? "vision" : "none",
  };

  const analysisCoverage: AnalysisCoverage = {
    text: true,
    vision: Boolean(vision),
  };

  return {
    brand: textProduct.brand,
    productName: textProduct.productName,
    productUrl: textProduct.productUrl,
    imageUrl: textProduct.imageUrl,
    category: textProduct.normalized.category ?? textProduct.category,
    color,
    material,
    toeShape: toe.value,
    heelType: heel.value,
    details: details.values,
    construction: construction.values,
    surfaceEffects,
    confidence,
    analysisCoverage,
    sourceOfTruth,
  };
}

export function mergeAllProductInsights(
  textProducts: AnalyzedProduct[],
  visionRecords: VisionProductRecord[],
): NormalizedProductInsight[] {
  const visionByUrl = new Map(
    visionRecords.filter((r) => !r.error).map((r) => [r.productUrl, r]),
  );

  return textProducts.map((product) =>
    mergeProductInsight(product, visionByUrl.get(product.productUrl)),
  );
}
