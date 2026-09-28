import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { analyzeProducts } from "../analysis/analyzeProduct";
import { buildModelFamilies } from "../modelFamily/buildFamilies";
import type { MarketplaceGateReport } from "../marketplaces/automation";
import { isExcludedMarketplaceBrand } from "../marketplaces/marketplacePolicy";
import { fetchText, sleep } from "./http";
import { isMensOnlyProduct } from "./footwearGate";
import { shopifyProductToPilot } from "./shopify";
import type { FootwearCategory, PilotProduct, PilotSourceConfig } from "./types";

export const BROWNS_ID = "browns";
export const BROWNS_ORIGIN = "https://www.brownsfashion.com";
export const BROWNS_COLLECTION_PATH = "/collections/woman-shoes";
export const BROWNS_COLLECTION_URL = `${BROWNS_ORIGIN}${BROWNS_COLLECTION_PATH}`;
export const BROWNS_REFRESH_COMMAND = "npm run collect:browns";
export const BROWNS_PERIODIC_REFRESH = false;

const PAGE_SIZE = 50;
const MAX_PAGES = 80;
const CLASSIFIED = new Set<FootwearCategory>([
  "BOOT",
  "ANKLE_BOOT",
  "PUMP",
  "SLINGBACK",
  "BALLERINA",
  "MARY_JANE",
  "LOAFER",
  "MULE",
  "SANDAL",
  "THONG",
  "WEDGE",
  "SNEAKER",
]);

const SWATCH_IMAGE = /swatch|color[-_]?chip|colour[-_]?chip|color[-_]?swatch/i;

export interface BrownsRawProduct {
  id: number;
  title: string;
  handle: string;
  vendor?: string;
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

interface ShopifyProductsResponse {
  products?: BrownsRawProduct[];
}

interface ShopifyCollectionResponse {
  collection?: { products_count?: number; handle?: string; title?: string };
}

export interface BrownsHttp {
  text: (url: string) => Promise<{ ok: boolean; status: number; text: string; error?: string }>;
  json: <T>(url: string) => Promise<{ ok: boolean; status: number; data: T | null; error?: string }>;
}

export interface BrownsCoverage {
  source: typeof BROWNS_ID;
  sourceUrl: string;
  collectedAt: string;
  pagesVisited: number;
  storefrontProductCount: number | null;
  collectionResourceCount: number | null;
  fetchedProducts: number;
  scopeExcluded: number;
  scopeExclusionReasons: Record<string, number>;
  acceptedFootwear: number;
  quarantined: number;
  quarantineReasons: Record<string, number>;
  modelFamilies: number | null;
  status: "FULL" | "PARTIAL" | "FAILED";
  paginationExhausted: boolean;
  baselineNewArrivals: number;
  refreshCommand: typeof BROWNS_REFRESH_COMMAND;
  periodicRefresh: false;
  blocker: string | null;
  note: string;
}

export interface BrownsCollectResult {
  products: PilotProduct[];
  quarantined: Array<{ productUrl: string; title: string; reasons: string[] }>;
  coverage: BrownsCoverage;
}

function normalizeTags(tags: string[] | string | undefined): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map((tag) => tag.trim()).filter(Boolean);
  return tags.split(",").map((tag) => tag.trim()).filter(Boolean);
}

export function parseBrownsStorefrontProductCount(html: string, handle: string): number | null {
  const pattern = new RegExp(
    `handle:\\s*"${handle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[\\s\\S]{0,180}?productCount:\\s*parseInt\\("(\\d+)"\\)`,
    "g",
  );
  const counts = [...html.matchAll(pattern)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isInteger(value) && value >= 0);
  const distinct = [...new Set(counts)];
  if (distinct.length !== 1) return null;
  return distinct[0] ?? null;
}

export function isBrownsColorSwatchImage(url: string): boolean {
  return SWATCH_IMAGE.test(url);
}

