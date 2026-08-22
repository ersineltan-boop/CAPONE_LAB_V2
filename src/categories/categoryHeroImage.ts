import type { ModelFamily } from "../modelFamily/types";
import { isValidImageUrl } from "../modelFamily/productImages";

export function selectCategoryHeroImage(families: ModelFamily[]): string | null {
  const candidates = families
    .map((family) => family.representativeImage)
    .filter((url): url is string => isValidImageUrl(url));

  if (candidates.length === 0) return null;

  const scored = families
    .filter((family) => isValidImageUrl(family.representativeImage))
    .map((family) => ({
      url: family.representativeImage as string,
      score:
        (family.representativeImages?.length ?? 0) +
        (family.variantCount > 1 ? 1 : 0) +
        (family.groupingConfidence === "HIGH" ? 2 : 0),
    }))
    .sort((a, b) => b.score - a.score);

  return scored[0]?.url ?? candidates[0] ?? null;
}
