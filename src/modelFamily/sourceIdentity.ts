import type { RawAnalyzedProduct } from "./types";

export const MARKETPLACE_SOURCE_IDS = new Set([
  "farfetch",
  "level-shoes",
  "free-people",
  "mytheresa",
]);

export type SourceChannel = "OFFICIAL" | "MARKETPLACE";

export type SourceIdentityKind =
  | "STYLE_CODE"
  | "ZARA_PRODUCT_ID"
  | "SHOPIFY_HANDLE"
  | "FARFETCH_ITEM_ID"
  | "LEVEL_SHOES_SLUG"
  | "CANONICAL_URL";

export interface SourceModelIdentity {
  kind: SourceIdentityKind;
  key: string;
  source: string;
  channel: SourceChannel;
}

export function sourceChannelOf(source: string): SourceChannel {
  return MARKETPLACE_SOURCE_IDS.has(source.trim().toLowerCase())
    ? "MARKETPLACE"
    : "OFFICIAL";
}

export function extractZaraProductId(productUrl: string): string | null {
  const match = productUrl.match(/-p(\d{5,})(?:\.html|$|\?)/i);
  return match ? match[1]! : null;
}

export function extractFarfetchItemId(productUrl: string): string | null {
  const match = productUrl.match(/item-(\d+)/i);
  return match ? match[1]! : null;
}

export function extractShopifyHandle(productUrl: string): string | null {
  try {
    const path = new URL(productUrl).pathname;
    const match = path.match(/\/products\/([^/?#]+)/i);
    return match ? decodeURIComponent(match[1]!).toLowerCase() : null;
  } catch {
    const match = productUrl.match(/\/products\/([^/?#]+)/i);
    return match ? decodeURIComponent(match[1]!).toLowerCase() : null;
  }
}

export function extractLevelShoesSlug(productUrl: string): string | null {
  try {
    const path = new URL(productUrl).pathname.replace(/\/$/, "");
    if (!path || path === "/") return null;
    return path.toLowerCase();
  } catch {
    return null;
  }
}

export function listingIdentityKey(product: RawAnalyzedProduct): string {
  const source = product.source.trim().toLowerCase();
  if (source === "zara") {
    const zaraId = extractZaraProductId(product.productUrl);
    if (zaraId) return `zara:${zaraId}`;
  }
  if (source === "farfetch") {
    const itemId = extractFarfetchItemId(product.productUrl);
    if (itemId) return `farfetch:${itemId}`;
  }
  if (source === "level-shoes") {
    const slug = extractLevelShoesSlug(product.productUrl);
    if (slug) return `level-shoes:${slug}`;
  }
  const handle = extractShopifyHandle(product.productUrl);
  if (handle) return `shopify:${source}:${handle}`;
  return `url:${product.productUrl}`;
}

export function extractSourceIdentity(
  product: RawAnalyzedProduct,
): SourceModelIdentity {
  const source = product.source.trim().toLowerCase();
  const channel = sourceChannelOf(source);
  const key = listingIdentityKey(product);
  const kind: SourceIdentityKind = key.startsWith("zara:")
    ? "ZARA_PRODUCT_ID"
    : key.startsWith("farfetch:")
      ? "FARFETCH_ITEM_ID"
      : key.startsWith("level-shoes:")
        ? "LEVEL_SHOES_SLUG"
        : key.startsWith("shopify:")
          ? "SHOPIFY_HANDLE"
          : "CANONICAL_URL";

  return { kind, key, source, channel };
}