export function brownsFootwearType(raw: Pick<BrownsRawProduct, "title" | "product_type" | "tags">): string | null {
  const tags = normalizeTags(raw.tags);
  const text = [raw.title, raw.product_type, ...tags].join(" ");
  const rules: Array<[RegExp, string]> = [
    [/flip[- ]?flops?|\bslides?\b/i, "Flip Flop"],
    [/ankle[- ]?boots?/i, "Ankle Boot"],
    [/\bboots?\b|knee[- ]high/i, "Boot"],
    [/sling[- ]?backs?/i, "Slingback"],
    [/trainers?|sneakers?|low[- ]?tops?/i, "Sneaker"],
    [/ballerinas?|ballet/i, "Ballerina"],
    [/loafers?|moccasins?/i, "Loafer"],
    [/mules?/i, "Mule"],
    [/wedges?/i, "Wedge"],
    [/espadrilles?/i, "Espadrille Sandal"],
    [/pumps?|\bheels?\b/i, "Pump"],
    [/sandals?/i, "Sandal"],
    [/slippers?/i, "Mule"],
    [/derby|oxford|brogues?|boat shoes?/i, "Loafer"],
    [/\bflats?\b/i, "Ballerina"],
  ];
  for (const [pattern, productType] of rules) {
    if (pattern.test(text)) return productType;
  }
  return null;
}

