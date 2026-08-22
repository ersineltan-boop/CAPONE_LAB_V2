import type { ModelFamily, ModelFamilyVariant } from "./types";
import { collectModelFamilyImages } from "./familyImages";
import { normalizeProductImageUrls } from "../images/resolveImageQuality";

export interface ColorVariantView {
  id: string;
  color: string | null;
  thumbnail: string | null;
  images: string[];
  url: string | null;
}

function variantKey(variant: ModelFamilyVariant): string {
  const thumb = variant.images[0] ?? "";
  const color = (variant.color ?? "").trim().toLowerCase();
  return `${variant.productId}|${color}|${thumb}`;
}

export function colorVariantsForFamily(family: ModelFamily): ColorVariantView[] {
  const members = family.variants ?? [];
  if (members.length <= 1) return [];

  const seen = new Set<string>();
  const views: ColorVariantView[] = [];

  for (const variant of members) {
    const images = normalizeProductImageUrls(variant.images ?? []);
    const color = variant.color?.trim() ? variant.color.trim() : null;
    const fingerprint = `${color ?? ""}|${images[0] ?? ""}|${variant.url}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    const id = variant.productId || variant.url || variantKey(variant);
    views.push({
      id,
      color,
      thumbnail: images[0] ?? null,
      images,
      url: variant.url || variant.productId || null,
    });
  }

  return views.length > 1 ? views : [];
}

export function imagesForColorVariant(
  family: ModelFamily,
  variantId: string | null,
): string[] {
  const variants = colorVariantsForFamily(family);
  const selected = variantId ? variants.find((item) => item.id === variantId) : null;
  if (selected && selected.images.length > 0) return selected.images;
  return collectModelFamilyImages(family);
}

export function urlForColorVariant(
  family: ModelFamily,
  variantId: string | null,
): string | null {
  const variants = colorVariantsForFamily(family);
  const selected = variantId ? variants.find((item) => item.id === variantId) : null;
  if (selected?.url) return selected.url;
  return family.representativeProductId ?? family.sourceProductIds[0] ?? null;
}
