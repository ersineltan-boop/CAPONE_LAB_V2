import { identityFromLevelShoesSlug, collectLevelShoes } from "./levelShoes";
import { collectFarfetch, FARFETCH_ID } from "./farfetch";
import { collectFreePeople, FREE_PEOPLE_ID } from "./freePeople";
import { fetchText } from "./http";
import type { PilotProduct } from "./types";
import { slugifyCategoryId, humanizeCollectionHandle } from "../source/sourceCategories";
import { isNewArrivalsCollectionPath } from "../newArrivals/detectNewness";
import { normalizeProductImageUrls } from "../images/resolveImageQuality";
import type { MarketplaceProbeCandidate } from "../registry/marketplaceProbe";
import { isAntiBotHtml } from "../registry/marketplaceProbe";

export { identityFromLevelShoesSlug };
export { extractMagentoFootwearCategoryUrls } from "./levelShoes";

function absoluteUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).toString().split("?")[0] ?? href;
  } catch {
    return href;
  }
}

function productIdentity(
  candidate: MarketplaceProbeCandidate,
  url: string,
): { brand: string; name: string } {
  if (candidate.id === "level-shoes") {
    return identityFromLevelShoesSlug(url.split("/").pop() ?? "Product");
  }
  if (candidate.id === "moda-operandi") {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const pIndex = parts.indexOf("p");
    const brandSlug = pIndex >= 0 ? parts[pIndex + 1] : null;
    const nameSlug = pIndex >= 0 ? parts[pIndex + 2] : null;
    return {
      brand: brandSlug ? humanizeCollectionHandle(brandSlug) : "Unknown",
      name: nameSlug ? humanizeCollectionHandle(nameSlug) : humanizeCollectionHandle(parts.at(-1) ?? "Product"),
    };
  }
  return { brand: "Unknown", name: humanizeCollectionHandle(url.split("/").pop() ?? "Product") };
}

function extractImages(html: string): string[] {
  const urls: string[] = [];
  const pattern = /<img[^>]+src="([^"]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const src = match[1];
    if (src && /\.(jpe?g|png|webp)/i.test(src) && !/logo|icon|sprite/i.test(src)) {
      urls.push(src.startsWith("//") ? `https:${src}` : src);
    }
  }
  return normalizeProductImageUrls(urls);
}

function imageNearHref(html: string, href: string): string | null {
  const idx = html.indexOf(href);
  if (idx < 0) return null;
  const window = html.slice(Math.max(0, idx - 400), idx + 2800);
  const img = /<img[^>]+(?:src|data-src)="([^"]+)"/i.exec(window);
  const src = img?.[1];
  if (!src || !/\.(jpe?g|png|webp)/i.test(src) || /logo|icon|sprite/i.test(src)) return null;
  const absolute = src.startsWith("//") ? `https:${src}` : src;
  return normalizeProductImageUrls([absolute])[0] ?? null;
}

export function parseMarketplaceListingHtml(
  html: string,
  candidate: MarketplaceProbeCandidate,
  sourceId: string,
  discoveredAt: string,
): PilotProduct[] {
  if (isAntiBotHtml(html, 200)) return [];
  const products: PilotProduct[] = [];
  const seen = new Set<string>();
  const pattern = new RegExp(candidate.productHrefPattern.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const href = match[1] ?? match[0];
    const url = absoluteUrl(href.replace(/^href="/, "").replace(/"$/, ""), candidate.footwearUrl);
    if (seen.has(url)) continue;
    seen.add(url);
    const identity = productIdentity(candidate, url);
    if (/\/women\/shoes\.html$/i.test(url) || /\/shoes\.html$/i.test(url)) continue;
    if (/\/women\/shoes\/[a-z0-9-]+\.html$/i.test(url) && !/-women(?:s)?-/i.test(url)) continue;
    const nearby = imageNearHref(html, href.replace(/^href="/, "").replace(/"$/, ""));
    const categoryName = isNewArrivalsCollectionPath(candidate.footwearUrl)
      ? "New Arrivals"
      : humanizeCollectionHandle(
          new URL(candidate.footwearUrl).pathname.split("/").filter(Boolean).at(-1)?.replace(/\.html$/i, "") ??
            "Shoes",
        );
    products.push({
      source: sourceId,
      brand: identity.brand,
      productName: identity.name,
      productUrl: url,
      imageUrl: nearby,
      images: nearby ? [nearby] : [],
      category: "OTHER_FOOTWEAR",
      color: null,
      material: null,
      toeShape: null,
      heelType: null,
      heelHeight: null,
      details: null,
      discoveredAt,
      sourceCategoryName: categoryName,
      sourceCategoryId: slugifyCategoryId(categoryName),
      sourceCategoryPath: new URL(candidate.footwearUrl).pathname,
      sourceCategoryUrl: candidate.footwearUrl,
      collectionPath: new URL(candidate.footwearUrl).pathname,
      collectionLabel: categoryName,
      isNewArrivalsCollection: isNewArrivalsCollectionPath(candidate.footwearUrl),
      hasNewBadge: false,
      variants: [{ title: identity.name, color: null, sku: null }],
    });
  }

  const images = extractImages(html);
  if (images.length > 0 && products.length > 0) {
    for (let i = 0; i < products.length; i += 1) {
      if (products[i]!.imageUrl) continue;
      const image = images[i] ?? images[0] ?? null;
      products[i] = { ...products[i]!, imageUrl: image, images: image ? [image] : [] };
    }
  }

  return products;
}

