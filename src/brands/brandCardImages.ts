import type { ModelFamily } from "../modelFamily/types";
import { pickBestCoverImage, scoreCoverImageUrl } from "../images/coverImageScore";
import { imageDedupeKey, normalizeProductImageUrls } from "../images/resolveImageQuality";
import { collectModelFamilyImages } from "../modelFamily/familyImages";

/** Index cards use a single strongest footwear hero — avoid collage crop. */
const MAX_CARD_IMAGES = 1;

function familyCoverCandidate(family: ModelFamily): string | null {
  const images = normalizeProductImageUrls(collectModelFamilyImages(family));
  return pickBestCoverImage(images);
}

export function selectBrandCardImages(
  families: ModelFamily[],
  maxImages = MAX_CARD_IMAGES,
): string[] {
  const selected: string[] = [];
  const seen = new Set<string>();

  const ranked = [...families]
    .map((family) => {
      const cover = familyCoverCandidate(family);
      return {
        family,
        cover,
        score: cover ? scoreCoverImageUrl(cover) : -100,
      };
    })
    .filter((item) => item.cover)
    .sort((a, b) => b.score - a.score);

  for (const item of ranked) {
    const next = item.cover!;
    const key = imageDedupeKey(next);
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push(next);
    if (selected.length >= maxImages) break;
  }

  return selected;
}

export function brandCardLayout(imageCount: number): "one" | "two" | "three" {
  // Phase 1: index cards always render a single hero. Keep the helper for callers.
  if (imageCount <= 0) return "one";
  return "one";
}
