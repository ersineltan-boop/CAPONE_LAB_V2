import { fetchJson, sleep } from "./http";
import { mergeProductCatalog } from "./mergeProducts";
import {
  listShopifyCollections,
  shopifyProductToPilot,
} from "./shopify";
import type { PilotProduct, PilotSourceConfig } from "./types";
import { isWomensNewArrivalsCollection, planWomensCollections } from "../brands/wave50/collections";
import { isNewArrivalsCollectionPath } from "../newArrivals/detectNewness";
import { slugifyCategoryId } from "../source/sourceCategories";
import { normalizeProductImageUrls } from "../images/resolveImageQuality";
import {
  FULL_COLLECTION_CRAWL_CAP,
  FULL_COLLECTION_PAGE_CAP,
  FULL_PRODUCTS_PER_PAGE,
} from "./fullCoveragePaths";
import {
  collectionCrawlRank,
  isLikelyProductNamedCollection,
  isPromoFootwearCollection,
  isWomensFootwearCollection,
} from "./shopifyCollectionFilter";

export {
  isLikelyProductNamedCollection,
  isPromoFootwearCollection,
  isWomensFootwearCollection,
};

interface ShopifyListingProduct {
  title: string;
  handle: string;
  images?: Array<{ src?: string }>;
  variants?: Array<{ featured_image?: { src?: string } | null }>;
}

export interface ShopifyCollectionMeta {
  handle: string;
  title: string;
  productsCount: number;
  path: string;
  url: string;
}

function canonicalProductUrl(baseUrl: string, handle: string): string {
  return `${baseUrl.replace(/\/$/, "")}/products/${handle}`;
}

function collectionCategory(
  baseUrl: string,
  path: string,
  title: string,
): NonNullable<PilotProduct["sourceCategories"]>[number] {
  return {
    categoryId: slugifyCategoryId(title),
    categoryName: title,
    categoryPath: path,
    categoryUrl: `${baseUrl.replace(/\/$/, "")}${path}`,
  };
}

function overlayMembershipProduct(
  raw: ShopifyListingProduct,
  config: PilotSourceConfig,
  discoveredAt: string,
  collection: ShopifyCollectionMeta,
): PilotProduct {
  const category = collectionCategory(config.baseUrl, collection.path, collection.title);
  const images = normalizeProductImageUrls([
    ...(raw.images ?? []).map((image) => image.src),
    ...(raw.variants ?? []).map((variant) => variant.featured_image?.src),
  ]);
  return {
    source: config.id,
    brand: config.brand,
    productName: raw.title,
    productUrl: canonicalProductUrl(config.baseUrl, raw.handle),
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
    collectionPath: collection.path,
    collectionLabel: collection.title,
    sourceCategoryId: category.categoryId,
    sourceCategoryName: category.categoryName,
    sourceCategoryPath: collection.path,
    sourceCategoryUrl: category.categoryUrl,
    sourceCategories: [category],
    isNewArrivalsCollection: isNewArrivalsCollectionPath(collection.path) ||
      isNewArrivalsCollectionPath(collection.handle) ||
      isNewArrivalsCollectionPath(collection.title),
    hasNewBadge: false,
    variants: [],
  };
}

export async function paginateShopifyCollectionProducts(
  config: PilotSourceConfig,
  collection: ShopifyCollectionMeta,
  options: {
    discoveredAt: string;
    knownUrls: Set<string>;
    maxPages?: number;
  },
): Promise<{ products: PilotProduct[]; pagesTraversed: number; errors: string[] }> {
  const products: PilotProduct[] = [];
  const errors: string[] = [];
  const maxPages = options.maxPages ?? FULL_COLLECTION_PAGE_CAP;
  let pagesTraversed = 0;
  const seenHandles = new Set<string>();

  for (let page = 1; page <= maxPages; page += 1) {
    const url = `${config.baseUrl.replace(/\/$/, "")}${collection.path}/products.json?limit=${FULL_PRODUCTS_PER_PAGE}&page=${page}`;
    const result = await fetchJson<{ products?: ShopifyListingProduct[] }>(url, 900);
    pagesTraversed = page;
    if (!result.ok || !result.data) {
      errors.push(result.error ?? `Failed ${url}`);
      break;
    }
    if (!Array.isArray(result.data.products)) {
      errors.push(`Invalid Shopify membership products payload: ${url}`);
      break;
    }
    const batch = result.data.products;
    if (batch.length === 0) break;
    let newHandles = 0;
    for (const raw of batch) {
      const productUrl = canonicalProductUrl(config.baseUrl, raw.handle);
      const key = productUrl.toLowerCase().replace(/\/$/, "");
      if (seenHandles.has(key)) continue;
      seenHandles.add(key);
      newHandles += 1;
      const mapped = shopifyProductToPilot(
        raw,
        config,
        options.discoveredAt,
        collection.path,
        collection.title,
      );
      if (mapped) {
        mapped.isNewArrivalsCollection = Boolean(mapped.isNewArrivalsCollection) ||
          isWomensNewArrivalsCollection(collection.handle, collection.title);
        products.push(mapped);
        continue;
      }
      if (options.knownUrls.has(key)) {
        products.push(overlayMembershipProduct(raw, config, options.discoveredAt, collection));
      }
    }
    if (newHandles === 0 || batch.length < FULL_PRODUCTS_PER_PAGE) break;
    if (page === maxPages) errors.push(`Membership page cap reached for ${collection.path}`);
    await sleep(550);
  }

  return { products, pagesTraversed, errors };
}

