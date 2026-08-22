import { fetchJson, sleep } from "./http";
import { mergeProductCatalog } from "./mergeProducts";
import { shopifyProductToPilot } from "./shopify";
import { FULL_COLLECTION_PAGE_CAP, FULL_PRODUCTS_PER_PAGE } from "./fullCoveragePaths";
import { isNewArrivalsCollectionPath } from "../newArrivals/detectNewness";
import { slugifyCategoryId } from "../source/sourceCategories";
import type { CollectionAttemptResult } from "./collectWithFallback";
import type { PilotProduct, PilotSourceConfig } from "./types";
import type { BrandRegistryEntry } from "../registry/types/brand";

export const DRIES_BRAND_ID = "dries-van-noten";
export const DRIES_BRAND_NAME = "DRIES VAN NOTEN";
export const DRIES_BASE_URL = "https://www.driesvannoten.com";
export const DRIES_WOMEN_SHOES_PATH = "/collections/women-shoes";
export const DRIES_SNEAKERS_PATH = "/collections/sneakers";
export const DRIES_NEW_ARRIVALS_WOMEN_PATH = "/collections/new-arrivals-women";

export interface DriesCollectionRecord {
  handle: string;
  title: string;
  products_count?: number;
}

export interface DriesShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html?: string;
  product_type?: string;
  tags?: string[] | string;
  images?: Array<{ src?: string }>;
  variants?: Array<{
    title: string;
    option1?: string | null;
    option2?: string | null;
    option3?: string | null;
    sku?: string | null;
    featured_image?: { src?: string } | null;
  }>;
  options?: Array<{ name: string; values: string[] }>;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

const MENS_COLLECTION =
  /\bmen'?s?\b|\bmens\b|\bhomme\b|\bfor him\b|\bgiftforhim\b/i;
const WOMENS_COLLECTION =
  /\bwomen'?s?\b|\bwomens\b|\bfemme\b|\bladies\b|\bfor her\b|\bgiftforher\b/i;
const FOOTWEAR_COLLECTION =
  /\bshoes?\b|\bfootwear\b|\bsneakers?\b|\bboots?\b|\bsandals?\b|\bpumps?\b|\bloafers?\b|\bheels?\b|\bmules?\b|\bclogs?\b|\bespadrilles?\b/i;
const GIFT_COLLECTION = /gift|happy-wife/i;

const NON_FOOTWEAR_TYPES =
  /bag|leather goods|jewelry|jewellery|scarf|foulard|dress|skirt|pant|trouser|jean|shirt|blouse|top|knit|coat|jacket|blazer|suit|swim|belt|sunglass|eyewear|fragrance|perfume|beauty|sock|tie|glove|hat/i;

function normalizeTags(tags: string[] | string | undefined): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map((tag) => tag.trim()).filter(Boolean);
  return tags.split(",").map((tag) => tag.trim()).filter(Boolean);
}

function joinHaystack(product: DriesShopifyProduct): string {
  return [product.title, product.product_type, ...normalizeTags(product.tags), product.handle]
    .filter(Boolean)
    .join(" ");
}

export function isDriesMensCollection(collection: Pick<DriesCollectionRecord, "handle" | "title">): boolean {
  const hay = `${collection.handle} ${collection.title}`;
  if (WOMENS_COLLECTION.test(hay) && !MENS_COLLECTION.test(hay)) return false;
  return MENS_COLLECTION.test(hay) || /^men-/.test(collection.handle);
}

export function isDriesWomensFootwearCollection(
  collection: Pick<DriesCollectionRecord, "handle" | "title">,
): boolean {
  if (isDriesMensCollection(collection)) return false;
  if (GIFT_COLLECTION.test(`${collection.handle} ${collection.title}`)) return false;
  const hay = `${collection.handle} ${collection.title}`;
  if (collection.handle === "women-shoes") return true;
  if (collection.handle === "sneakers") return true;
  if (collection.handle === "new-arrivals-women") return true;
  if (collection.handle === "shoes") return false;
  return FOOTWEAR_COLLECTION.test(hay) && WOMENS_COLLECTION.test(hay);
}

