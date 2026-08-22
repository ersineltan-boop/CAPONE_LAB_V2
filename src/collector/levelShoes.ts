import { fetchJsonPost, fetchText, sleep } from "./http";
import { mergeProductCatalog, mergeProductRecords, normalizeProductUrl } from "./mergeProducts";
import type { PilotProduct } from "./types";
import { slugifyCategoryId, humanizeCollectionHandle } from "../source/sourceCategories";
import { isNewArrivalsCollectionPath } from "../newArrivals/detectNewness";
import { normalizeProductImageUrls } from "../images/resolveImageQuality";
import { isAntiBotHtml } from "../registry/marketplaceProbe";
import type { SourceNativeCategory } from "../source/types";
import { mergeSourceCategories } from "../source/sourceCategories";

export const LEVEL_SHOES_ID = "level-shoes";
export const LEVEL_SHOES_NAME = "Level Shoes";
export const LEVEL_SHOES_BASE = "https://www.levelshoes.com";
export const LEVEL_SHOES_FOOTWEAR_ROOT = "https://www.levelshoes.com/women/shoes.html";
export const LEVEL_SHOES_NEW_IN = "https://www.levelshoes.com/women/shoes/new.html";

const PRODUCT_HREF =
  /href="([^"]*[a-z0-9-]+-women(?:s)?-[a-z0-9-]+\.html)"/gi;

const MAX_PAGES_PER_LISTING = 80;
const MAX_DETAIL_PAGES = 2500;

const MULTI_WORD_BRANDS = [
  "christian-louboutin",
  "manolo-blahnik",
  "roger-vivier",
  "jimmy-choo",
  "dolce-gabbana",
  "bottega-veneta",
  "saint-laurent",
  "rene-caovilla",
  "ren-caovilla",
  "malone-souliers",
  "proenza-schouler",
  "valentino-garavani",
  "golden-goose",
  "paris-texas",
  "tom-ford",
  "st-agni",
  "the-row",
  "the-lline",
  "studio-amelia",
  "ala-a",
  "isabel-marant",
  "aquazzura",
  "gianvito-rossi",
  "amina-muaddi",
  "mach-and-mach",
  "mach-mach",
  "hereu",
  "khaite",
  "loewe",
].sort((a, b) => b.length - a.length);

const REJECTED_SLUG_BRANDS = new Set([
  "tom",
  "golden",
  "paris",
  "agni",
  "saint",
  "the",
  "la",
  "le",
  "de",
  "st",
  "van",
  "von",
]);

function absoluteUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).toString().split("?")[0] ?? href;
  } catch {
    return href;
  }
}

export function identityFromLevelShoesSlug(slug: string): { brand: string; name: string } {
  const cleaned = slug.replace(/\.html$/i, "").replace(/^[a-z]{2}-/, "");
  const withoutCode = cleaned.replace(/-[a-z0-9]{5,8}$/i, "");
  const womenSplit = withoutCode.split(/-women(?:s)?-/i);
  const left = womenSplit[0] ?? withoutCode;
  const multi = MULTI_WORD_BRANDS.find((prefix) => left === prefix || left.startsWith(`${prefix}-`));
  if (multi) {
    const nameSlug = left.slice(multi.length).replace(/^-/, "");
    return {
      brand: humanizeCollectionHandle(multi === "ala-a" ? "alaia" : multi === "mach-mach" ? "mach-and-mach" : multi),
      name: humanizeCollectionHandle(nameSlug || left),
    };
  }
  const first = left.split("-")[0] ?? "";
  if (REJECTED_SLUG_BRANDS.has(first)) {
    return {
      brand: "Unknown",
      name: humanizeCollectionHandle(left),
    };
  }
  const brandSlug = first || "Unknown";
  const nameSlug = left.split("-").slice(1).join("-");
  return {
    brand: humanizeCollectionHandle(brandSlug),
    name: humanizeCollectionHandle(nameSlug || left),
  };
}