export interface ShopifyMembershipResult {
  products: PilotProduct[];
  discoveredCollections: ShopifyCollectionMeta[];
  crawledCollections: ShopifyCollectionMeta[];
  skippedCollections: ShopifyCollectionMeta[];
  pagesTraversed: number;
  errors: string[];
  verifiedNewArrivalPaths?: string[];
}

export async function collectShopifyCollectionMembership(
  config: PilotSourceConfig,
  options?: { knownProductUrls?: Iterable<string>; maxCollections?: number; onlyNewCollections?: boolean },
): Promise<ShopifyMembershipResult> {
  const discoveredAt = new Date().toISOString();
  const listed = await listShopifyCollections(config.baseUrl);
  const discovered: ShopifyCollectionMeta[] = listed.collections.map((collection) => ({
    handle: collection.handle,
    title: collection.title,
    productsCount: collection.productsCount,
    path: `/collections/${collection.handle}`,
    url: `${config.baseUrl.replace(/\/$/, "")}/collections/${collection.handle}`,
  }));
  // Official collection names establish membership evidence; products still pass
  // the footwear gate (or match a previously known footwear URL).
  const verifiedNewPaths = new Set([
    ...(config.verifiedNewArrivalPaths ?? []),
    ...planWomensCollections(discovered).newArrivalsPaths,
  ]);
  const footwear = discovered
    .filter((collection) => collection.productsCount > 0 || verifiedNewPaths.has(collection.path))
    .filter(
      (collection) =>
        !isLikelyProductNamedCollection(
          collection.handle,
          collection.title,
          collection.productsCount,
        ),
    )
    .filter((collection) =>
      isWomensFootwearCollection(collection.handle, collection.title) ||
      verifiedNewPaths.has(collection.path),
    )
    .filter((collection) => !options?.onlyNewCollections || verifiedNewPaths.has(collection.path))
    .sort(
      (a, b) =>
        collectionCrawlRank(a) - collectionCrawlRank(b) || b.productsCount - a.productsCount,
    );
  const maxCollections = options?.maxCollections ?? FULL_COLLECTION_CRAWL_CAP;
  const crawled = footwear.slice(0, maxCollections);
  const skipped = footwear.slice(maxCollections);
  const knownUrls = new Set(
    [...(options?.knownProductUrls ?? [])].map((url) => url.toLowerCase().replace(/\/$/, "")),
  );

  let products: PilotProduct[] = [];
  let pagesTraversed = 0;
  const errors = [...listed.errors];
  for (const path of config.verifiedNewArrivalPaths ?? []) {
    if (!discovered.some((collection) => collection.path === path)) {
      errors.push(`Verified New Arrivals collection missing: ${path}`);
    }
  }

  for (const collection of crawled) {
    const page = await paginateShopifyCollectionProducts(config, collection, {
      discoveredAt,
      knownUrls,
    });
    pagesTraversed += page.pagesTraversed;
    errors.push(...page.errors);
    products = mergeProductCatalog(products, page.products);
    await sleep(400);
  }

  return {
    products,
    discoveredCollections: discovered,
    crawledCollections: crawled,
    skippedCollections: skipped,
    pagesTraversed,
    errors,
    verifiedNewArrivalPaths: [...verifiedNewPaths],
  };
}

/** Apply a complete pinned New Arrivals scan without deleting research products. */
export function mergeVerifiedShopifyMembership(
  config: PilotSourceConfig,
  catalog: readonly PilotProduct[],
  collected: ShopifyMembershipResult,
): PilotProduct[] {
  const pinned = [...new Set([
    ...(config.verifiedNewArrivalPaths ?? []),
    ...(collected.verifiedNewArrivalPaths ?? []),
  ])];
  if (pinned.length === 0) return mergeProductCatalog(catalog, collected.products);
  if (collected.errors.length > 0 || !pinned.every((path) =>
    collected.crawledCollections.some((collection) => collection.path === path),
  )) return [...catalog];

  const currentNewUrls = new Set(collected.products
    .filter((product) => product.isNewArrivalsCollection)
    .map((product) => product.productUrl.toLowerCase().replace(/\/$/, "")));
  return mergeProductCatalog(catalog, collected.products).map((product) => {
    if (product.source !== config.id) return product;
    if (currentNewUrls.has(product.productUrl.toLowerCase().replace(/\/$/, ""))) {
      return { ...product, isNewArrivalsCollection: true };
    }
    const oldNewPath = isNewArrivalsCollectionPath(product.collectionPath);
    const oldNewSourcePath = isNewArrivalsCollectionPath(product.sourceCategoryPath);
    return {
      ...product,
      isNewArrivalsCollection: false,
      ...(oldNewPath ? { collectionPath: null, collectionLabel: null } : {}),
      ...(oldNewSourcePath ? {
        sourceCategoryId: null, sourceCategoryName: null,
        sourceCategoryPath: null, sourceCategoryUrl: null,
      } : {}),
      sourceCategories: (product.sourceCategories ?? []).filter((category) =>
        !isNewArrivalsCollectionPath(category.categoryPath ?? category.categoryUrl),
      ),
    };
  });
}
