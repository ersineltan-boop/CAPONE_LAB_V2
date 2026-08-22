import { fetchText } from "./http";
import { mergeProductCatalog } from "./mergeProducts";
import { evaluateFootwearProduct } from "./footwearGate";
import { isNewArrivalsCollectionPath } from "../newArrivals/detectNewness";
import { slugifyCategoryId } from "../source/sourceCategories";
import { normalizeProductImageUrls } from "../images/resolveImageQuality";
import type { PilotProduct } from "./types";

export const FARFETCH_ID = "farfetch";
export const FARFETCH_NAME = "Farfetch";
export const FARFETCH_BASE = "https://www.farfetch.com";
export const FARFETCH_SHOES_URL =
  "https://www.farfetch.com/uk/shopping/women/shoes-1/items.aspx";

const FOOTWEAR_LISTING =
  /\/uk\/shopping\/women\/(?:shoes|trainers|sneakers|boots|sandals|pumps|heels|flats|loafers|mules|clogs|espadrilles|ballerinas|mary-janes?)[^/]*-\d+\/items\.aspx/i;

interface FarfetchJsonLdProduct {
  "@type"?: string;
  name?: string;
  image?: string | string[];
  brand?: { name?: string } | string;
  offers?: { url?: string };
}

interface FarfetchItemList {
  "@type"?: string;
  numberOfItems?: number;
  itemListElement?: FarfetchJsonLdProduct[];
}

export function farfetchImageUrl(url: string): string {
  return url.replace(/_480\.(jpe?g|webp)/i, "_1000.$1");
}

export function parseFarfetchItemList(html: string): FarfetchJsonLdProduct[] {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)].map(
    (match) => match[1] ?? "",
  );
  for (const block of blocks) {
    try {
      const json = JSON.parse(block) as FarfetchItemList;
      if (json["@type"] === "ItemList" && Array.isArray(json.itemListElement)) {
        return json.itemListElement.filter((item) => item["@type"] === "Product" || Boolean(item.name));
      }
    } catch {
      continue;
    }
  }
  return [];
}

export function discoverFarfetchFootwearListings(html: string, baseUrl: string): string[] {
  const urls = new Set<string>([baseUrl.split("?")[0]!]);
  for (const match of html.matchAll(/href="([^"]+)"/gi)) {
    const href = match[1] ?? "";
    try {
      const absolute = new URL(href, FARFETCH_BASE).toString().split("?")[0] ?? href;
      if (FOOTWEAR_LISTING.test(absolute)) urls.add(absolute);
    } catch {
      continue;
    }
  }
  return [...urls];
}

export function farfetchJsonLdToProduct(
  item: FarfetchJsonLdProduct,
  listingUrl: string,
  discoveredAt: string,
): PilotProduct | null {
  const name = item.name?.trim();
  const brand = typeof item.brand === "string" ? item.brand.trim() : item.brand?.name?.trim();
  const href = item.offers?.url?.trim();
  if (!name || !brand || !href) return null;

  let productUrl: string;
  try {
    productUrl = new URL(href, FARFETCH_BASE).toString().split("?")[0] ?? href;
  } catch {
    return null;
  }

  const listingPath = new URL(listingUrl).pathname;
  const gate = evaluateFootwearProduct({
    title: name,
    productType: "Shoes",
    tags: ["women", listingPath],
    handle: productUrl,
    collectionPath: listingPath,
    fromVerifiedFootwearCollection: true,
  });
  if (gate.decision !== "ACCEPT_FOOTWEAR" || !gate.category) return null;

  const images = normalizeProductImageUrls(
    (Array.isArray(item.image) ? item.image : item.image ? [item.image] : []).map(farfetchImageUrl),
  );
  const categoryName = listingPath
    .split("/")
    .filter(Boolean)
    .find((part) => part.includes("-"))
    ?.replace(/-\d+$/, "")
    .replace(/-/g, " ") ?? "Shoes";
  const prettyCategory = categoryName.replace(/\b\w/g, (char) => char.toUpperCase());
  const isNew = isNewArrivalsCollectionPath(listingPath) || isNewArrivalsCollectionPath(listingUrl);

  return {
    source: FARFETCH_ID,
    brand,
    productName: name,
    productUrl,
    imageUrl: images[0] ?? null,
    images,
    category: gate.category,
    color: null,
    material: null,
    toeShape: null,
    heelType: null,
    heelHeight: null,
    details: null,
    discoveredAt,
    collectionPath: listingPath,
    collectionLabel: prettyCategory,
    sourceCategoryId: slugifyCategoryId(prettyCategory),
    sourceCategoryName: prettyCategory,
    sourceCategoryPath: listingPath,
    sourceCategoryUrl: listingUrl.split("?")[0] ?? listingUrl,
    sourceCategories: [
      {
        categoryId: slugifyCategoryId(prettyCategory),
        categoryName: prettyCategory,
        categoryPath: listingPath,
        categoryUrl: listingUrl.split("?")[0] ?? listingUrl,
      },
    ],
    isNewArrivalsCollection: isNew,
    hasNewBadge: false,
    variants: [{ title: name, color: null, sku: null }],
  };
}

