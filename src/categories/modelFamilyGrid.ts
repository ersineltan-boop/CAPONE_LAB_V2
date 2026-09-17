import type { ModelFamily } from "../modelFamily/types";
import { collectModelFamilyImages } from "../modelFamily/familyImages";
import { resolveModelFamilyProductUrl } from "../modelFamily/resolveProductUrl";
import { colorVariantsForFamily, type ColorVariantView } from "../modelFamily/colorVariants";
import { buildTaxonomyChips } from "../newArrivals/query";
import type { PrimaryFootwearCategory } from "../taxonomy/types";
import { getFamilyPrimaryCategory } from "./taxonomyFilters";

export interface ModelFamilyGridItem {
  modelFamilyId: string;
  brand: string;
  canonicalName: string;
  primaryCategory: PrimaryFootwearCategory;
  representativeImage: string | null;
  images: string[];
  productUrl: string | null;
  firstSeenAt: string | null;
  sourceLabel: string;
  taxonomyChips: string[];
  sourceCategoryLabel?: string | null;
  priceLabel?: string | null;
  variants?: ColorVariantView[];
}

export function modelFamilyToGridItem(family: ModelFamily): ModelFamilyGridItem {
  const primaryCategory = getFamilyPrimaryCategory(family);
  const source = family.sourceSightings?.[0];
  const images = collectModelFamilyImages(family);
  const priceLabel =
    (family as ModelFamily & { priceLabel?: string | null }).priceLabel ?? null;

  return {
    modelFamilyId: family.modelFamilyId,
    brand: family.brand,
    canonicalName: family.canonicalName,
    primaryCategory,
    representativeImage: family.representativeImage ?? images[0] ?? null,
    images,
    productUrl: resolveModelFamilyProductUrl(family),
    firstSeenAt: family.modelFamilyFirstSeenAt ?? source?.firstSeenAt ?? null,
    sourceLabel: source?.sourceLabel ?? family.brand,
    taxonomyChips: buildTaxonomyChips(family),
    priceLabel,
    variants: colorVariantsForFamily(family),
  };
}

export function modelFamiliesToGridItems(
  families: ModelFamily[],
): ModelFamilyGridItem[] {
  return families.map(modelFamilyToGridItem);
}