export function discoverDriesWomensFootwearCollections(
  collections: DriesCollectionRecord[],
): DriesCollectionRecord[] {
  const selected: DriesCollectionRecord[] = [];
  const seen = new Set<string>();
  for (const collection of collections) {
    if (!isDriesWomensFootwearCollection(collection)) continue;
    const handle = collection.handle.trim().toLowerCase();
    if (seen.has(handle)) continue;
    seen.add(handle);
    selected.push(collection);
  }
  selected.sort((a, b) => {
    const rank = (handle: string) => {
      if (handle === "women-shoes") return 0;
      if (handle === "sneakers") return 1;
      if (handle === "new-arrivals-women") return 2;
      return 3;
    };
    return rank(a.handle) - rank(b.handle) || a.handle.localeCompare(b.handle);
  });
  return selected;
}

export function isDriesNonFootwearProduct(product: DriesShopifyProduct): boolean {
  const type = product.product_type ?? "";
  if (NON_FOOTWEAR_TYPES.test(type)) return true;
  const hay = joinHaystack(product);
  if (/\bbags?\b|\bhandbags?\b|\bclutch\b|\bdress\b|\bskirt\b|\bfragrance\b/i.test(hay) &&
      !/\bshoes?\b|\bsneakers?\b|\bboots?\b|\bpumps?\b|\bsandals?\b/i.test(product.product_type ?? "")) {
    return true;
  }
  return false;
}

export function isDriesMensProduct(product: DriesShopifyProduct): boolean {
  const tags = normalizeTags(product.tags).map((tag) => tag.toUpperCase());
  const hasWomen = tags.includes("WOMEN") || tags.includes("DVNWOMEN") || tags.includes("DVNAW26WOMEN");
  if (hasWomen) return false;
  return (
    tags.includes("MEN") ||
    tags.includes("DVNMEN") ||
    tags.includes("DVNAW26MEN") ||
    /\bmen'?s\b/i.test(joinHaystack(product))
  );
}

export function isDriesFootwearProduct(product: DriesShopifyProduct): boolean {
  const type = (product.product_type ?? "").toLowerCase();
  const tags = normalizeTags(product.tags).map((tag) => tag.toUpperCase());
  if (type === "shoes" || type === "footwear") return true;
  return tags.includes("SHOES") || tags.includes("SNEAKERS") || tags.includes("BOOTS");
}

export function isDriesWomensFootwearProduct(
  product: DriesShopifyProduct,
  collectionPath?: string | null,
): boolean {
  if (isDriesNonFootwearProduct(product)) return false;
  if (!isDriesFootwearProduct(product)) return false;
  if (isDriesMensProduct(product)) return false;
  const tags = normalizeTags(product.tags).map((tag) => tag.toUpperCase());
  const hasWomen = tags.includes("WOMEN") || tags.includes("DVNWOMEN") || tags.includes("DVNAW26WOMEN");
  if (hasWomen) return true;
  const path = (collectionPath ?? "").toLowerCase();
  return path.includes("women-shoes") || path.includes("new-arrivals-women");
}

/**
 * Dries tags every fashion SKU ACCESSORIES, including shoes. The shared
 * footwear gate treats that tag as non-footwear. Strip it only when the
 * product is independently a shoe so the Shopify mapper can run unchanged.
 */
export function sanitizeDriesProductForFootwearGate(
  product: DriesShopifyProduct,
): DriesShopifyProduct {
  const tags = normalizeTags(product.tags).filter(
    (tag) => tag.toUpperCase() !== "ACCESSORIES",
  );
  return { ...product, tags };
}

export function driesCollectionToCategory(
  collection: DriesCollectionRecord,
  baseUrl = DRIES_BASE_URL,
): {
  categoryId: string;
  categoryName: string;
  categoryPath: string;
  categoryUrl: string;
} {
  const categoryPath = `/collections/${collection.handle}`;
  return {
    categoryId: slugifyCategoryId(collection.title || collection.handle),
    categoryName: collection.title,
    categoryPath,
    categoryUrl: `${baseUrl.replace(/\/$/, "")}${categoryPath}`,
  };
}

