import type { ModelFamily } from "../modelFamily/types";
import { normalizeProductImageUrls } from "../images/resolveImageQuality";
import { resolveVisualBasicCategory } from "../visual/basicCategories";
import { MAX_DELIVERY_IMAGES, MAX_VARIANT_IMAGES } from "./types";

export function slimFamilyForDelivery(family: ModelFamily): ModelFamily {
  const images = normalizeProductImageUrls([
    family.representativeImage,
    ...family.representativeImages,
  ]).slice(0, MAX_DELIVERY_IMAGES);

  return {
    modelFamilyId: family.modelFamilyId,
    brand: family.brand,
    canonicalName: family.canonicalName,
    category: family.category,
    primaryCategory: family.primaryCategory,
    modelFamilyFirstSeenAt: family.modelFamilyFirstSeenAt,
    sourceSightings: family.sourceSightings,
    representativeProductId: family.representativeProductId,
    representativeImage: images[0] ?? family.representativeImage,
    representativeImages: images,
    variantCount: family.variantCount,
    variants: family.variants.map((variant) => ({
      ...variant,
      images: normalizeProductImageUrls(variant.images ?? []).slice(0, MAX_VARIANT_IMAGES),
    })),
    allImages: images,
    sourceProductIds: family.sourceProductIds,
    sourceCategoryRefs: family.sourceCategoryRefs,
    basicCategory: resolveVisualBasicCategory(family),
    groupingConfidence: family.groupingConfidence,
    groupingReason: family.groupingReason,
  };
}