export async function collectMarketplaceListing(
  candidate: MarketplaceProbeCandidate,
  options?: { maxPages?: number },
): Promise<{ products: PilotProduct[]; errors: string[]; blocked: boolean }> {
  if (candidate.id === "level-shoes") {
    const collected = await collectLevelShoes({
      maxPagesPerListing: options?.maxPages ?? 80,
    });
    return {
      products: collected.products,
      errors: collected.errors,
      blocked: collected.coverageStatus === "FAILED" && collected.errors.some((error) => /anti-bot/i.test(error)),
    };
  }
  if (candidate.id === FARFETCH_ID) {
    const collected = await collectFarfetch({ maxPagesPerListing: options?.maxPages ?? 80 });
    return {
      products: collected.products,
      errors: collected.errors,
      blocked: collected.blocked,
    };
  }
  if (candidate.id === FREE_PEOPLE_ID) {
    const collected = await collectFreePeople();
    return {
      products: collected.products,
      errors: [collected.blocker, ...collected.errors],
      blocked: collected.blocked,
    };
  }
  const maxPages = options?.maxPages ?? 4;
  const discoveredAt = new Date().toISOString();
  const products: PilotProduct[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let blocked = false;

  for (let page = 1; page <= maxPages; page += 1) {
    const pageParam = candidate.pageParam ?? "page";
    const url =
      page === 1
        ? candidate.footwearUrl
        : `${candidate.footwearUrl}${candidate.footwearUrl.includes("?") ? "&" : "?"}${pageParam}=${page}`;
    const result = await fetchText(url, { delayMs: 1400 });
    if (!result.ok) {
      errors.push(result.error ?? `HTTP ${result.status} for ${url}`);
      if (isAntiBotHtml(result.text, result.status)) blocked = true;
      break;
    }
    if (isAntiBotHtml(result.text, result.status)) {
      blocked = true;
      errors.push(`Anti-bot page at ${url}`);
      break;
    }
    const parsed = parseMarketplaceListingHtml(result.text, candidate, candidate.id, discoveredAt);
    if (parsed.length === 0) break;
    let added = 0;
    for (const product of parsed) {
      if (seen.has(product.productUrl)) continue;
      seen.add(product.productUrl);
      products.push(product);
      added += 1;
    }
    if (added === 0) break;
  }

  if (candidate.newArrivalUrl) {
    const newCandidate = {
      ...candidate,
      footwearUrl: candidate.newArrivalUrl,
    };
    const result = await fetchText(candidate.newArrivalUrl, { delayMs: 1400 });
    if (result.ok && !isAntiBotHtml(result.text, result.status)) {
      const parsed = parseMarketplaceListingHtml(
        result.text,
        newCandidate,
        candidate.id,
        discoveredAt,
      );
      for (const product of parsed) {
        if (seen.has(product.productUrl)) {
          const existing = products.find((item) => item.productUrl === product.productUrl);
          if (existing) {
            existing.isNewArrivalsCollection = true;
            existing.hasNewBadge = true;
          }
          continue;
        }
        seen.add(product.productUrl);
        products.push({ ...product, isNewArrivalsCollection: true, hasNewBadge: true });
      }
    }
  }

  return { products, errors, blocked };
}
