import { normalizeProductImageUrls } from "../../images/resolveImageQuality";
import { looksLikeBotChallenge } from "../../onboarding/platforms";
import { FULL_COLLECTION_PAGE_CAP, FULL_PRODUCTS_PER_PAGE } from "../../collector/fullCoveragePaths";
import {
  collectionPath,
  isVerifiedFootwearCatalogPath,
  planWomensCollections,
  type CollectionPlan,
  type ShopifyCollectionRecord,
} from "./collections";
import { buildWaveCoverage, fullCatalogPassBlocker } from "./coverage";
import { classifyWomensFootwear } from "./footwearScope";
import { groupColorwaysIntoFamilies, type FamilyProduct } from "./families";
import { detectNewBadgeInText } from "../../newArrivals/detectNewness";
import { assignProductNewness } from "./newness";
import type { WaveBrandSeed, WaveCatalog, WaveHttp, WaveHttpResponse } from "./types";

interface ShopifyImage {
  src?: string;
}

interface ShopifyVariant {
  title?: string;
  sku?: string | null;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  featured_image?: { src?: string } | null;
}

interface ShopifyOption {
  name?: string;
  values?: string[];
}

interface ShopifyProduct {
  id?: number;
  title?: string;
  handle?: string;
  product_type?: string;
  tags?: string[] | string;
  images?: ShopifyImage[];
  variants?: ShopifyVariant[];
  options?: ShopifyOption[];
}

interface ShopifyProductsResponse {
  products?: ShopifyProduct[];
}

interface ShopifyCollectionsResponse {
  collections?: Array<{ handle?: string; title?: string; products_count?: number }>;
}

function asTags(value: string[] | string | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value.map((tag) => tag.trim()).filter(Boolean) : value.split(",").map((tag) => tag.trim()).filter(Boolean);
}

function productImages(product: ShopifyProduct): string[] {
  return normalizeProductImageUrls([
    ...(product.images ?? []).map((image) => image.src),
    ...(product.variants ?? []).map((variant) => variant.featured_image?.src),
  ]);
}

function colorFromOptions(product: ShopifyProduct): string | null {
  const options = product.options ?? [];
  const colorIndex = options.findIndex((option) => /color|colour/i.test(option.name ?? ""));
  if (colorIndex < 0) return null;
  const values = new Set<string>();
  for (const variant of product.variants ?? []) {
    const value = colorIndex === 0 ? variant.option1 : colorIndex === 1 ? variant.option2 : variant.option3;
    if (value?.trim()) values.add(value.trim());
  }
  if (values.size === 1) return [...values][0] ?? null;
  return null;
}

async function fetchJsonPage(http: WaveHttp, url: string): Promise<WaveHttpResponse> {
  return http.fetch(url);
}

export async function listAllShopifyCollections(
  http: WaveHttp,
  baseUrl: string,
): Promise<{ collections: ShopifyCollectionRecord[]; error: string | null }> {
  const collections: ShopifyCollectionRecord[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= 20; page += 1) {
    const response = await fetchJsonPage(
      http,
      `${baseUrl}/collections.json?limit=250&page=${page}`,
    );
    if (!response.ok || !response.data || typeof response.data !== "object") {
      return { collections, error: response.error ?? `collections.json HTTP ${response.status} page ${page}` };
    }
    const batch = (response.data as ShopifyCollectionsResponse).collections;
    if (!Array.isArray(batch)) return { collections, error: "INVALID_COLLECTION_LIST_PAYLOAD" };
    if (batch.length === 0) break;
    for (const collection of batch) {
      const handle = collection.handle?.trim();
      if (!handle || seen.has(handle.toLowerCase())) continue;
      seen.add(handle.toLowerCase());
      collections.push({
        handle,
        title: collection.title?.trim() || handle,
        productsCount: collection.products_count ?? 0,
      });
    }
    if (batch.length < 250) break;
    if (page === 20) return { collections, error: "COLLECTION_LIST_PAGE_CAP" };
  }
  return { collections, error: null };
}

export async function paginateCollectionProducts(
  http: WaveHttp,
  baseUrl: string,
  collectionPath: string,
): Promise<{ products: ShopifyProduct[]; exhausted: boolean; error: string | null; pages: number }> {
  const products: ShopifyProduct[] = [];
  let exhausted = false;
  let pages = 0;
  for (let page = 1; page <= FULL_COLLECTION_PAGE_CAP; page += 1) {
    const response = await fetchJsonPage(
      http,
      `${baseUrl}${collectionPath}/products.json?limit=${FULL_PRODUCTS_PER_PAGE}&page=${page}`,
    );
    pages = page;
    if (!response.ok || !response.data || typeof response.data !== "object") {
      if (page === 1) {
        return { products, exhausted: false, error: response.error ?? `HTTP ${response.status}`, pages: 0 };
      }
      return { products, exhausted: false, error: response.error ?? `HTTP ${response.status} page ${page}`, pages: page - 1 };
    }
    const batch = (response.data as ShopifyProductsResponse).products;
    if (!Array.isArray(batch)) return { products, exhausted: false, error: "INVALID_PRODUCTS_PAYLOAD", pages };
    if (batch.length === 0) {
      exhausted = true;
      pages = page - 1;
      break;
    }
    products.push(...batch);
    if (batch.length < FULL_PRODUCTS_PER_PAGE) {
      exhausted = true;
      break;
    }
  }
  if (pages >= FULL_COLLECTION_PAGE_CAP && !exhausted) {
    return { products, exhausted: false, error: "PAGE_CAP", pages };
  }
  return { products, exhausted, error: null, pages };
}