export function isBrownsNonWomens(tags: readonly string[]): boolean {
  const hasWomen = tags.some((tag) => /\bwomen\b|\bwoman\b/i.test(tag));
  const hasMen = tags.some((tag) => /^men$/i.test(tag) || /^mens$/i.test(tag) || /^men's$/i.test(tag));
  return hasMen && !hasWomen;
}

function withoutSwatches(urls: Array<string | null | undefined>): string[] {
  return urls.filter((url): url is string => Boolean(url) && !isBrownsColorSwatchImage(url));
}

function tagsForGate(tags: readonly string[], footwearType: string | null): string[] {
  const gateTags = tags.filter((tag) => !(footwearType && /\baccessories\b/i.test(tag)));
  if (tags.some((tag) => /\bwomen\b|\bwoman\b/i.test(tag))) gateTags.push("womens");
  return gateTags;
}

export function isBrownsSportsProduct(vendor: string, title: string): boolean {
  return isExcludedMarketplaceBrand(vendor) || isExcludedMarketplaceBrand(title) || /\bjordan\b/i.test(`${vendor} ${title}`);
}

export function brownsRawProductToPilot(raw: BrownsRawProduct, discoveredAt: string): PilotProduct | null {
  const vendor = (raw.vendor ?? "").trim().replace(/\s+/g, " ");
  if (!vendor) return null;
  const tags = normalizeTags(raw.tags);
  const footwearType = brownsFootwearType(raw);
  const config: PilotSourceConfig = {
    id: BROWNS_ID,
    brand: vendor,
    baseUrl: BROWNS_ORIGIN,
    collectionPaths: [BROWNS_COLLECTION_PATH],
    verifiedFootwearPaths: [BROWNS_COLLECTION_PATH],
    maxProducts: 10_000,
    collectMode: "full",
  };
  const prepared = {
    ...raw,
    tags: tagsForGate(tags, footwearType),
    product_type: footwearType ?? raw.product_type,
  };
  let product = shopifyProductToPilot(
    prepared,
    config,
    discoveredAt,
    BROWNS_COLLECTION_PATH,
    "Women's Designer Shoes",
  );
  if (!product && footwearType && /\btop\b/i.test(`${raw.title} ${raw.handle}`)) {
    product = shopifyProductToPilot(
      {
        ...prepared,
        title: raw.title.replace(/\btop\b/gi, " ").replace(/\s+/g, " ").trim(),
        handle: raw.handle.replace(/-?top-?/gi, "-").replace(/--+/g, "-").replace(/^-|-$/g, ""),
      },
      config,
      discoveredAt,
      BROWNS_COLLECTION_PATH,
      "Women's Designer Shoes",
    );
    if (product) {
      product = {
        ...product,
        productName: raw.title,
        productUrl: `${BROWNS_ORIGIN}/products/${raw.handle}`,
      };
    }
  }
  if (!product) return null;
  const images = withoutSwatches(product.images ?? []);
  const imageUrl = images[0] ?? null;
  return {
    ...product,
    source: BROWNS_ID,
    brand: vendor,
    imageUrl,
    images,
    color: product.color,
    isNewArrivalsCollection: false,
    hasNewBadge: false,
  };
}

function bump(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

const defaultHttp = (): BrownsHttp => ({
  text: async (url) => fetchText(url, { delayMs: 250 }),
  json: async <T>(url: string) => {
    const response = await fetchText(url, { delayMs: 250 });
    if (!response.ok) {
      return { ok: false, status: response.status, data: null, error: response.error ?? `HTTP ${response.status} for ${url}` };
    }
    try {
      return { ok: true, status: response.status, data: JSON.parse(response.text) as T };
    } catch {
      return { ok: false, status: response.status, data: null, error: `Invalid JSON from ${url}` };
    }
  },
});

export async function collectBrowns(options?: {
  now?: string;
  http?: BrownsHttp;
}): Promise<BrownsCollectResult> {
  const collectedAt = options?.now ?? new Date().toISOString();
  const http = options?.http ?? defaultHttp();
  const errors: string[] = [];
  const listing = await http.text(BROWNS_COLLECTION_URL);
  const storefrontProductCount = listing.ok
    ? parseBrownsStorefrontProductCount(listing.text, "woman-shoes")
    : null;
  if (!listing.ok) errors.push(listing.error ?? `Unable to read ${BROWNS_COLLECTION_URL}`);

  const resource = await http.json<ShopifyCollectionResponse>(`${BROWNS_COLLECTION_URL}.json`);
  const collectionResourceCount = resource.ok
    ? resource.data?.collection?.products_count ?? null
    : null;
  if (!resource.ok) errors.push(resource.error ?? `Unable to read ${BROWNS_COLLECTION_URL}.json`);

  const rawById = new Map<number, BrownsRawProduct>();
  let pagesVisited = 0;
  let paginationExhausted = false;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `${BROWNS_COLLECTION_URL}/products.json?limit=${PAGE_SIZE}&page=${page}`;
    const response = await http.json<ShopifyProductsResponse>(url);
    if (!response.ok || !response.data) {
      errors.push(response.error ?? `Unable to read ${url}`);
      break;
    }
    const batch = response.data.products ?? [];
    pagesVisited = page;
    if (batch.length === 0) {
      paginationExhausted = true;
      break;
    }
    let added = 0;
    for (const raw of batch) {
      if (!Number.isFinite(raw.id) || rawById.has(raw.id)) continue;
      rawById.set(raw.id, raw);
      added += 1;
    }
    if (added === 0) break;
    if (batch.length < PAGE_SIZE) {
      paginationExhausted = true;
      break;
    }
    await sleep(100);
  }

  const scopeExclusionReasons: Record<string, number> = {};
  const quarantineReasons: Record<string, number> = {};
  const quarantined: BrownsCollectResult["quarantined"] = [];
  const products: PilotProduct[] = [];
  let baselineNewArrivals = 0;

  for (const raw of rawById.values()) {
    const tags = normalizeTags(raw.tags);
    const vendor = (raw.vendor ?? "").trim();
    const productUrl = `${BROWNS_ORIGIN}/products/${raw.handle}`;
    if (isBrownsSportsProduct(vendor, raw.title)) {
      bump(scopeExclusionReasons, "sports-brand");
      continue;
    }
    if (
      isBrownsNonWomens(tags) ||
      isMensOnlyProduct({ title: raw.title, productType: vendor, tags: [], handle: raw.handle })
    ) {
      bump(scopeExclusionReasons, "non-womens");
      continue;
    }
    const product = brownsRawProductToPilot(raw, collectedAt);
    const reasons: string[] = [];
    if (!product) reasons.push("footwear-filter");
    else {
      if (!product.category || !CLASSIFIED.has(product.category)) reasons.push("unresolved-category");
      if (!product.imageUrl) reasons.push("missing-image");
      if (product.isNewArrivalsCollection || product.hasNewBadge) {
        baselineNewArrivals += 1;
        reasons.push("baseline-new");
      }
      if ("price" in product) reasons.push("price-present");
    }
    if (reasons.length > 0 || !product) {
      for (const reason of reasons.length ? reasons : ["footwear-filter"]) bump(quarantineReasons, reason);
      quarantined.push({ productUrl, title: raw.title, reasons: reasons.length ? reasons : ["footwear-filter"] });
      continue;
    }
    products.push(product);
  }

  const scopeExcluded = Object.values(scopeExclusionReasons).reduce((sum, count) => sum + count, 0);
  const fetchedProducts = rawById.size;
  const reconciled =
    storefrontProductCount !== null &&
    paginationExhausted &&
    errors.length === 0 &&
    fetchedProducts === storefrontProductCount &&
    products.length + scopeExcluded + quarantined.length === fetchedProducts;
  let status: BrownsCoverage["status"] = "PARTIAL";
  let blocker: string | null = null;
  if (!listing.ok && fetchedProducts === 0) {
    status = "FAILED";
    blocker = errors[0] ?? "Browns collection page was unavailable";
  } else if (!reconciled) {
    status = "PARTIAL";
    blocker = storefrontProductCount === null
      ? "Browns storefront product count is unknown"
      : !paginationExhausted
        ? `Browns pagination stopped at ${fetchedProducts} products before the storefront count ${storefrontProductCount}`
        : `Browns fetched ${fetchedProducts} products; storefront count is ${storefrontProductCount}`;
  } else if (products.length === 0) {
    status = "PARTIAL";
    blocker = "Browns eligible women's footwear catalog is empty";
  } else if (quarantined.length > 0 || baselineNewArrivals > 0) {
    status = "PARTIAL";
    blocker = `Browns collection reconciled at ${storefrontProductCount}, with ${quarantined.length} product(s) held out of the catalog`;
  } else {
    status = "FULL";
  }

  return {
    products,
    quarantined,
    coverage: {
      source: BROWNS_ID,
      sourceUrl: BROWNS_COLLECTION_URL,
      collectedAt,
      pagesVisited,
      storefrontProductCount,
      collectionResourceCount,
      fetchedProducts,
      scopeExcluded,
      scopeExclusionReasons,
      acceptedFootwear: products.length,
      quarantined: quarantined.length,
      quarantineReasons,
      modelFamilies: null,
      status,
      paginationExhausted,
      baselineNewArrivals,
      refreshCommand: BROWNS_REFRESH_COMMAND,
      periodicRefresh: false,
      blocker,
      note: "woman-shoes is the customer-facing Women's Designer Shoes collection. The duplicate women-shoes handle is not collected again. products_count is recorded and is not the storefront total. First import is not New Arrivals. Prices are omitted. This collector is not on the periodic marketplace refresh line.",
    },
  };
}

export function brownsPublicationBlocker(result: BrownsCollectResult): string | null {
  const coverage = result.coverage;
  if (coverage.storefrontProductCount === null || !coverage.paginationExhausted) {
    return coverage.blocker ?? "Browns pagination is not reconciled";
  }
  if (coverage.fetchedProducts !== coverage.storefrontProductCount) {
    return coverage.blocker ?? "Browns fetched count does not match the storefront";
  }
  if (result.products.length === 0) return "Browns eligible women's footwear catalog is empty";
  if (coverage.baselineNewArrivals !== 0) return "baseline contains NEW products";
  if (result.products.some((product) => product.isNewArrivalsCollection || product.hasNewBadge)) {
    return "baseline contains NEW products";
  }
  if (result.products.some((product) => "price" in product)) return "price field present";
  const urls = new Set<string>();
  for (const product of result.products) {
    if (urls.has(product.productUrl)) return "duplicate product URL";
    urls.add(product.productUrl);
  }
  return null;
}

async function atomicWriteJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(value));
  await rename(temporary, path);
}

