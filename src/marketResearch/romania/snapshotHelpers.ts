import type { MarketResearchVariant } from "../types";

export const ROMANIA_SNAPSHOT_OBSERVED_AT = "2026-09-12T00:00:00.000Z";

export function snapshotPrice(
  currentPrice: number | null,
  listPrice: number | null,
  currency: string,
): Pick<MarketResearchVariant, "currentPrice" | "listPrice" | "currency" | "discountPercent" | "observedAt"> {
  const discountPercent =
    currentPrice != null && listPrice != null && listPrice > currentPrice
      ? Math.round(((listPrice - currentPrice) / listPrice) * 100)
      : null;
  return {
    currentPrice,
    listPrice,
    currency,
    discountPercent,
    observedAt: ROMANIA_SNAPSHOT_OBSERVED_AT,
  };
}

export function otterProductImage(hash: string): string {
  return `https://cdn.otter.ro/media/catalog/product/cache/7eb369f27775f2db92648609527c34e5/${hash.slice(0, 1)}/${hash.slice(1, 2)}/${hash}.jpeg`;
}

export function marelboProductImage(imageId: number, slug: string): string {
  return `https://marelbo.com/${imageId}-large_default/${slug}.jpg`;
}