export interface ShopifyCollectResult {
  catalog: WaveCatalog | null;
  blocker: string | null;
  coverage: WaveCatalog["coverage"] | null;
}

async function sampleMixedFootwearAcceptance(
  http: WaveHttp,
  baseUrl: string,
  handle: string,
): Promise<number | null> {
  const response = await fetchJsonPage(
    http,
    `${baseUrl}/collections/${handle}/products.json?limit=50&page=1`,
  );
  if (!response.ok || !response.data || typeof response.data !== "object") return null;
  const products = (response.data as ShopifyProductsResponse).products ?? [];
  if (products.length < 20) return null;
  let footwear = 0;
  for (const product of products) {
    const title = product.title?.trim();
    const handleValue = product.handle?.trim();
    if (!title || !handleValue) continue;
    const scope = classifyWomensFootwear({
      title,
      productType: product.product_type,
      tags: asTags(product.tags),
      handle: handleValue,
    });
    if (scope.decision === "footwear") footwear += 1;
  }
  return footwear / products.length;
}

async function resolveCollectionPlan(
  http: WaveHttp,
  baseUrl: string,
  collections: readonly ShopifyCollectionRecord[],
  seed: WaveBrandSeed,
): Promise<CollectionPlan> {
  const plan = planWomensCollections(collections, seed);
  if (seed.womenCollectionPath || !plan.authoritative) return plan;
  const mixed = collections
    .filter((collection) => collection.handle === "all" || collection.handle === "shop-all")
    .sort((a, b) => b.productsCount - a.productsCount)[0];
  const dedicatedPlan =
    plan.catalogPaths.length > 0 && plan.catalogPaths.every((path) => isVerifiedFootwearCatalogPath(path));
  if (!mixed || !dedicatedPlan || plan.catalogPaths.some((path) => path.endsWith(`/${mixed.handle}`))) {
    return plan;
  }
  const acceptance = await sampleMixedFootwearAcceptance(http, baseUrl, mixed.handle);
  if (acceptance !== null && acceptance >= 0.5) {
    return { ...plan, catalogPaths: [collectionPath(mixed.handle)] };
  }
  return plan;
}