export async function publishBrownsCatalog(
  root: string,
  result: BrownsCollectResult,
): Promise<{ published: boolean; reason: string | null; modelFamilies: number }> {
  const blocker = brownsPublicationBlocker(result);
  if (blocker) return { published: false, reason: blocker, modelFamilies: 0 };

  const { families } = buildModelFamilies(analyzeProducts(result.products as never) as never);
  const unresolved = families.filter(
    (family) => !family.primaryCategory || family.primaryCategory === "UNCLASSIFIED" || family.primaryCategory === "OTHER_FOOTWEAR",
  );
  if (families.length === 0 || unresolved.length > 0) {
    return {
      published: false,
      reason: `TAXONOMY_BLOCKED:${unresolved.length || families.length}`,
      modelFamilies: families.length,
    };
  }

  const publicationCoverage = result.coverage.status === "FULL" ? "FULL" : "PARTIAL";
  const report: MarketplaceGateReport = {
    publicationCoverage,
    quarantinedProducts: result.quarantined.length,
    sourceId: BROWNS_ID,
    accepted: true,
    decision: "PUBLISH_TO_PROPOSAL",
    reasons: [],
    coverageStatus: publicationCoverage,
    sourceTotal: result.coverage.storefrontProductCount,
    rawCollected: result.coverage.fetchedProducts,
    eligibleTotal: result.products.length,
    candidateProducts: result.products.length,
    eligibleProducts: result.products.length,
    excludedByPolicy: result.coverage.scopeExcluded,
    productsWithImages: result.products.length,
    productsWithTaxonomy: result.products.length,
    duplicateUrls: 0,
    crossSourceUrlCollisions: 0,
    baseline: true,
    baselineVerifiedNewProducts: 0,
    priceHidden: true,
    previousLastGoodProducts: 0,
    previousPolicyEligibleProducts: 0,
    lastGoodRetentionRatio: null,
    minimumLastGoodRetentionRatio: 0.6,
    lastGoodPreserved: false,
  };
  await atomicWriteJson(join(root, "data/multibrand/model-families/marketplaces/browns.json"), {
    sourceId: BROWNS_ID,
    origin: BROWNS_ORIGIN,
    updatedAt: result.coverage.collectedAt,
    products: result.products,
    families,
    report,
    quarantined: result.quarantined.map((item) => ({
      product: {
        source: BROWNS_ID,
        brand: "",
        productName: item.title,
        productUrl: item.productUrl,
        imageUrl: null,
        category: null,
        color: null,
        material: null,
        toeShape: null,
        heelType: null,
        heelHeight: null,
        details: null,
        discoveredAt: result.coverage.collectedAt,
        isNewArrivalsCollection: false,
        hasNewBadge: false,
        variants: [],
      },
      reasons: item.reasons,
    })),
  });

  const pilotPath = join(root, "data/registry/marketplace-pilot.json");
  const pilot = JSON.parse(await readFile(pilotPath, "utf8")) as {
    activePilotId: string;
    activeMarketplaceIds?: string[];
    mytheresaStatus: string;
    notes?: string;
  };
  const ids = new Set(pilot.activeMarketplaceIds ?? []);
  ids.add(BROWNS_ID);
  pilot.activeMarketplaceIds = [...ids];
  const note = "Browns women's designer shoes are collected from the public Shopify catalog and are not on the periodic marketplace refresh line.";
  if (!pilot.notes?.includes("Browns women's designer shoes")) {
    pilot.notes = pilot.notes ? `${pilot.notes} ${note}` : note;
  }
  await mkdir(dirname(pilotPath), { recursive: true });
  const temporary = `${pilotPath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(pilot, null, 2)}\n`, "utf8");
  await rename(temporary, pilotPath);
  return { published: true, reason: null, modelFamilies: families.length };
}