export function extractStructuredBrand(html: string): string | null {
  const jsonLd = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = jsonLd.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1] ?? "") as unknown;
      const brand = brandFromUnknown(parsed);
      if (brand) return brand;
    } catch {
      /* ignore malformed JSON-LD */
    }
  }
  const itemprop =
    /itemprop="brand"[^>]*>[\s\S]*?itemprop="name"[^>]*>([^<]+)/i.exec(html) ??
    /itemprop="brand"[^>]*content="([^"]+)"/i.exec(html);
  if (itemprop?.[1]?.trim()) return itemprop[1].trim();
  const dataBrand = /data-brand="([^"]+)"/i.exec(html);
  if (dataBrand?.[1]?.trim()) return dataBrand[1].trim();
  const classBrand =
    /class="[^"]*(?:product-item-brand|product-brand|brand-name)[^"]*"[^>]*>([^<]+)/i.exec(html);
  if (classBrand?.[1]?.trim()) return classBrand[1].trim();
  return null;
}

function brandFromUnknown(value: unknown): string | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = brandFromUnknown(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const brand = record.brand;
  if (typeof brand === "string" && brand.trim()) return brand.trim();
  if (brand && typeof brand === "object") {
    const name = (brand as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  if (record["@graph"]) return brandFromUnknown(record["@graph"]);
  return null;
}

export function extractGalleryFromHtml(html: string): string[] {
  const urls: string[] = [];
  const galleryJson = /"mage\/gallery\/gallery"\s*:\s*\{[\s\S]*?"data"\s*:\s*(\[[\s\S]*?\])/i.exec(html);
  if (galleryJson?.[1]) {
    try {
      const data = JSON.parse(galleryJson[1]) as Array<{ full?: string; img?: string; thumb?: string }>;
      for (const item of data) {
        urls.push(item.full ?? item.img ?? item.thumb ?? "");
      }
    } catch {
      /* keep regex fallback */
    }
  }
  const jsonLdImages = /"image"\s*:\s*(\[[^\]]*\]|"https?:[^"]+")/gi;
  let match: RegExpExecArray | null;
  while ((match = jsonLdImages.exec(html)) !== null) {
    const raw = match[1] ?? "";
    if (raw.startsWith("[")) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (typeof item === "string") urls.push(item);
          }
        }
      } catch {
        /* ignore */
      }
    } else {
      urls.push(raw.replace(/^"|"$/g, ""));
    }
  }
  const imgPattern = /(?:src|data-src)="(https?:\/\/assets\.levelshoes\.com\/media\/catalog\/product\/[^"]+)"/gi;
  while ((match = imgPattern.exec(html)) !== null) {
    urls.push(match[1] ?? "");
  }
  return normalizeProductImageUrls(urls.filter(Boolean));
}

export function extractMagentoFootwearCategoryUrls(
  html: string,
  baseUrl: string,
): Array<{ url: string; name: string }> {
  const seen = new Set<string>();
  const categories: Array<{ url: string; name: string }> = [];
  const pattern = /href="([^"]*\/women\/shoes\/[a-z0-9-]+\.html)"/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const url = absoluteUrl(match[1] ?? "", baseUrl);
    if (seen.has(url)) continue;
    if (/\/women\/shoes\.html$/i.test(url)) continue;
    const slug = url.split("/").pop()?.replace(/\.html$/i, "") ?? "";
    if (!slug) continue;
    seen.add(url);
    categories.push({ url, name: humanizeCollectionHandle(slug) });
  }
  return categories;
}