export async function collectShopifyWomensCatalog(input: {
  seed: WaveBrandSeed;
  http: WaveHttp;
  now: string;
  previousUrls: ReadonlySet<string> | null;
  baseUrl?: string;
}): Promise<ShopifyCollectResult> {
  const baseUrl = (input.baseUrl ?? input.seed.officialUrl).replace(/\/$/, "");
  const listed = await listAllShopifyCollections(input.http, baseUrl);
  const plan = await resolveCollectionPlan(input.http, baseUrl, listed.collections, input.seed);
  if (!plan.authoritative || plan.catalogPaths.length === 0) {
    const coverage = buildWaveCoverage({
      sourceTotal: null,
      collected: 0,
      excluded: 0,
      paginationExhausted: false,
      galleryComplete: 0,
      taxonomyPassed: false,
      womenFootwearOnly: false,
      sampleOnly: false,
    });
    return { catalog: null, blocker: plan.reason ?? listed.error ?? "NO_AUTHORITATIVE_WOMENS_COLLECTION", coverage };
  }

  const rawByHandle = new Map<string, ShopifyProduct>();
  let paginationExhausted = !listed.error;
  const errors: string[] = listed.error ? [listed.error] : [];
  for (const path of plan.catalogPaths) {
    const page = await paginateCollectionProducts(input.http, baseUrl, path);
    if (!page.exhausted || page.error) {
      paginationExhausted = false;
      if (page.error) errors.push(`${path}: ${page.error}`);
    }
    for (const product of page.products) {
      const handle = product.handle?.trim();
      if (!handle) continue;
      if (!rawByHandle.has(handle.toLowerCase())) rawByHandle.set(handle.toLowerCase(), product);
    }
  }

  const newArrivalHandles = new Set<string>();
  for (const path of plan.newArrivalsPaths) {
    const page = await paginateCollectionProducts(input.http, baseUrl, path);
    if (!page.exhausted || page.error) {
      paginationExhausted = false;
      if (page.error) errors.push(`${path}: ${page.error}`);
    }
    for (const product of page.products) {
      const handle = product.handle?.trim().toLowerCase();
      if (handle) newArrivalHandles.add(handle);
    }
  }

  const verifiedFootwearCollection = plan.catalogPaths.every((path) => isVerifiedFootwearCatalogPath(path));
  const footwear: FamilyProduct[] = [];
  let excluded = 0;
  for (const product of rawByHandle.values()) {
    const handle = product.handle?.trim();
    const title = product.title?.trim();
    if (!handle || !title) {
      excluded += 1;
      continue;
    }
    const tags = asTags(product.tags);
    const scope = classifyWomensFootwear({
      title,
      productType: product.product_type,
      tags,
      handle,
      fromVerifiedFootwearCollection: verifiedFootwearCollection,
    });
    if (scope.decision !== "footwear") {
      excluded += 1;
      continue;
    }
    const productUrl = `${baseUrl}/products/${handle}`;
    const inNewArrivals = newArrivalHandles.has(handle.toLowerCase());
    const newness = assignProductNewness(
      { productUrl, inNewArrivals, hasNewBadge: detectNewBadgeInText(...tags) },
      input.previousUrls,
    );
    footwear.push({
      handle,
      productUrl,
      title,
      color: colorFromOptions(product),
      sku: product.variants?.find((variant) => variant.sku)?.sku ?? null,
      images: productImages(product),
      category: scope.category,
      productType: product.product_type ?? "",
      tags,
      inNewArrivals,
      isNew: newness.isNew,
      newnessEvidence: newness.newnessEvidence,
    });
  }

  const newArrivalsFootwear = footwear.filter((product) => product.inNewArrivals).length;
  const galleryComplete = footwear.filter((product) => product.images.length > 0).length;
  const taxonomyPassed = footwear.length > 0 && footwear.every((product) => Boolean(product.category));
  const fetchedCount = rawByHandle.size;
  const acceptance = fetchedCount === 0 ? 1 : footwear.length / fetchedCount;
  const gateIncomplete = fetchedCount >= 30 && acceptance < 0.25;
  const coverage = buildWaveCoverage({
    sourceTotal: gateIncomplete ? fetchedCount : paginationExhausted ? footwear.length : null,
    collected: footwear.length,
    excluded,
    paginationExhausted,
    galleryComplete,
    taxonomyPassed,
    womenFootwearOnly: true,
    sampleOnly: false,
  });

  const families = groupColorwaysIntoFamilies(input.seed.brand, input.seed.slug, footwear);
  const referenceFootwearTotal = input.seed.referenceFootwearTotal ?? null;
  const referenceNewArrivals = input.seed.referenceNewArrivals ?? null;
  const catalog: WaveCatalog = {
    slug: input.seed.slug,
    brand: input.seed.brand,
    officialUrl: input.seed.officialUrl,
    snapshotId: `${input.seed.slug}:${input.now}`,
    collectedAt: input.now,
    catalogPaths: plan.catalogPaths,
    newArrivalsPaths: plan.newArrivalsPaths,
    coverage,
    newArrivalsFootwear,
    referenceFootwearTotal,
    referenceNewArrivals,
    referenceFootwearMatch:
      referenceFootwearTotal === null ? null : footwear.length === referenceFootwearTotal,
    referenceNewArrivalsMatch:
      referenceNewArrivals === null ? null : newArrivalsFootwear === referenceNewArrivals,
    families,
    productUrls: footwear.map((product) => product.productUrl),
  };

  const blocker = fullCatalogPassBlocker(coverage) ?? (errors.length ? errors.join("; ") : null);
  return { catalog, blocker, coverage };
}

export function classifyStorefrontResponse(input: {
  homepage: WaveHttpResponse | null;
  products: WaveHttpResponse | null;
  collections: WaveHttpResponse | null;
}): "ACCESSIBLE" | "SOURCE_UNAVAILABLE" | "CUSTOM_ADAPTER_REQUIRED" {
  const jsonReady = (response: WaveHttpResponse | null): boolean => {
    if (!response?.ok || !response.data || typeof response.data !== "object") return false;
    const record = response.data as { products?: unknown; collections?: unknown };
    return Array.isArray(record.products) || Array.isArray(record.collections);
  };
  if (jsonReady(input.products) || jsonReady(input.collections)) return "ACCESSIBLE";

  const blocked = [input.homepage, input.products, input.collections].filter(
    (response): response is WaveHttpResponse => Boolean(response),
  );
  const unavailable = blocked.some((response) => {
    if (response.status === 0 || response.status === 401 || response.status === 403 || response.status === 429) {
      return true;
    }
    if (response.status >= 500) return true;
    return looksLikeBotChallenge(response.text, response.status);
  });
  const homepageOk = input.homepage?.ok === true && input.homepage.status >= 200 && input.homepage.status < 400;
  if (!homepageOk || unavailable) return "SOURCE_UNAVAILABLE";
  return "CUSTOM_ADAPTER_REQUIRED";
}
