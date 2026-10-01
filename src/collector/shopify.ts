import { parseProductFieldsFromHtml, extractPrimaryColor } from "./parseHtmlFields";
import { evaluateFootwearProduct, evaluateStoredPilotProduct, isVerifiedFootwearCollectionPath } from "./footwearGate";
import {
  emptyTotemeCollectStats,
  evaluateTotemeFootwearProduct,
  isTotemeAuditCollection,
  isTotemeFootwearCollection,
  isTotemeFootwearCollectionPath,
  isTotemeSource,
  recordTotemeDecision,
  type TotemeCollectStats,
} from "./totemeFootwear";
import { mergeProductCatalog, sortProductsNewestFirst } from "./mergeProducts";
import type { FootwearCategory, PilotProduct, PilotProductVariant, PilotSourceConfig } from "./types";
import { fetchJson, sleep } from "./http";
import { extractShopifyProductDates } from "../productDates/shopifyDates";
import {
  detectNewBadgeInText,
  isNewArrivalsCollectionPath,
} from "../newArrivals/detectNewness";
import {
  categoryFromCollectionPath,
  humanizeCollectionHandle,
  slugifyCategoryId,
} from "../source/sourceCategories";
import { normalizeProductImageUrls } from "../images/resolveImageQuality";
import {
  FULL_COLLECTION_CRAWL_CAP,
  FULL_COLLECTION_PAGE_CAP,
  FULL_PRODUCTS_PER_PAGE,
  FULL_VARIANT_CAP,
  LEGACY_BACKFILL_CAP,
  LEGACY_COLLECTION_PAGE_CAP,
} from "./fullCoveragePaths";
import {
  authoritativeFootwearReportedCount,
  selectShopifyFootwearCollectionsToCrawl,
} from "./shopifyCollectionFilter";

interface ShopifyImage {
  src?: string;
}

interface ShopifyVariant {
  title: string;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  sku?: string | null;
  available?: boolean;
  featured_image?: { src?: string } | null;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html?: string;
  product_type?: string;
  tags?: string[] | string;
  images?: ShopifyImage[];
  variants?: ShopifyVariant[];
  options?: Array<{ name: string; values: string[] }>;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface ShopifyProductsResponse {
  products: ShopifyProduct[];
}

interface ShopifyCollection {
  handle?: string;
  title?: string;
  products_count?: number;
}

interface ShopifyCollectionsResponse {
  collections?: ShopifyCollection[];
}

function normalizeTags(tags: string[] | string | undefined): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  return tags.split(",").map((t) => t.trim());
}

