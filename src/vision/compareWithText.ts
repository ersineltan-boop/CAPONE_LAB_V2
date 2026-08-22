import type { AnalyzedProductInput, VisionFields } from "./types";
import { LOW_CONFIDENCE_THRESHOLD } from "./types";
import type { LowConfidenceItem, TextConflict } from "./types";

const TEXT_TO_VISION_TOE: Record<string, string[]> = {
  ROUND: ["ROUND", "ALMOND"],
  POINTED: ["POINTED", "ALMOND"],
  SQUARE: ["SQUARE"],
  OPEN: ["OPEN", "PEEP_TOE"],
};

function textToeShape(product: AnalyzedProductInput): string {
  return product.normalized?.toeShape ?? "UNKNOWN";
}

function textHeelType(product: AnalyzedProductInput): string {
  return product.normalized?.heelType ?? "UNKNOWN";
}

function textDetails(product: AnalyzedProductInput): string[] {
  return product.normalized?.details ?? [];
}

function textConstruction(product: AnalyzedProductInput): string[] {
  return product.normalized?.construction ?? [];
}

function toeShapesCompatible(text: string, vision: string): boolean {
  if (text === "UNKNOWN" || vision === "UNKNOWN") return true;
  const equivalents = TEXT_TO_VISION_TOE[text];
  if (equivalents) return equivalents.includes(vision);
  return text === vision;
}

export function detectConflicts(
  product: AnalyzedProductInput,
  vision: VisionFields,
): TextConflict[] {
  const conflicts: TextConflict[] = [];
  const base = {
    productUrl: product.productUrl,
    brand: product.brand,
    productName: product.productName,
  };

  const textToe = textToeShape(product);
  if (
    textToe !== "UNKNOWN" &&
    vision.toeShape.value !== "UNKNOWN" &&
    !toeShapesCompatible(textToe, vision.toeShape.value)
  ) {
    conflicts.push({
      ...base,
      field: "toeShape",
      textValue: textToe,
      visionValue: vision.toeShape.value,
      visionConfidence: vision.toeShape.confidence,
    });
  }

  const textHeel = textHeelType(product);
  if (
    textHeel !== "UNKNOWN" &&
    vision.heelType.value !== "UNKNOWN" &&
    textHeel !== vision.heelType.value
  ) {
    conflicts.push({
      ...base,
      field: "heelType",
      textValue: textHeel,
      visionValue: vision.heelType.value,
      visionConfidence: vision.heelType.confidence,
    });
  }

  for (const textDetail of textDetails(product)) {
    const visionHasDetail = vision.details.some(
      (d) =>
        d.tag === textDetail && d.confidence >= LOW_CONFIDENCE_THRESHOLD,
    );
    const visionConfident =
      vision.toeShape.confidence >= LOW_CONFIDENCE_THRESHOLD ||
      vision.heelType.confidence >= LOW_CONFIDENCE_THRESHOLD;

    if (!visionHasDetail && visionConfident && vision.details.length > 0) {
      conflicts.push({
        ...base,
        field: `details.${textDetail}`,
        textValue: textDetail,
        visionValue: vision.details.map((d) => d.tag).join(", ") || "none",
        visionConfidence: Math.max(...vision.details.map((d) => d.confidence), 0),
      });
    }
  }

  for (const textItem of textConstruction(product)) {
    const visionHas = vision.construction.some(
      (c) =>
        c.tag === textItem && c.confidence >= LOW_CONFIDENCE_THRESHOLD,
    );
    const visionConfident =
      vision.toeShape.confidence >= LOW_CONFIDENCE_THRESHOLD ||
      vision.heelType.confidence >= LOW_CONFIDENCE_THRESHOLD;

    if (!visionHas && visionConfident && vision.construction.length > 0) {
      conflicts.push({
        ...base,
        field: `construction.${textItem}`,
        textValue: textItem,
        visionValue: vision.construction.map((c) => c.tag).join(", ") || "none",
        visionConfidence: Math.max(
          ...vision.construction.map((c) => c.confidence),
          0,
        ),
      });
    }
  }

  return conflicts;
}

export function collectLowConfidence(
  product: AnalyzedProductInput,
  vision: VisionFields,
): LowConfidenceItem[] {
  const items: LowConfidenceItem[] = [];
  const base = {
    productUrl: product.productUrl,
    brand: product.brand,
    productName: product.productName,
  };

  if (vision.toeShape.confidence < LOW_CONFIDENCE_THRESHOLD) {
    items.push({
      ...base,
      field: "toeShape",
      value: vision.toeShape.value,
      confidence: vision.toeShape.confidence,
    });
  }

  if (vision.heelType.confidence < LOW_CONFIDENCE_THRESHOLD) {
    items.push({
      ...base,
      field: "heelType",
      value: vision.heelType.value,
      confidence: vision.heelType.confidence,
    });
  }

  for (const detail of vision.details) {
    if (detail.confidence < LOW_CONFIDENCE_THRESHOLD) {
      items.push({
        ...base,
        field: `details.${detail.tag}`,
        value: detail.tag,
        confidence: detail.confidence,
      });
    }
  }

  for (const item of vision.construction) {
    if (item.confidence < LOW_CONFIDENCE_THRESHOLD) {
      items.push({
        ...base,
        field: `construction.${item.tag}`,
        value: item.tag,
        confidence: item.confidence,
      });
    }
  }

  for (const effect of vision.surfaceEffects) {
    if (effect.confidence < LOW_CONFIDENCE_THRESHOLD) {
      items.push({
        ...base,
        field: `surfaceEffects.${effect.tag}`,
        value: effect.tag,
        confidence: effect.confidence,
      });
    }
  }

  return items;
}

export function isTextToeUnknown(product: AnalyzedProductInput): boolean {
  return textToeShape(product) === "UNKNOWN";
}

export function isVisionToeKnown(vision: VisionFields): boolean {
  return vision.toeShape.value !== "UNKNOWN";
}

export function newlyDetectedDetailTags(
  product: AnalyzedProductInput,
  vision: VisionFields,
): string[] {
  const textTags = new Set(textDetails(product));
  return vision.details
    .filter(
      (d) =>
        d.confidence >= LOW_CONFIDENCE_THRESHOLD && !textTags.has(d.tag),
    )
    .map((d) => d.tag);
}
