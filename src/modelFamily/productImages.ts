import type { RawAnalyzedProduct } from "./types";
import {
  imageDedupeKey,
  isValidImageUrl,
  normalizeProductImageUrls,
} from "../images/resolveImageQuality";

export { imageDedupeKey, isValidImageUrl, normalizeProductImageUrls };

export function resolveProductImageUrls(
  product: Pick<RawAnalyzedProduct, "productUrl" | "imageUrl" | "images">,
  productImageGalleries?: Record<string, string[]>,
): string[] {
  const gallery =
    product.images ??
    productImageGalleries?.[product.productUrl] ??
    [];

  return normalizeProductImageUrls([product.imageUrl, ...gallery]);
}

export function buildRepresentativeImages(
  representative: Pick<RawAnalyzedProduct, "productUrl" | "imageUrl" | "images">,
  productImageGalleries?: Record<string, string[]>,
): string[] {
  const gallery = resolveProductImageUrls(representative, productImageGalleries);
  const hero = representative.imageUrl;

  if (!isValidImageUrl(hero)) {
    return gallery;
  }

  const resolvedHero = normalizeProductImageUrls([hero])[0] ?? hero;
  const heroKey = imageDedupeKey(resolvedHero);
  const rest = gallery.filter((url) => imageDedupeKey(url) !== heroKey);
  return normalizeProductImageUrls([resolvedHero, ...rest]);
}
