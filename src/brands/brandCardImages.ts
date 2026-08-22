import type { ModelFamily } from "../modelFamily/types";
import { imageDedupeKey, normalizeProductImageUrls } from "../images/resolveImageQuality";
import { collectModelFamilyImages } from "../modelFamily/familyImages";

const MAX_CARD_IMAGES = 3;

export function selectBrandCardImages(
  families: ModelFamily[],
  maxImages = MAX_CARD_IMAGES,
): string[] {
  const selected: string[] = [];
  const seen = new Set<string>();

  const ranked = [...families].sort((a, b) => {
    const aCount = collectModelFamilyImages(a).length;
    const bCount = collectModelFamilyImages(b).length;
    return bCount - aCount;
  });

  for (const family of ranked) {
    const images = normalizeProductImageUrls(collectModelFamilyImages(family));
    const next = images[0];
    if (!next) continue;
    const key = imageDedupeKey(next);
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push(next);
    if (selected.length >= maxImages) break;
  }

  if (selected.length < maxImages) {
    for (const family of ranked) {
      for (const image of normalizeProductImageUrls(collectModelFamilyImages(family))) {
        const key = imageDedupeKey(image);
        if (seen.has(key)) continue;
        seen.add(key);
        selected.push(image);
        if (selected.length >= maxImages) break;
      }
      if (selected.length >= maxImages) break;
    }
  }

  return selected;
}

export function brandCardLayout(imageCount: number): "one" | "two" | "three" {
  if (imageCount >= 3) return "three";
  if (imageCount === 2) return "two";
  return "one";
}
