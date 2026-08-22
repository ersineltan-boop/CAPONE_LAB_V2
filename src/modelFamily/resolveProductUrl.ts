import type { ModelFamily } from "./types";

function isValidProductUrl(url: string | null | undefined): url is string {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Resolve the best external product page URL for a Model Family.
 * Priority: representative product URL → variant URL → null (never invented).
 */
export function resolveModelFamilyProductUrl(family: ModelFamily): string | null {
  if (isValidProductUrl(family.representativeProductId)) {
    return family.representativeProductId.trim();
  }

  for (const variant of family.variants) {
    if (isValidProductUrl(variant.url)) return variant.url.trim();
  }

  for (const productId of family.sourceProductIds) {
    if (isValidProductUrl(productId)) return productId.trim();
  }

  return null;
}