export function parseNextDataJson(html: string): Record<string, unknown> | null {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

interface LevelShoesMenuNode {
  name?: string;
  webUrlKey?: string;
  analytics?: { categorySlug?: string; name?: string };
  action?: { url?: string; urlPath?: string; type?: string; title?: string };
  children?: LevelShoesMenuNode[];
}

export function extractLevelShoesFootwearCategories(
  menu: unknown,
): Array<{ url: string; name: string }> {
  const categories: Array<{ url: string; name: string }> = [];
  const seen = new Set<string>();

  const walk = (nodes: LevelShoesMenuNode[] | undefined, underWomenShoes: boolean) => {
    if (!nodes) return;
    for (const node of nodes) {
      const name = (node.name ?? node.analytics?.name ?? "").trim();
      const path = (node.webUrlKey ?? node.action?.urlPath ?? node.analytics?.categorySlug ?? "")
        .replace(/^\//, "")
        .replace(/\.html$/i, "");
      const isWomenShoesRoot = /^women\/shoes$/.test(path);
      const isWomenShoesChild = /^women\/shoes\//.test(path);
      const isWomenNewShoes = /^women\/new-in\/shoes$/.test(path);
      const skip =
        /brand|designer|view all/i.test(name) ||
        /\/brands\//.test(path);
      if (underWomenShoes && (isWomenShoesChild || isWomenNewShoes) && !skip && name) {
        const url = `https://www.levelshoes.com/${path}`;
        if (!seen.has(url)) {
          seen.add(url);
          categories.push({ url, name });
        }
      }
      walk(node.children, underWomenShoes || isWomenShoesRoot || /^women$/.test(path));
    }
  };

  walk(Array.isArray(menu) ? (menu as LevelShoesMenuNode[]) : [], false);
  return categories;
}

interface LevelShoesListingProduct {
  name?: string;
  brandName?: string;
  imagePreviewGallery?: Array<{ url?: string }>;
  action?: { url?: string; urlPath?: string; urlSlug?: string };
  analytics?: { brand?: string; category1?: string; category2?: string; category3?: string };
  bottomBadges?: Array<{ text?: string }>;
  color?: string;
}

export function productsFromApolloState(
  apollo: Record<string, unknown> | undefined,
  listingUrl: string,
  discoveredAt: string,
): PilotProduct[] {
  if (!apollo) return [];
  const rootQuery = apollo.ROOT_QUERY as Record<string, unknown> | undefined;
  if (!rootQuery) return [];
  const products: PilotProduct[] = [];
  for (const value of Object.values(rootQuery)) {
    if (!value || typeof value !== "object") continue;
    const record = value as { products?: LevelShoesListingProduct[] };
    if (!Array.isArray(record.products)) continue;
    for (const item of record.products) {
      const mapped = levelShoesItemToPilot(item, listingUrl, discoveredAt);
      if (mapped) products.push(mapped);
    }
  }
  return products;
}

export function levelShoesItemToPilot(
  item: LevelShoesListingProduct,
  listingUrl: string,
  discoveredAt: string,
): PilotProduct | null {
  const url =
    item.action?.url ??
    (item.action?.urlSlug
      ? `https://www.levelshoes.com${item.action.urlSlug.startsWith("/") ? "" : "/"}${item.action.urlSlug}`
      : null);
  if (!url || !/-women(?:s)?-/i.test(url)) return null;
  const slug = url.split("/").pop() ?? "Product";
  const identity = identityFromLevelShoesSlug(slug);
  const structuredBrand = item.brandName?.trim() || item.analytics?.brand?.trim() || null;
  const brand =
    structuredBrand && !REJECTED_SLUG_BRANDS.has(structuredBrand.toLowerCase())
      ? structuredBrand
      : identity.brand;
  const images = normalizeProductImageUrls(
    (item.imagePreviewGallery ?? []).map((image) => image.url),
  );
  const category = categoryFromListingUrl(listingUrl);
  const typeFromAnalytics = [item.analytics?.category3, item.analytics?.category2, item.analytics?.category1]
    .map((value) => value?.trim())
    .find((value) => value && !/^shoes?$/i.test(value) && !/^women$/i.test(value));
  if (typeFromAnalytics && category.categoryId === "shoes") {
    category.categoryId = slugifyCategoryId(typeFromAnalytics);
    category.categoryName = typeFromAnalytics;
  }
  const isNewIn = isNewArrivalsCollectionPath(listingUrl) || /new in/i.test(category.categoryName);
  const hasNewBadge = Boolean(
    item.bottomBadges?.some((badge) => /^new$/i.test(badge.text?.trim() ?? "")),
  );
  return {
    source: LEVEL_SHOES_ID,
    brand,
    productName: item.name?.trim() || identity.name,
    productUrl: url.split("?")[0] ?? url,
    imageUrl: images[0] ?? null,
    images,
    category: "OTHER_FOOTWEAR",
    color: item.color ?? null,
    material: null,
    toeShape: null,
    heelType: null,
    heelHeight: null,
    details: null,
    discoveredAt,
    sourceCategoryName: category.categoryName,
    sourceCategoryId: category.categoryId,
    sourceCategoryPath: category.categoryPath,
    sourceCategoryUrl: listingUrl,
    sourceCategories: [category],
    collectionPath: category.categoryPath,
    collectionLabel: category.categoryName,
    isNewArrivalsCollection: isNewIn,
    hasNewBadge,
    variants: [{ title: item.name?.trim() || identity.name, color: item.color ?? null, sku: null }],
  };
}

export function extractMagentoToolbarTotal(html: string): number | null {
  const amount = /id="toolbar-amount"[^>]*>[\s\S]*?(\d[\d,]*)\s*<\/span>\s*items/i.exec(html);
  if (amount?.[1]) return Number(amount[1].replace(/,/g, ""));
  const of = /(\d[\d,]*)\s*(?:of|\/)\s*(\d[\d,]*)/i.exec(html);
  if (of?.[2]) return Number(of[2].replace(/,/g, ""));
  const json = /"total_count"\s*:\s*(\d+)/i.exec(html);
  if (json?.[1]) return Number(json[1]);
  return null;
}

function nearbyWindow(html: string, href: string): string {
  const idx = html.indexOf(href);
  if (idx < 0) return "";
  return html.slice(Math.max(0, idx - 900), idx + 2200);
}

function imageNearHref(html: string, href: string): string | null {
  const window = nearbyWindow(html, href);
  const img = /(?:src|data-src)="([^"]+)"/i.exec(window);
  const src = img?.[1];
  if (!src || !/\.(jpe?g|png|webp)/i.test(src) || /logo|icon|sprite/i.test(src)) return null;
  const absolute = src.startsWith("//") ? `https:${src}` : src;
  return normalizeProductImageUrls([absolute])[0] ?? null;
}