export function mapDriesProductToPilot(
  product: DriesShopifyProduct,
  collection: DriesCollectionRecord,
  config: PilotSourceConfig,
  discoveredAt: string,
): PilotProduct | null {
  const path = `/collections/${collection.handle}`;
  if (!isDriesWomensFootwearProduct(product, path)) return null;

  const mapped = shopifyProductToPilot(
    sanitizeDriesProductForFootwearGate(product),
    {
      ...config,
      verifiedFootwearPaths: [...(config.verifiedFootwearPaths ?? []), path],
    },
    discoveredAt,
    path,
  );
  if (!mapped) return null;

  const category = driesCollectionToCategory(collection, config.baseUrl);
  const isNew = isNewArrivalsCollectionPath(path);
  return {
    ...mapped,
    collectionPath: path,
    collectionLabel: collection.title,
    sourceCategoryId: category.categoryId,
    sourceCategoryName: category.categoryName,
    sourceCategoryPath: category.categoryPath,
    sourceCategoryUrl: category.categoryUrl,
    sourceCategories: [category],
    isNewArrivalsCollection: isNew || mapped.isNewArrivalsCollection,
  };
}

export function parseDriesCollectionsJson(payload: unknown): DriesCollectionRecord[] {
  if (!payload || typeof payload !== "object") return [];
  const collections = (payload as { collections?: DriesCollectionRecord[] }).collections;
  if (!Array.isArray(collections)) return [];
  return collections.filter((item) => item && typeof item.handle === "string");
}

export function parseDriesProductsJson(payload: unknown): DriesShopifyProduct[] {
  if (!payload || typeof payload !== "object") return [];
  const products = (payload as { products?: DriesShopifyProduct[] }).products;
  if (!Array.isArray(products)) return [];
  return products.filter(
    (item): item is DriesShopifyProduct =>
      Boolean(item) &&
      typeof item.handle === "string" &&
      typeof item.title === "string",
  ).map((item) => ({
    ...item,
    id: typeof item.id === "number" ? item.id : 0,
  }));
}

export function driesPilotConfig(entry?: Pick<BrandRegistryEntry, "id" | "brand" | "officialUrl">): PilotSourceConfig {
  return {
    id: entry?.id ?? DRIES_BRAND_ID,
    brand: entry?.brand ?? DRIES_BRAND_NAME,
    baseUrl: (entry?.officialUrl ?? DRIES_BASE_URL).replace(/\/$/, ""),
    collectionPaths: [DRIES_WOMEN_SHOES_PATH, DRIES_SNEAKERS_PATH, DRIES_NEW_ARRIVALS_WOMEN_PATH],
    verifiedFootwearPaths: [DRIES_WOMEN_SHOES_PATH, DRIES_SNEAKERS_PATH],
    maxProducts: 500,
    collectMode: "full",
  };
}

async function fetchDriesCollections(baseUrl: string): Promise<{
  collections: DriesCollectionRecord[];
  errors: string[];
}> {
  const collections: DriesCollectionRecord[] = [];
  const errors: string[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const url = `${baseUrl}/collections.json?limit=250&page=${page}`;
    const result = await fetchJson<{ collections?: DriesCollectionRecord[] }>(url, 700);
    if (!result.ok || !result.data) {
      if (page === 1) errors.push(result.error ?? `Failed ${url}`);
      break;
    }
    const batch = parseDriesCollectionsJson(result.data);
    if (batch.length === 0) break;
    collections.push(...batch);
    if (batch.length < 250) break;
    await sleep(500);
  }
  return { collections, errors };
}

