import type {
  AnalyzedProductInput,
  TagSummary,
  VisionFields,
  VisionProductRecord,
} from "./types";
import { LOW_CONFIDENCE_THRESHOLD } from "./types";

export function summarizeTags(
  records: VisionProductRecord[],
  getTags: (vision: VisionFields) => Array<{ tag: string; confidence: number }>,
  minConfidence = LOW_CONFIDENCE_THRESHOLD,
): TagSummary[] {
  const map = new Map<string, { brands: Set<string>; count: number }>();

  for (const record of records) {
    if (record.error) continue;
    const tags = getTags(record.vision).filter((t) => t.confidence >= minConfidence);
    const uniqueTags = new Set(tags.map((t) => t.tag));

    for (const tag of uniqueTags) {
      if (!map.has(tag)) map.set(tag, { brands: new Set(), count: 0 });
      const entry = map.get(tag)!;
      entry.count += 1;
      entry.brands.add(record.brand);
    }
  }

  return [...map.entries()]
    .map(([tag, data]) => ({
      tag,
      productCount: data.count,
      brandCount: data.brands.size,
      brands: [...data.brands].sort(),
    }))
    .sort((a, b) => b.productCount - a.productCount || a.tag.localeCompare(b.tag));
}

export function countUnknownToe(
  products: AnalyzedProductInput[],
  records: VisionProductRecord[],
): { before: number; after: number } {
  const recordByUrl = new Map(records.map((r) => [r.productUrl, r]));
  let before = 0;
  let after = 0;

  for (const product of products) {
    const textUnknown = (product.normalized?.toeShape ?? "UNKNOWN") === "UNKNOWN";
    if (!textUnknown) continue;

    before += 1;
    const vision = recordByUrl.get(product.productUrl);
    if (!vision || vision.error) {
      after += 1;
      continue;
    }
    if (vision.vision.toeShape.value === "UNKNOWN") after += 1;
  }

  return { before, after };
}

export function productsWithLowConfidence(
  records: VisionProductRecord[],
): Set<string> {
  const urls = new Set<string>();

  for (const record of records) {
    if (record.error) continue;
    const v = record.vision;
    const low =
      v.toeShape.confidence < LOW_CONFIDENCE_THRESHOLD ||
      v.heelType.confidence < LOW_CONFIDENCE_THRESHOLD ||
      v.details.some((d) => d.confidence < LOW_CONFIDENCE_THRESHOLD) ||
      v.construction.some((c) => c.confidence < LOW_CONFIDENCE_THRESHOLD) ||
      v.surfaceEffects.some((s) => s.confidence < LOW_CONFIDENCE_THRESHOLD);

    if (low) urls.add(record.productUrl);
  }

  return urls;
}