function canonicalProductUrl(baseUrl: string, handle: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/products/${handle}`;
}

function pickImage(product: ShopifyProduct): string | null {
  const urls = normalizeProductImageUrls([
    product.images?.[0]?.src,
    product.variants?.find((v) => v.featured_image?.src)?.featured_image?.src,
  ]);
  return urls[0] ?? null;
}

function collectImages(product: ShopifyProduct): string[] {
  return normalizeProductImageUrls([
    ...(product.images ?? []).map((image) => image.src),
    ...(product.variants ?? []).map((variant) => variant.featured_image?.src),
  ]);
}

function mapVariants(product: ShopifyProduct): PilotProductVariant[] {
  if (!product.variants?.length) return [];

  const colorOptionName = product.options?.find((o) =>
    /color|colour|cor/i.test(o.name),
  )?.name;

  return product.variants.slice(0, FULL_VARIANT_CAP).map((variant) => {
    let color: string | null = null;
    if (colorOptionName && product.options) {
      const idx = product.options.findIndex((o) => o.name === colorOptionName);
      if (idx === 0) color = variant.option1 ?? null;
      if (idx === 1) color = variant.option2 ?? null;
      if (idx === 2) color = variant.option3 ?? null;
    }

    return {
      title: variant.title,
      color,
      sku: variant.sku ?? null,
    };
  });
}

export function shopifyProductToPilot(
  product: ShopifyProduct,
  config: PilotSourceConfig,
  discoveredAt: string,
  collectionPath?: string,
  collectionTitle?: string,
  verifiedCollectionCategory?: FootwearCategory,
): PilotProduct | null {
  const tags = normalizeTags(product.tags);
  const productType = product.product_type ?? "";
  const verifiedPaths = new Set(config.verifiedFootwearPaths ?? []);

  const fromVerifiedFootwearCollection = collectionPath
    ? verifiedPaths.has(collectionPath) || isVerifiedFootwearCollectionPath(collectionPath)
    : false;
  const gateInput = {
    title: product.title,
    officialProductUrl: canonicalProductUrl(config.baseUrl, product.handle),
    productType,
    tags,
    handle: product.handle,
    collectionPath,
    fromVerifiedFootwearCollection,
  };
  const gate = isTotemeSource(config)
    ? evaluateTotemeFootwearProduct(gateInput)
    : evaluateFootwearProduct(gateInput);

  if (gate.decision !== "ACCEPT_FOOTWEAR" || !gate.category) return null;
  // Dedicated collectors may prove opaque model categories through actual
  // membership in a pinned official footwear collection. Preserve raw fields.
  const footwearCategory = gate.category === "OTHER_FOOTWEAR" && fromVerifiedFootwearCollection
    ? verifiedCollectionCategory ?? gate.category : gate.category;
  // A collection can contain products with opaque names or mixed merchandise.
  // Apply the same independent review that onboarding uses before counting the
  // product as accepted, so one uncertain item cannot poison the whole batch.
  if (evaluateStoredPilotProduct({
    productName: product.title,
    productUrl: canonicalProductUrl(config.baseUrl, product.handle),
    category: footwearCategory,
    sourceDescription: product.body_html,
  }).decision !== "ACCEPT_FOOTWEAR") return null;
  const parsed = parseProductFieldsFromHtml(product.body_html ?? "");
  const color =
    extractPrimaryColor(product.options ?? [], product.variants ?? []) ??
    parsed.color;
  const shopifyDates = extractShopifyProductDates(product);
  const isNewCollection = isNewArrivalsCollectionPath(collectionPath);
  const hasNewBadge = detectNewBadgeInText(product.title, ...tags);
  const category = collectionPath
    ? collectionTitle
      ? {
          categoryId: slugifyCategoryId(collectionTitle),
          categoryName: collectionTitle,
          categoryPath: collectionPath,
          categoryUrl: `${config.baseUrl.replace(/\/$/, "")}${collectionPath}`,
        }
      : categoryFromCollectionPath(collectionPath, config.baseUrl)
    : null;
  const images = collectImages(product);

  return {
    source: config.id,
    sourceProductType: productType,
    sourceProductTags: tags,
    brand: config.brand,
    productName: product.title,
    productUrl: canonicalProductUrl(config.baseUrl, product.handle),
    imageUrl: images[0] ?? pickImage(product),
    images,
    category: footwearCategory,
    color,
    material: parsed.material,
    toeShape: parsed.toeShape,
    heelType: parsed.heelType,
    heelHeight: parsed.heelHeight,
    details: parsed.details,
    discoveredAt,
    collectionPath: collectionPath ?? null,
    collectionLabel: category?.categoryName ?? null,
    sourceCategoryId: category?.categoryId ?? null,
    sourceCategoryName: category?.categoryName ?? null,
    sourceCategoryPath: collectionPath ?? null,
    sourceCategoryUrl: category?.categoryUrl ?? null,
    sourceCategories: category ? [category] : [],
    isNewArrivalsCollection: isNewCollection,
    hasNewBadge,
    ...shopifyDates,
    variants: mapVariants(product),
  };
}

export function fullModeIgnoresLegacyCaps(collectMode: PilotSourceConfig["collectMode"]): boolean {
  return collectMode === "full";
}

export function shopifyPageLimitForMode(collectMode: PilotSourceConfig["collectMode"]): number {
  return collectMode === "full" ? FULL_COLLECTION_PAGE_CAP : LEGACY_COLLECTION_PAGE_CAP;
}

export function shopifyPerPageForMode(collectMode: PilotSourceConfig["collectMode"]): number {
  return collectMode === "full" ? FULL_PRODUCTS_PER_PAGE : 50;
}

async function paginateShopifyProductsJson(
  config: PilotSourceConfig,
  collectionPath: string | null,
  options: {
    discoveredAt: string;
    maxPages: number;
    perPage: number;
    ignoreProductCap: boolean;
    onRawProduct?: (product: ShopifyProduct, collectionPath: string | null) => void;
  },
): Promise<{
  products: PilotProduct[];
  discoveredLinks: Set<string>;
  errors: string[];
  pagesTraversed: number;
  exhausted: boolean;
  duplicateCount: number;
}> {
  const discoveredLinks = new Set<string>();
  const products: PilotProduct[] = [];
  const errors: string[] = [];
  const seenUrls = new Set<string>();
  let duplicateCount = 0;
  let pagesTraversed = 0;
  let exhausted = false;
  const pathSuffix = collectionPath ? `${collectionPath}/products.json` : "/products.json";

  for (let page = 1; page <= options.maxPages; page += 1) {
    if (!options.ignoreProductCap && products.length >= config.maxProducts) break;
    const url = `${config.baseUrl.replace(/\/$/, "")}${pathSuffix}?limit=${options.perPage}&page=${page}`;
    const result = await fetchJson<ShopifyProductsResponse>(url, 900);
    pagesTraversed = page;

    if (!result.ok || !result.data) {
      if (page === 1) errors.push(result.error ?? `Failed ${url}`);
      break;
    }

    const batch = result.data.products ?? [];
    if (batch.length === 0) {
      exhausted = true;
      pagesTraversed = Math.max(0, page - 1);
      break;
    }

    for (const raw of batch) {
      if (!options.ignoreProductCap && products.length >= config.maxProducts) break;
      const productUrl = canonicalProductUrl(config.baseUrl, raw.handle);
      discoveredLinks.add(productUrl);
      options.onRawProduct?.(raw, collectionPath);
      if (seenUrls.has(productUrl)) {
        duplicateCount += 1;
        continue;
      }
      const mapped = shopifyProductToPilot(
        raw,
        config,
        options.discoveredAt,
        collectionPath ?? undefined,
      );
      if (!mapped) continue;
      seenUrls.add(productUrl);
      products.push(mapped);
    }

    if (batch.length < options.perPage) {
      exhausted = true;
      break;
    }
    await sleep(700);
  }

  return {
    products,
    discoveredLinks,
    errors,
    pagesTraversed,
    exhausted,
    duplicateCount,
  };
}

export async function listShopifyCollections(
  baseUrl: string,
): Promise<{
  collections: Array<{ handle: string; title: string; productsCount: number }>;
  errors: string[];
}> {
  const collections: Array<{ handle: string; title: string; productsCount: number }> = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= 20; page += 1) {
    const url = `${baseUrl.replace(/\/$/, "")}/collections.json?limit=250&page=${page}`;
    const result = await fetchJson<ShopifyCollectionsResponse>(url, 800);
    if (!result.ok || !result.data) {
      if (page === 1) errors.push(result.error ?? `Failed ${url}`);
      break;
    }
    const batch = result.data.collections ?? [];
    if (batch.length === 0) break;
    for (const collection of batch) {
      if (!collection.handle) continue;
      const key = collection.handle.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      collections.push({
        handle: collection.handle,
        title: collection.title?.trim() || humanizeCollectionHandle(collection.handle),
        productsCount: collection.products_count ?? 0,
      });
    }
    if (batch.length < 250) break;
    await sleep(600);
  }
  return { collections, errors };
}

export async function fetchShopifyCollectionCounts(
  baseUrl: string,
): Promise<{ counts: Map<string, number>; errors: string[] }> {
  const counts = new Map<string, number>();
  const errors: string[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const url = `${baseUrl.replace(/\/$/, "")}/collections.json?limit=250&page=${page}`;
    const result = await fetchJson<ShopifyCollectionsResponse>(url, 800);
    if (!result.ok || !result.data) {
      if (page === 1) errors.push(result.error ?? `Failed ${url}`);
      break;
    }
    const batch = result.data.collections ?? [];
    if (batch.length === 0) break;
    for (const collection of batch) {
      if (!collection.handle) continue;
      counts.set(`/collections/${collection.handle}`.toLowerCase(), collection.products_count ?? 0);
    }
    if (batch.length < 250) break;
    await sleep(600);
  }
  return { counts, errors };
}

export function sourceReportedCountForPaths(
  counts: Map<string, number>,
  collectionPaths: readonly string[],
): number | null {
  return authoritativeFootwearReportedCount(counts, collectionPaths);
}

export async function collectShopifyCollectionProducts(
  config: PilotSourceConfig,
): Promise<{
  products: PilotProduct[];
  discoveredLinks: Set<string>;
  errors: string[];
}> {
  const fullCoverage = config.collectMode === "full";
  const discoveredAt = new Date().toISOString();
  const merged: PilotProduct[] = [];
  const discoveredLinks = new Set<string>();
  const errors: string[] = [];

  for (const collectionPath of config.collectionPaths) {
    if (!fullCoverage && merged.length >= config.maxProducts) break;
    const page = await paginateShopifyProductsJson(config, collectionPath, {
      discoveredAt,
      maxPages: shopifyPageLimitForMode(config.collectMode),
      perPage: shopifyPerPageForMode(config.collectMode),
      ignoreProductCap: fullCoverage,
    });
    for (const link of page.discoveredLinks) discoveredLinks.add(link);
    errors.push(...page.errors);
    merged.push(...page.products);
  }

  return {
    products: mergeProductCatalog([], merged),
    discoveredLinks,
    errors,
  };
}

export async function collectShopifyFootwearBackfill(
  config: PilotSourceConfig,
): Promise<{
  products: PilotProduct[];
  discoveredLinks: Set<string>;
  errors: string[];
  hitBackfillLimit: boolean;
  catalogFootwearCount: number;
  pagesTraversed: number;
  rawProductUrlsDiscovered: number;
  duplicateCount: number;
  paginationExhausted: boolean;
  sourceReportedProductCount: number | null;
  hitCollectionCrawlCap?: boolean;
  collectionsCrawled?: string[];
  totemeStats?: TotemeCollectStats;
}> {
  const fullCoverage = config.collectMode === "full";
  const backfillLimit = config.backfillLimit ?? config.maxProducts ?? LEGACY_BACKFILL_CAP;
  const discoveredAt = new Date().toISOString();
  const discoveredLinks = new Set<string>();
  const errors: string[] = [];
  let pagesTraversed = 0;
  let duplicateCount = 0;
  let paginationExhausted = true;
  let hitCollectionCrawlCap = false;
  const collected: PilotProduct[] = [];
  const totemeSource = isTotemeSource(config);
  const totemeStats = totemeSource ? emptyTotemeCollectStats() : undefined;
  const totemeSeen = new Set<string>();
  const totemeShoesPublished = new Set<string>();

  const listed = fullCoverage
    ? await listShopifyCollections(config.baseUrl)
    : { collections: [], errors: [] as string[] };
  errors.push(...listed.errors);
  const listedForSelect = totemeSource
    ? listed.collections.filter((collection) =>
        isTotemeFootwearCollection(collection.handle, collection.title),
      )
    : listed.collections;
  const preferredPaths = totemeSource
    ? config.collectionPaths.filter((path) => isTotemeFootwearCollectionPath(path))
    : config.collectionPaths;
  const selected = selectShopifyFootwearCollectionsToCrawl(
    listedForSelect,
    preferredPaths,
    FULL_COLLECTION_CRAWL_CAP,
  );
  hitCollectionCrawlCap = selected.hitCollectionCrawlCap;
  let collectionPaths =
    fullCoverage && selected.paths.length > 0 ? selected.paths : preferredPaths;
  if (totemeSource) {
    collectionPaths = collectionPaths.filter((path) => isTotemeFootwearCollectionPath(path));
    if (collectionPaths.length === 0) {
      errors.push("TOTEME: no verified footwear collections; refusing store-wide /products.json");
    }
  }

  const counts = new Map<string, number>();
  for (const collection of listedForSelect) {
    counts.set(`/collections/${collection.handle}`.toLowerCase(), collection.productsCount);
  }
  let sourceReportedProductCount = sourceReportedCountForPaths(counts, collectionPaths);
  if (totemeStats) {
    const shoesMeta = listed.collections.find((collection) => collection.handle.toLowerCase() === "shoes");
    totemeStats.shoesAdminProductCount = shoesMeta?.productsCount ?? counts.get("/collections/shoes") ?? null;
  }

  const recordTotemeRaw = (raw: ShopifyProduct, collectionPath: string | null, acceptIntoCatalog: boolean) => {
    if (!totemeStats) return;
    const productUrl = canonicalProductUrl(config.baseUrl, raw.handle);
    const tags = normalizeTags(raw.tags);
    const gateInput = {
      title: raw.title,
      productType: raw.product_type ?? "",
      tags,
      handle: raw.handle,
      collectionPath: collectionPath ?? undefined,
      fromVerifiedFootwearCollection: collectionPath
        ? isTotemeFootwearCollectionPath(collectionPath)
        : false,
    };
    const gate = evaluateTotemeFootwearProduct(gateInput);
    recordTotemeDecision(
      totemeStats,
      totemeSeen,
      productUrl,
      acceptIntoCatalog && gate.decision === "ACCEPT_FOOTWEAR",
      gateInput,
    );
    if (collectionPath?.toLowerCase() === "/collections/shoes") {
      totemeShoesPublished.add(productUrl);
    }
  };

  for (const collectionPath of collectionPaths) {
    const page = await paginateShopifyProductsJson(config, collectionPath, {
      discoveredAt,
      maxPages: fullCoverage ? FULL_COLLECTION_PAGE_CAP : 20,
      perPage: fullCoverage ? FULL_PRODUCTS_PER_PAGE : 50,
      ignoreProductCap: fullCoverage,
      onRawProduct: totemeSource
        ? (raw, path) => recordTotemeRaw(raw, path, true)
        : undefined,
    });
    pagesTraversed += page.pagesTraversed;
    duplicateCount += page.duplicateCount;
    paginationExhausted = paginationExhausted && page.exhausted;
    for (const link of page.discoveredLinks) discoveredLinks.add(link);
    errors.push(...page.errors);
    collected.push(...page.products);
  }

  if (totemeSource && totemeStats) {
    totemeStats.collectionsCrawled = [...collectionPaths];
    if (totemeShoesPublished.size > 0) {
      totemeStats.shoesPublishedProductCount = totemeShoesPublished.size;
    }
    if (
      typeof totemeStats.shoesAdminProductCount === "number" &&
      totemeStats.shoesAdminProductCount > 0
    ) {
      sourceReportedProductCount = totemeStats.shoesAdminProductCount;
    }
    const auditCollections = listed.collections.filter((collection) =>
      isTotemeAuditCollection(collection.handle, collection.title),
    );
    for (const collection of auditCollections) {
      const collectionPath = `/collections/${collection.handle}`;
      totemeStats.auditCollections.push(collectionPath);
      const page = await paginateShopifyProductsJson(config, collectionPath, {
        discoveredAt,
        maxPages: fullCoverage ? FULL_COLLECTION_PAGE_CAP : 20,
        perPage: fullCoverage ? FULL_PRODUCTS_PER_PAGE : 50,
        ignoreProductCap: true,
        onRawProduct: (raw, path) => recordTotemeRaw(raw, path, false),
      });
      pagesTraversed += page.pagesTraversed;
      errors.push(...page.errors);
      for (const link of page.discoveredLinks) discoveredLinks.add(link);
    }
  }

  const merged = mergeProductCatalog([], collected);
  const sorted = sortProductsNewestFirst(merged);
  const hitBackfillLimit = !fullCoverage && sorted.length > backfillLimit;

  return {
    products: fullCoverage ? sorted : sorted.slice(0, backfillLimit),
    discoveredLinks,
    errors,
    hitBackfillLimit,
    catalogFootwearCount: sorted.length,
    pagesTraversed,
    rawProductUrlsDiscovered: discoveredLinks.size,
    duplicateCount,
    paginationExhausted,
    sourceReportedProductCount,
    hitCollectionCrawlCap,
    collectionsCrawled: collectionPaths,
    totemeStats,
  };
}