export async function collectFarfetch(options?: { maxPagesPerListing?: number }): Promise<{
  products: PilotProduct[];
  errors: string[];
  blocked: boolean;
  paginationExhausted: boolean;
  pagesTraversed: number;
  coverageStatus: "PARTIAL" | "FAILED";
  listingsCrawled: string[];
}> {
  const maxPages = options?.maxPagesPerListing ?? 80;
  const discoveredAt = new Date().toISOString();
  const errors: string[] = [];
  const collected: PilotProduct[] = [];
  let blocked = false;
  let pagesTraversed = 0;
  let paginationExhausted = true;

  const home = await fetchText(FARFETCH_SHOES_URL, { delayMs: 500 });
  if (!home.ok) {
    return {
      products: [],
      errors: [home.error ?? `HTTP ${home.status} for ${FARFETCH_SHOES_URL}`],
      blocked: home.status === 403 || home.status === 429,
      paginationExhausted: false,
      pagesTraversed: 1,
      coverageStatus: "FAILED",
      listingsCrawled: [],
    };
  }

  const firstItems = parseFarfetchItemList(home.text);
  if (firstItems.length === 0) {
    const antiBot = home.status === 403 || home.text.length < 8000;
    return {
      products: [],
      errors: ["Farfetch listing JSON-LD ItemList was missing"],
      blocked: antiBot,
      paginationExhausted: false,
      pagesTraversed: 1,
      coverageStatus: "FAILED",
      listingsCrawled: [],
    };
  }

  const listings = discoverFarfetchFootwearListings(home.text, FARFETCH_SHOES_URL);
  for (const listingUrl of listings) {
    const seenOnListing = new Set<string>();
    for (let page = 1; page <= maxPages; page += 1) {
      const url = page === 1 ? listingUrl : `${listingUrl}${listingUrl.includes("?") ? "&" : "?"}page=${page}`;
      const result =
        listingUrl === FARFETCH_SHOES_URL && page === 1
          ? home
          : await fetchText(url, { delayMs: 900 });
      pagesTraversed += 1;
      if (!result.ok) {
        errors.push(result.error ?? `HTTP ${result.status} for ${url}`);
        if (result.status === 403 || result.status === 429) blocked = true;
        paginationExhausted = false;
        break;
      }
      const items = parseFarfetchItemList(result.text);
      if (items.length === 0) {
        paginationExhausted = paginationExhausted && page > 1;
        break;
      }
      let added = 0;
      for (const item of items) {
        const product = farfetchJsonLdToProduct(item, listingUrl, discoveredAt);
        if (!product || seenOnListing.has(product.productUrl)) continue;
        seenOnListing.add(product.productUrl);
        collected.push(product);
        added += 1;
      }
      if (added === 0) break;
      if (page === maxPages) paginationExhausted = false;
    }
  }

  const products = mergeProductCatalog([], collected);
  return {
    products,
    errors,
    blocked: blocked && products.length === 0,
    paginationExhausted: paginationExhausted && products.length > 0,
    pagesTraversed,
    coverageStatus: products.length > 0 ? "PARTIAL" : "FAILED",
    listingsCrawled: listings,
  };
}
