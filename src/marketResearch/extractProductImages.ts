import { isUsableMarketResearchImage, usableMarketResearchImages } from "./images";

const ATTRIBUTE_URL =
  /(?:src|data-src|data-lazy|data-original|data-zoom-image|data-large_image|data-full|href)=["']([^"']+)["']/gi;

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function toAbsoluteUrl(raw: string, baseUrl?: string): string | null {
  const trimmed = decodeHtmlEntities(raw.trim());
  if (!trimmed || trimmed.startsWith("data:")) return null;
  const withProtocol = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
  try {
    return new URL(withProtocol, baseUrl).toString();
  } catch {
    return null;
  }
}

function pushUrl(target: string[], raw: string | null | undefined, baseUrl?: string): void {
  if (!raw) return;
  const absolute = toAbsoluteUrl(raw, baseUrl);
  if (absolute && isUsableMarketResearchImage(absolute)) target.push(absolute);
}

function collectJsonImages(value: unknown, target: string[], baseUrl?: string): void {
  if (!value) return;
  if (typeof value === "string") {
    pushUrl(target, value, baseUrl);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectJsonImages(item, target, baseUrl);
    return;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    collectJsonImages(record.url, target, baseUrl);
    collectJsonImages(record.contentUrl, target, baseUrl);
    collectJsonImages(record.image, target, baseUrl);
    collectJsonImages(record.full, target, baseUrl);
    collectJsonImages(record.img, target, baseUrl);
    collectJsonImages(record.thumb, target, baseUrl);
    collectJsonImages(record.src, target, baseUrl);
    collectJsonImages(record.large, target, baseUrl);
  }
}

function extractJsonLdImages(html: string, baseUrl?: string): string[] {
  const urls: string[] = [];
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      collectJsonImages(JSON.parse(raw), urls, baseUrl);
    } catch {
      /* ignore malformed JSON-LD */
    }
  }
  return urls;
}

function extractMagentoGallery(html: string, baseUrl?: string): string[] {
  const urls: string[] = [];
  const gallery = /"mage\/gallery\/gallery"\s*:\s*\{[\s\S]*?"data"\s*:\s*(\[[\s\S]*?\])/i.exec(html);
  if (gallery?.[1]) {
    try {
      collectJsonImages(JSON.parse(gallery[1]), urls, baseUrl);
    } catch {
      /* fall through */
    }
  }
  const entries = /"media_gallery_entries"\s*:\s*(\[[\s\S]*?\])/i.exec(html);
  if (entries?.[1]) {
    try {
      const parsed = JSON.parse(entries[1]) as Array<{ file?: string }>;
      for (const entry of parsed) {
        if (typeof entry.file === "string") {
          const file = entry.file.startsWith("/") ? entry.file : `/${entry.file}`;
          pushUrl(urls, `/media/catalog/product${file}`, baseUrl);
        }
      }
    } catch {
      /* ignore */
    }
  }
  return urls;
}

function extractMetaImages(html: string, baseUrl?: string): string[] {
  const urls: string[] = [];
  const pattern =
    /<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]+content=["']([^"']+)["']/gi;
  for (const match of html.matchAll(pattern)) {
    pushUrl(urls, match[1], baseUrl);
  }
  return urls;
}

function extractAttributeImages(html: string, baseUrl?: string): string[] {
  const urls: string[] = [];
  for (const match of html.matchAll(ATTRIBUTE_URL)) {
    const raw = match[1];
    if (!raw) continue;
    if (!/\.(jpe?g|png|webp|avif)(?:$|[?#])/i.test(raw) && !/\/media\/catalog\/product\//i.test(raw)) {
      continue;
    }
    pushUrl(urls, raw, baseUrl);
  }
  return urls;
}

export function extractMarketResearchProductImages(html: string, pageUrl?: string): string[] {
  return usableMarketResearchImages([
    ...extractMagentoGallery(html, pageUrl),
    ...extractJsonLdImages(html, pageUrl),
    ...extractMetaImages(html, pageUrl),
    ...extractAttributeImages(html, pageUrl),
  ]);
}

export function extractListingProductCards(
  html: string,
  pageUrl: string,
): Array<{ name: string; productUrl: string; images: string[] }> {
  const cards: Array<{ name: string; productUrl: string; images: string[] }> = [];
  const seen = new Set<string>();
  const blockPattern =
    /<(?:a|div|li|article)[^>]{0,400}>([\s\S]{0,4000}?)<\/(?:a|div|li|article)>/gi;

  for (const match of html.matchAll(blockPattern)) {
    const block = match[0] ?? "";
    const href = /href=["']([^"'#]+)["']/i.exec(block)?.[1];
    if (!href) continue;
    let productUrl: string;
    try {
      productUrl = new URL(href, pageUrl).toString().split("#")[0] ?? href;
    } catch {
      continue;
    }
    if (seen.has(productUrl)) continue;
    if (!/product|pantofi|botine|cizme|sandal|mocasin|loafer|\.html|\/p\/|\/product\//i.test(productUrl)) {
      continue;
    }
    const name =
      /(?:alt|title|aria-label)=["']([^"']{2,120})["']/i.exec(block)?.[1]?.trim() ??
      /<(?:h[1-4]|span|p)[^>]*class=["'][^"']*(?:product|name|title)[^"']*["'][^>]*>([^<]{2,120})</i.exec(
        block,
      )?.[1]?.trim();
    const images = extractMarketResearchProductImages(block, pageUrl);
    if (!name && images.length === 0) continue;
    seen.add(productUrl);
    cards.push({
      name: name ? decodeHtmlEntities(name) : productUrl,
      productUrl,
      images,
    });
  }

  return cards;
}

export function matchModelToken(haystack: string, modelName: string): boolean {
  const hay = haystack.toLowerCase();
  const tokens = modelName
    .toLowerCase()
    .split(/[^a-z0-9&]+/i)
    .filter((token) => token.length >= 2);
  if (tokens.length === 0) return false;
  return tokens.every((token) => hay.includes(token));
}
