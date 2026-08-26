import type { ModelFamily } from "../modelFamily/types";
import { pickBestCoverImage, scoreCoverImageUrl } from "../images/coverImageScore";
import { normalizeProductImageUrls } from "../images/resolveImageQuality";
import { resolveVisualBasicCategory } from "../visual/basicCategories";
import { MAX_DELIVERY_IMAGES, MAX_VARIANT_IMAGES } from "./types";

export function slimFamilyForDelivery(family: ModelFamily): ModelFamily {
  const images = normalizeProductImageUrls([
    family.representativeImage,
    ...family.representativeImages,
  ]);
  const ranked = [...images].sort(
    (a, b) => scoreCoverImageUrl(b) - scoreCoverImageUrl(a),
  );
  const cover = pickBestCoverImage(ranked) ?? ranked[0];
  const ordered = cover
    ? [cover, ...ranked.filter((url) => url !== cover)].slice(0, MAX_DELIVERY_IMAGES)
    : ranked.slice(0, MAX_DELIVERY_IMAGES);

  return {
    modelFamilyId: family.modelFamilyId,
    brand: family.brand,
    canonicalName: family.canonicalName,
    category: family.category,
    primaryCategory: family.primaryCategory,
    modelFamilyFirstSeenAt: family.modelFamilyFirstSeenAt,
    sourceSightings: family.sourceSightings,
    representativeProductId: family.representativeProductId,
    representativeImage: ordered[0] ?? family.representativeImage,
    representativeImages: ordered,
    variantCount: family.variantCount,
    variants: family.variants.map((variant) => ({
      ...variant,
      images: normalizeProductImageUrls(variant.images ?? []).slice(0, MAX_VARIANT_IMAGES),
    })),
    allImages: ordered,
    sourceProductIds: family.sourceProductIds,
    sourceCategoryRefs: family.sourceCategoryRefs,
    basicCategory: resolveVisualBasicCategory(family),
    groupingConfidence: family.groupingConfidence,
    groupingReason: family.groupingReason,
  };
}
