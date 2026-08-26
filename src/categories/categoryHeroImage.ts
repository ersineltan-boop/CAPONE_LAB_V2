import type { ModelFamily } from "../modelFamily/types";
import { pickBestCoverImage, scoreCoverImageUrl } from "../images/coverImageScore";
import { normalizeProductImageUrls } from "../images/resolveImageQuality";
import { collectModelFamilyImages } from "../modelFamily/familyImages";
import { isValidImageUrl } from "../modelFamily/productImages";

export function selectCategoryHeroImage(families: ModelFamily[]): string | null {
  const scored = families
    .map((family) => {
      const images = normalizeProductImageUrls(collectModelFamilyImages(family)).filter(
        (url) => isValidImageUrl(url),
      );
      const url = pickBestCoverImage(images);
      return url
        ? {
            url,
            score:
              scoreCoverImageUrl(url) +
              (family.variantCount > 1 ? 1 : 0) +
              (family.groupingConfidence === "HIGH" ? 2 : 0),
          }
        : null;
    })
    .filter((item): item is { url: string; score: number } => Boolean(item))
    .sort((a, b) => b.score - a.score);

  return scored[0]?.url ?? null;
}
