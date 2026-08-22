/**
 * Shared product-image quality resolver.
 *
 * Cause of blur: many Shopify/CDN URLs are stored as sized thumbnails
 * (`_100x`, `_compact`, `?width=200`). CSS upscaling those is not a fix.
 * We derive the original Shopify asset when the URL is a known CDN form,
 * then request appropriately large width variants via srcSet.
 */

const SHOPIFY_NAMED_SIZES =
  "pico|icon|thumb|small|compact|medium|large|grande|master";

const SHOPIFY_SIZE_SUFFIX = new RegExp(
  `_(?:${SHOPIFY_NAMED_SIZES}|\\d+x(?:\\d+)?)(?=\\.[a-z0-9]+$)`,
  "i",
);

const DISPLAY_WIDTHS = [400, 800, 1200, 1600, 2000] as const;

export interface ResolvedDisplayImage {
  src: string;
  srcSet: string | undefined;
  sizes: string;
  originalSrc: string;
}

export function isValidImageUrl(url: string | null | undefined): url is string {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isShopifyCdnUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    return (
      host.includes("cdn.shopify.com") ||
      host.endsWith(".myshopify.com") ||
      path.includes("/cdn/shop/") ||
      path.includes("/s/files/")
    );
  } catch {
    return false;
  }
}

export function stripShopifySizeSuffix(pathname: string): string {
  return pathname.replace(SHOPIFY_SIZE_SUFFIX, "");
}

/**
 * Cloudflare Image Resizing: /cdn-cgi/image/<options>/<original-path>
 * Options never contain slashes. Unwrapping yields the original catalog asset.
 */
export function toCloudflareOriginalUrl(url: string): string {
  const trimmed = url.trim();
  if (!isValidImageUrl(trimmed)) return trimmed;
  try {
    const parsed = new URL(url.trim());
    const match = parsed.pathname.match(/^\/cdn-cgi\/image\/[^/]+\/(.+)$/i);
    if (!match?.[1]) return url.trim();
    parsed.pathname = `/${match[1]}`;
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

export function toOriginalCdnUrl(url: string): string {
  const trimmed = url.trim();
  if (isShopifyCdnUrl(trimmed)) return toShopifyOriginalUrl(trimmed);
  return toCloudflareOriginalUrl(trimmed);
}

export function toShopifyOriginalUrl(url: string): string {
  if (!isValidImageUrl(url) || !isShopifyCdnUrl(url)) return url.trim();
  try {
    const parsed = new URL(url.trim());
    parsed.pathname = stripShopifySizeSuffix(parsed.pathname);
    parsed.searchParams.delete("width");
    parsed.searchParams.delete("height");
    parsed.searchParams.delete("crop");
    parsed.searchParams.delete("pad_color");
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

export function shopifyUrlWithWidth(originalUrl: string, width: number): string {
  const parsed = new URL(toShopifyOriginalUrl(originalUrl));
  parsed.searchParams.set("width", String(width));
  return parsed.toString();
}

export function imageDedupeKey(url: string): string {
  try {
    const original = toOriginalCdnUrl(url);
    const parsed = new URL(original);
    const path = isShopifyCdnUrl(original)
      ? stripShopifySizeSuffix(parsed.pathname)
      : parsed.pathname;
    return `${parsed.origin}${path}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export function looksLikeLowResolutionShopifyUrl(url: string): boolean {
  if (!isShopifyCdnUrl(url)) return false;
  try {
    const parsed = new URL(url);
    const width = Number(parsed.searchParams.get("width") ?? "");
    if (Number.isFinite(width) && width > 0 && width < 400) return true;
    return SHOPIFY_SIZE_SUFFIX.test(parsed.pathname) &&
      /_(?:pico|icon|thumb|small|compact|100x(?:\d+)?|160x(?:\d+)?|200x(?:\d+)?|240x(?:\d+)?)\./i.test(
        parsed.pathname,
      );
  } catch {
    return false;
  }
}

export function normalizeProductImageUrls(
  urls: Array<string | null | undefined>,
): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const url of urls) {
    if (!isValidImageUrl(url)) continue;
    const trimmed = url.trim();
    const resolved = toOriginalCdnUrl(trimmed);
    const key = imageDedupeKey(resolved);
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(resolved);
  }

  return normalized;
}

export function pickHighestResolutionUrl(
  urls: Array<string | null | undefined>,
): string | null {
  const normalized = normalizeProductImageUrls(urls);
  if (normalized.length === 0) return null;

  const scored = [...normalized].sort((a, b) => {
    const aLow = looksLikeLowResolutionShopifyUrl(a) ? 1 : 0;
    const bLow = looksLikeLowResolutionShopifyUrl(b) ? 1 : 0;
    return aLow - bLow;
  });

  return scored[0] ?? null;
}

const DEFAULT_SIZES =
  "(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";

export const BRAND_CARD_SIZES =
  "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";

export const PRODUCT_GRID_SIZES = DEFAULT_SIZES;

export function resolveDisplayImage(
  url: string | null | undefined,
  sizes: string = DEFAULT_SIZES,
  fallbacks: Array<string | null | undefined> = [],
): ResolvedDisplayImage | null {
  const best = pickHighestResolutionUrl([url, ...fallbacks]);
  if (!best) return null;

  if (!isShopifyCdnUrl(best)) {
    return {
      src: best,
      srcSet: undefined,
      sizes,
      originalSrc: best,
    };
  }

  const original = toShopifyOriginalUrl(best);
  const srcSet = DISPLAY_WIDTHS.map(
    (width) => `${shopifyUrlWithWidth(original, width)} ${width}w`,
  ).join(", ");

  return {
    src: shopifyUrlWithWidth(original, 1200),
    srcSet,
    sizes,
    originalSrc: original,
  };
}

export function resolveDisplayImages(
  urls: Array<string | null | undefined>,
  sizes: string = DEFAULT_SIZES,
): ResolvedDisplayImage[] {
  return normalizeProductImageUrls(urls)
    .map((url) => resolveDisplayImage(url, sizes))
    .filter((item): item is ResolvedDisplayImage => item !== null);
}