function brandNearHref(html: string, href: string): string | null {
  const window = nearbyWindow(html, href);
  return extractStructuredBrand(window);
}

export function parseLevelShoesListingHtml(
  html: string,
  listingUrl: string,
  discoveredAt: string,
): PilotProduct[] {
  if (isAntiBotHtml(html, 200)) return [];
  const products: PilotProduct[] = [];
  const seen = new Set<string>();
  const pattern = new RegExp(PRODUCT_HREF.source, "gi");
  const category = categoryFromListingUrl(listingUrl);
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const href = match[1] ?? "";
    const url = absoluteUrl(href, listingUrl);
    if (seen.has(url)) continue;
    if (/\/women\/shoes(?:\/[a-z0-9-]+)?\.html$/i.test(url) && !/-women(?:s)?-/i.test(url)) continue;
    seen.add(url);
    const slug = url.split("/").pop() ?? "Product";
    const structuredBrand = brandNearHref(html, href);
    const identity = identityFromLevelShoesSlug(slug);
    const brand = structuredBrand || identity.brand;
    const nearby = imageNearHref(html, href);
    products.push({
      source: LEVEL_SHOES_ID,
      brand,
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
      sourceCategoryName: category.categoryName,
      sourceCategoryId: category.categoryId,
      sourceCategoryPath: category.categoryPath,
      sourceCategoryUrl: listingUrl,
      sourceCategories: [category],
      collectionPath: category.categoryPath,
      collectionLabel: category.categoryName,
      isNewArrivalsCollection: isNewArrivalsCollectionPath(listingUrl) || slug === "new",
      hasNewBadge: isNewArrivalsCollectionPath(listingUrl),
      variants: [{ title: identity.name, color: null, sku: null }],
    });
  }
  return products;
}