async function paginateDriesCollection(
  config: PilotSourceConfig,
  collection: DriesCollectionRecord,
  discoveredAt: string,
): Promise<{
  products: PilotProduct[];
  discoveredLinks: Set<string>;
  errors: string[];
  pagesTraversed: number;
  exhausted: boolean;
  duplicateCount: number;
  rawUrls: number;
}> {
  const discoveredLinks = new Set<string>();
  const products: PilotProduct[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let duplicateCount = 0;
  let pagesTraversed = 0;
  let exhausted = false;
  const path = `/collections/${collection.handle}`;

  for (let page = 1; page <= FULL_COLLECTION_PAGE_CAP; page += 1) {
    const url = `${config.baseUrl}${path}/products.json?limit=${FULL_PRODUCTS_PER_PAGE}&page=${page}`;
    const result = await fetchJson<{ products?: DriesShopifyProduct[] }>(url, 800);
    pagesTraversed = page;
    if (!result.ok || !result.data) {
      if (page === 1) errors.push(result.error ?? `Failed ${url}`);
      break;
    }
    const batch = parseDriesProductsJson(result.data);
    if (batch.length === 0) {
      exhausted = true;
      pagesTraversed = Math.max(0, page - 1);
      break;
    }
    for (const raw of batch) {
      const productUrl = `${config.baseUrl}/products/${raw.handle}`;
      discoveredLinks.add(productUrl);
      if (seen.has(productUrl)) {
        duplicateCount += 1;
        continue;
      }
      const mapped = mapDriesProductToPilot(raw, collection, config, discoveredAt);
      if (!mapped) continue;
      seen.add(productUrl);
      products.push(mapped);
    }
    if (batch.length < FULL_PRODUCTS_PER_PAGE) {
      exhausted = true;
      break;
    }
    await sleep(600);
  }

  return {
    products,
    discoveredLinks,
    errors,
    pagesTraversed,
    exhausted,
    duplicateCount,
    rawUrls: discoveredLinks.size,
  };
}

export async function collectDriesVanNoten(
  entry?: BrandRegistryEntry,
): Promise<
  CollectionAttemptResult & {
    discoveryStatus: BrandRegistryEntry["collectionDiscoveryStatus"];
    footwearCollectionPath: string;
    footwearCollectionUrl: string;
    catalogFootwearCount: number;
    pagesTraversed: number;
    rawProductUrlsDiscovered: number;
    duplicateCount: number;
    paginationExhausted: boolean;
    sourceReportedProductCount: number | null;
    footwearRoots: string[];
    sourceCategoriesCollected: string[];
  }
> {
  const config = driesPilotConfig(entry);
  const discoveredAt = new Date().toISOString();
  const listed = await fetchDriesCollections(config.baseUrl);
  const discovered = discoverDriesWomensFootwearCollections(listed.collections);

  const fallback: DriesCollectionRecord[] = [
    { handle: "women-shoes", title: "Women's Shoes" },
    { handle: "sneakers", title: "Sneakers" },
    { handle: "new-arrivals-women", title: "New Arrivals Women" },
  ];
  const collections = discovered.length > 0 ? discovered : fallback;
  const womenShoes = collections.find((item) => item.handle === "women-shoes");
  const sourceReportedProductCount = womenShoes?.products_count ?? null;

  const collected: PilotProduct[] = [];
  const discoveredLinks = new Set<string>();
  const errors = [...listed.errors];
  let pagesTraversed = 0;
  let duplicateCount = 0;
  let paginationExhausted = true;

  for (const collection of collections) {
    const page = await paginateDriesCollection(config, collection, discoveredAt);
    pagesTraversed += page.pagesTraversed;
    duplicateCount += page.duplicateCount;
    paginationExhausted = paginationExhausted && page.exhausted;
    errors.push(...page.errors);
    for (const link of page.discoveredLinks) discoveredLinks.add(link);
    collected.push(...page.products);
  }

  const products = mergeProductCatalog([], collected);
  const footwearRoots = collections.map((item) => `/collections/${item.handle}`);

  return {
    products,
    discoveredLinks,
    errors,
    method: "custom-adapter",
    discoveryStatus: womenShoes ? "VERIFIED" : "AUTO_DISCOVERED",
    footwearCollectionPath: DRIES_WOMEN_SHOES_PATH,
    footwearCollectionUrl: `${config.baseUrl}${DRIES_WOMEN_SHOES_PATH}`,
    catalogFootwearCount: products.length,
    pagesTraversed,
    rawProductUrlsDiscovered: discoveredLinks.size,
    duplicateCount,
    paginationExhausted,
    sourceReportedProductCount,
    footwearRoots,
    sourceCategoriesCollected: collections.map((item) => item.title),
  };
}
