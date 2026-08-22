import { combineText } from "../cleanText";
import type { ToeShapeNormalized } from "../types";

export function normalizeToeShape(
  toeShape: string | null,
  material: string | null,
  productName: string,
): ToeShapeNormalized {
  const text = combineText([toeShape, material, productName]);

  if (/\bpointed toe\b|\bpoint toe\b/.test(text)) return "POINTED";
  if (/\bsquare toe\b/.test(text)) return "SQUARE";
  if (/\bround toe\b|\btoe-shape:\s*round\b/.test(text)) return "ROUND";
  if (/\bopen toe\b/.test(text)) return "OPEN";

  return "UNKNOWN";
}