function categoryFromListingUrl(listingUrl: string): SourceNativeCategory {
  const path = new URL(listingUrl).pathname;
  const slug = path.split("/").filter(Boolean).at(-1)?.replace(/\.html$/i, "") ?? "shoes";
  const name =
    slug === "shoes" ? "Shoes" : slug === "new" ? "New In" : humanizeCollectionHandle(slug);
  return {
    categoryId: slugifyCategoryId(name),
    categoryName: name,
    categoryPath: path,
    categoryUrl: listingUrl,
  };
}

function listingPageUrl(listingUrl: string, page: number): string {
  if (page <= 1) return listingUrl;
  const joiner = listingUrl.includes("?") ? "&" : "?";
  return `${listingUrl}${joiner}p=${page}`;
}

async function paginateListing(
  listingUrl: string,
  discoveredAt: string,
  options: { maxPages: number },
): Promise<{ products: PilotProduct[]; pages: number; errors: string[]; reportedTotal: number | null }> {
  const products: PilotProduct[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let reportedTotal: number | null = null;
  let pages = 0;
  let emptyStreak = 0;

  for (let page = 1; page <= options.maxPages; page += 1) {
    const url = listingPageUrl(listingUrl, page);
    const result = await fetchText(url, { delayMs: page === 1 ? 400 : 900 });
    pages = page;
    if (!result.ok) {
      errors.push(result.error ?? `HTTP ${result.status} for ${url}`);
      break;
    }
    if (isAntiBotHtml(result.text, result.status)) {
      errors.push(`Anti-bot page at ${url}`);
      break;
    }
    if (page === 1) reportedTotal = extractMagentoToolbarTotal(result.text);
    const parsed = parseLevelShoesListingHtml(result.text, listingUrl, discoveredAt);
    let added = 0;
    for (const product of parsed) {
      const key = normalizeProductUrl(product.productUrl);
      if (seen.has(key)) continue;
      seen.add(key);
      products.push(product);
      added += 1;
    }
    if (added === 0) {
      emptyStreak += 1;
      if (page > 1 || parsed.length === 0) break;
    } else {
      emptyStreak = 0;
    }
    if (emptyStreak >= 1 && page > 1) break;
    if (parsed.length === 0) break;
  }

  return { products, pages, errors, reportedTotal };
}

function attachCategory(existing: PilotProduct, incoming: PilotProduct): PilotProduct {
  const merged = mergeProductRecords(existing, incoming);
  const categories = (incoming.sourceCategories ?? []).reduce(
    (list, category) => mergeSourceCategories(list, category),
    merged.sourceCategories ?? [],
  );
  return {
    ...merged,
    sourceCategories: categories,
    isNewArrivalsCollection:
      Boolean(existing.isNewArrivalsCollection) || Boolean(incoming.isNewArrivalsCollection),
    hasNewBadge: Boolean(existing.hasNewBadge) || Boolean(incoming.hasNewBadge),
  };
}

async function enrichProductDetail(product: PilotProduct): Promise<PilotProduct> {
  const result = await fetchText(product.productUrl, { delayMs: 350 });
  if (!result.ok || isAntiBotHtml(result.text, result.status)) return product;
  const brand = extractStructuredBrand(result.text);
  const images = extractGalleryFromHtml(result.text);
  const mergedImages = normalizeProductImageUrls([...(product.images ?? []), product.imageUrl, ...images]);
  return {
    ...product,
    brand: brand && brand.toLowerCase() !== "unknown" ? brand : product.brand,
    images: mergedImages,
    imageUrl: mergedImages[0] ?? product.imageUrl,
  };
}

export interface LevelShoesCollectResult {
  products: PilotProduct[];
  categoriesDiscovered: Array<{ url: string; name: string }>;
  pagesTraversed: number;
  rawProductUrls: number;
  uniqueSourceProducts: number;
  verifiedNewProducts: number;
  brands: string[];
  sourceReportedProductCount: number | null;
  paginationExhausted: boolean;
  method: string;
  errors: string[];
  coverageStatus: "FULL" | "PARTIAL" | "FAILED";
  remainingLimitation: string;
}

export async function collectLevelShoes(options?: {
  maxPagesPerListing?: number;
  enrichDetails?: boolean;
  maxDetailPages?: number;
}): Promise<LevelShoesCollectResult> {
  const discoveredAt = new Date().toISOString();
  const maxPages = options?.maxPagesPerListing ?? MAX_PAGES_PER_LISTING;
  const errors: string[] = [];
  let pagesTraversed = 0;
  let method = "nextjs-apollo-listing";

  const root = await fetchText(LEVEL_SHOES_FOOTWEAR_ROOT, { delayMs: 400 });
  if (!root.ok) {
    return emptyFailed(root.error ?? `HTTP ${root.status}`, method, "Women's shoes root was not accessible.");
  }
  if (isAntiBotHtml(root.text, root.status)) {
    return emptyFailed("Anti-bot page at women's shoes root", method, "Source blocked the listing with an anti-bot challenge.", 1);
  }

  const nextData = parseNextDataJson(root.text);
  const pageProps = (nextData?.props as { pageProps?: Record<string, unknown> } | undefined)?.pageProps;
  const menuCategories = pageProps?.menuCategories ?? [];
  const fromMenu = extractLevelShoesFootwearCategories(menuCategories);
  const listings = [
    { url: LEVEL_SHOES_FOOTWEAR_ROOT, name: "Shoes" },
    ...fromMenu,
    { url: "https://www.levelshoes.com/women/new-in/shoes", name: "New In" },
  ].filter((item, index, all) => all.findIndex((other) => other.url === item.url) === index);

  let products: PilotProduct[] = [];
  let paginationExhausted = true;
  let laterPageAdded = false;

  for (const listing of listings) {
    const crawled = await paginateNextListing(listing.url, listing.name, discoveredAt, maxPages);
    pagesTraversed += crawled.pages;
    errors.push(...crawled.errors);
    if (crawled.pages >= maxPages) paginationExhausted = false;
    if (crawled.laterPageAdded) laterPageAdded = true;
    for (const product of crawled.products) {
      const key = normalizeProductUrl(product.productUrl);
      const existing = products.find((item) => normalizeProductUrl(item.productUrl) === key);
      if (existing) {
        products[products.indexOf(existing)] = attachCategory(existing, product);
      } else {
        products.push(product);
      }
    }
  }

  if (products.length === 0) {
    method = "magento-html-pagination";
    const fallback = await paginateListing(LEVEL_SHOES_FOOTWEAR_ROOT, discoveredAt, { maxPages });
    products = fallback.products;
    pagesTraversed += fallback.pages;
    errors.push(...fallback.errors);
  }

  if (options?.enrichDetails === true) {
    const limit = Math.min(products.length, options?.maxDetailPages ?? MAX_DETAIL_PAGES);
    for (let i = 0; i < limit; i += 1) {
      if ((products[i]?.images?.length ?? 0) >= 3) continue;
      products[i] = await enrichProductDetail(products[i]!);
      if (i > 0 && i % 40 === 0) await sleep(600);
    }
  }

  products = mergeProductCatalog([], products);
  const unique = new Set(products.map((product) => normalizeProductUrl(product.productUrl))).size;
  if (!laterPageAdded || unique <= 48) paginationExhausted = false;

  return finalizeResult(
    products,
    listings,
    pagesTraversed,
    null,
    errors,
    method,
    paginationExhausted && laterPageAdded && unique > 48,
  );
}

function emptyFailed(
  error: string,
  method: string,
  remainingLimitation: string,
  pages = 0,
): LevelShoesCollectResult {
  return {
    products: [],
    categoriesDiscovered: [],
    pagesTraversed: pages,
    rawProductUrls: 0,
    uniqueSourceProducts: 0,
    verifiedNewProducts: 0,
    brands: [],
    sourceReportedProductCount: null,
    paginationExhausted: false,
    method,
    errors: [error],
    coverageStatus: "FAILED",
    remainingLimitation,
  };
}

async function paginateNextListing(
  listingUrl: string,
  listingName: string,
  discoveredAt: string,
  maxPages: number,
): Promise<{ products: PilotProduct[]; pages: number; errors: string[]; laterPageAdded: boolean }> {
  const products: PilotProduct[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let laterPageAdded = false;
  let pages = 0;

  for (let page = 1; page <= maxPages; page += 1) {
    const url = page === 1 ? listingUrl : `${listingUrl}${listingUrl.includes("?") ? "&" : "?"}page=${page}`;
    const result = await fetchText(url, { delayMs: page === 1 ? 350 : 800 });
    pages = page;
    if (!result.ok) {
      if (page === 1) errors.push(result.error ?? `HTTP ${result.status} for ${url}`);
      break;
    }
    if (isAntiBotHtml(result.text, result.status)) {
      errors.push(`Anti-bot page at ${url}`);
      break;
    }
    const nextData = parseNextDataJson(result.text);
    const pageProps = (nextData?.props as { pageProps?: Record<string, unknown> } | undefined)?.pageProps;
    const parsed = productsFromApolloState(
      pageProps?.__APOLLO_STATE__ as Record<string, unknown> | undefined,
      listingUrl,
      discoveredAt,
    ).map((product) => ({
      ...product,
      sourceCategoryName: listingName,
      sourceCategoryId: slugifyCategoryId(listingName),
      collectionLabel: listingName,
      sourceCategories: [
        {
          categoryId: slugifyCategoryId(listingName),
          categoryName: listingName,
          categoryPath: new URL(listingUrl).pathname,
          categoryUrl: listingUrl,
        },
      ],
    }));
    let added = 0;
    for (const product of parsed) {
      const key = normalizeProductUrl(product.productUrl);
      if (seen.has(key)) continue;
      seen.add(key);
      products.push(product);
      added += 1;
    }
    if (page > 1 && added > 0) laterPageAdded = true;
    if (added === 0) break;
  }

  return { products, pages, errors, laterPageAdded };
}

async function tryGraphqlCollect(
  discoveredAt: string,
): Promise<{
  products: PilotProduct[];
  categories: Array<{ url: string; name: string }>;
  pages: number;
  reported: number | null;
  errors: string[];
} | null> {
  const query = {
    query: `{
      products(filter: { category_url_path: { eq: "women/shoes" } }, pageSize: 50, currentPage: 1) {
        total_count
        items { name sku url_key brand { name } image { url } media_gallery { url } }
      }
    }`,
  };
  const result = await fetchJsonPost<{ data?: unknown; errors?: unknown }>(
    `${LEVEL_SHOES_BASE}/graphql`,
    query,
    400,
  );
  if (!result.ok || !result.data || result.data.errors) return null;
  const payload = result.data as {
    data?: {
      products?: {
        total_count?: number;
        items?: Array<{
          name?: string;
          url_key?: string;
          brand?: { name?: string } | string | null;
          image?: { url?: string };
          media_gallery?: Array<{ url?: string }>;
        }>;
      };
    };
  };
  const items = payload.data?.products?.items;
  if (!items || items.length === 0) return null;

  const products: PilotProduct[] = [];
  const seen = new Set<string>();
  let page = 1;
  let total = payload.data?.products?.total_count ?? items.length;
  const errors: string[] = [];
  const maxPages = 80;

  const consume = (
    batch: NonNullable<typeof items>,
  ) => {
    for (const item of batch) {
      const urlKey = item.url_key;
      if (!urlKey) continue;
      const url = `${LEVEL_SHOES_BASE}/${urlKey}.html`;
      if (seen.has(url)) continue;
      seen.add(url);
      const brandValue =
        typeof item.brand === "string"
          ? item.brand
          : item.brand?.name ?? identityFromLevelShoesSlug(urlKey).brand;
      const images = normalizeProductImageUrls([
        item.image?.url,
        ...(item.media_gallery ?? []).map((media) => media.url),
      ]);
      const identity = identityFromLevelShoesSlug(urlKey);
      products.push({
        source: LEVEL_SHOES_ID,
        brand: brandValue && !REJECTED_SLUG_BRANDS.has(brandValue.toLowerCase()) ? brandValue : identity.brand,
        productName: item.name ?? identity.name,
        productUrl: url,
        imageUrl: images[0] ?? null,
        images,
        category: "OTHER_FOOTWEAR",
        color: null,
        material: null,
        toeShape: null,
        heelType: null,
        heelHeight: null,
        details: null,
        discoveredAt,
        sourceCategoryName: "Shoes",
        sourceCategoryId: "shoes",
        sourceCategoryPath: "/women/shoes.html",
        sourceCategoryUrl: LEVEL_SHOES_FOOTWEAR_ROOT,
        sourceCategories: [
          {
            categoryId: "shoes",
            categoryName: "Shoes",
            categoryPath: "/women/shoes.html",
            categoryUrl: LEVEL_SHOES_FOOTWEAR_ROOT,
          },
        ],
        collectionPath: "/women/shoes.html",
        collectionLabel: "Shoes",
        isNewArrivalsCollection: false,
        hasNewBadge: false,
        variants: [{ title: item.name ?? identity.name, color: null, sku: null }],
      });
    }
  };

  consume(items);
  while (products.length < total && page < maxPages) {
    page += 1;
    const next = await fetchJsonPost<typeof payload>(
      `${LEVEL_SHOES_BASE}/graphql`,
      {
        query: `{
          products(filter: { category_url_path: { eq: "women/shoes" } }, pageSize: 50, currentPage: ${page}) {
            total_count
            items { name sku url_key brand { name } image { url } media_gallery { url } }
          }
        }`,
      },
      700,
    );
    const batch = next.data?.data?.products?.items ?? [];
    if (batch.length === 0) break;
    consume(batch);
    total = next.data?.data?.products?.total_count ?? total;
  }

  return {
    products,
    categories: [{ url: LEVEL_SHOES_FOOTWEAR_ROOT, name: "Shoes" }],
    pages: page,
    reported: total,
    errors,
  };
}

function finalizeResult(
  products: PilotProduct[],
  categories: Array<{ url: string; name: string }>,
  pagesTraversed: number,
  reported: number | null,
  errors: string[],
  method: string,
  paginationExhausted = true,
): LevelShoesCollectResult {
  const unique = new Set(products.map((product) => normalizeProductUrl(product.productUrl)));
  const verifiedNew = products.filter((product) => product.isNewArrivalsCollection).length;
  const brands = [...new Set(products.map((product) => product.brand).filter((brand) => brand && brand !== "Unknown"))].sort();
  const uniqueCount = unique.size;
  let coverageStatus: "FULL" | "PARTIAL" | "FAILED" = "PARTIAL";
  let remainingLimitation = "Pagination or category traversal was not proven complete.";
  if (uniqueCount === 0) {
    coverageStatus = "FAILED";
    remainingLimitation = "No accessible women's footwear products were returned.";
  } else if (
    paginationExhausted &&
    errors.length === 0 &&
    reported != null &&
    uniqueCount >= reported * 0.9
  ) {
    coverageStatus = "FULL";
    remainingLimitation = "";
  } else if (reported != null && uniqueCount < reported * 0.9) {
    remainingLimitation = `Source reported ${reported} products; collector retained ${uniqueCount} unique URLs.`;
  } else {
    remainingLimitation =
      "Source does not expose a women's-footwear total; Next.js category pages were traversed until empty.";
  }

  return {
    products,
    categoriesDiscovered: categories,
    pagesTraversed,
    rawProductUrls: uniqueCount,
    uniqueSourceProducts: uniqueCount,
    verifiedNewProducts: verifiedNew,
    brands,
    sourceReportedProductCount: reported,
    paginationExhausted,
    method,
    errors,
    coverageStatus,
    remainingLimitation,
  };
}
