import type { MarketResearchMappedCategoryId } from "../../types";
import type {
  FetchHtml,
  RomaniaCollectedProduct,
  RomaniaSourceCoverageReport,
  RomaniaSourceStagingResult,
} from "./types";

export const PAPUCEI_SOURCE = {
  id: "papucei",
  name: "Papucei",
  sales_market: "RO" as const,
  entity_kind: "brand" as const,
  category_url: "https://www.papucei.ro/en/products-category/footwear/",
};

const PAPUCEI_ORIGIN = "https://www.papucei.ro";
const PRODUCT_PATH = "/en/product/";
const CATEGORY_PATH = "/en/products-category/footwear/";

function decodeHtml(value: string): string {
  return value
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#039;|&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&euro;|&#8364;/gi, "€")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function textContent(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function normalizePapuceiUrl(raw: string, requiredPath: string): string | null {
  try {
    const url = new URL(decodeHtml(raw), PAPUCEI_ORIGIN);
    if (url.origin !== PAPUCEI_ORIGIN || !url.pathname.startsWith(requiredPath)) return null;
    url.hash = "";
    url.search = "";
    return url.toString();
  } catch {
    return null;
  }
}

function listingRegion(html: string): string {
  const start = html.search(/<div\s+class=["'][^"']*\bproduct\b[^"']*["'][^>]*>/i);
  const end = html.search(/<ul\s+class=["']page-numbers["']/i);
  if (start < 0) return "";
  return html.slice(start, end > start ? end : undefined);
}

export interface PapuceiListingPage {
  productUrls: string[];
  nextPageUrl: string | null;
}

export function parsePapuceiListingPage(html: string): PapuceiListingPage {
  const region = listingRegion(html);
  const productUrls = unique(
    [...region.matchAll(/href=["']([^"']+)["']/gi)]
      .map((match) => normalizePapuceiUrl(match[1] ?? "", PRODUCT_PATH))
      .filter((url): url is string => Boolean(url)),
  );
  const nextMatch = html.match(/<a\b[^>]*class=["'][^"']*\bnext\b[^"']*\bpage-numbers\b[^"']*["'][^>]*href=["']([^"']+)["']/i)
    ?? html.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*\bnext\b[^"']*\bpage-numbers\b[^"']*["']/i);
  const nextPageUrl = nextMatch
    ? normalizePapuceiUrl(nextMatch[1] ?? "", CATEGORY_PATH)
    : null;
  return { productUrls, nextPageUrl };
}

function parsePrice(raw: string | undefined): number | null {
  if (!raw) return null;
  const normalized = textContent(raw).replace(/[^\d,.]/g, "").replace(/\./g, "").replace(",", ".");
  const price = Number(normalized);
  return Number.isFinite(price) ? price : null;
}

function productCategory(title: string, html: string): MarketResearchMappedCategoryId {
  const categoryText = textContent(
    html.match(/<span\s+class=["']posted_in["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "",
  );
  const haystack = `${title} ${categoryText}`.toLocaleLowerCase("en");
  if (/sneaker|sport shoe/.test(haystack)) return "sneaker";
  if (/loafer|moccasin/.test(haystack)) return "loafer";
  if (/sandal/.test(haystack)) return "sandal";
  if (/mule/.test(haystack)) return "mule";
  if (/espadr/.test(haystack)) return "espadril";
  if (/oxford|derby/.test(haystack)) return "oxford-derby";
  if (/clog/.test(haystack)) return "clog";
  if (/boot/.test(haystack)) return "bot-cizme";
  if (/heel|pump/.test(haystack)) return "topuklu";
  if (/flat|ballet|mary jane/.test(haystack)) return "babet";
  return "diger";
}

function slugFromUrl(url: string): string {
  return new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? url;
}

function normalizeModelKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function mainProductRegion(html: string): string {
  const start = html.search(/<div\b[^>]*class=["'][^"']*woo-variation-product-gallery/i);
  const end = html.search(/<div\b[^>]*class=["'][^"']*summary\s+entry-summary/i);
  return start >= 0 && end > start ? html.slice(start, end) : "";
}

export function parsePapuceiProductPage(
  html: string,
  productUrl: string,
  observedAt: string,
): RomaniaCollectedProduct {
  const name = textContent(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  if (!name) throw new Error("Papucei product title is missing");

  const gallery = mainProductRegion(html);
  const images = unique(
    [...gallery.matchAll(/data-large_image=["']([^"']+)["']/gi)]
      .map((match) => normalizePapuceiUrl(match[1] ?? "", "/wp-content/uploads/"))
      .filter((url): url is string => Boolean(url)),
  );

  const summary = html.match(/<div\b[^>]*class=["'][^"']*summary\s+entry-summary[^"']*["'][^>]*>([\s\S]*?)<div\b[^>]*class=["'][^"']*product_meta/i)?.[1] ?? html;
  const amountTags = [...summary.matchAll(/<span\s+class=["'][^"']*woocommerce-Price-amount[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)];
  const prices = amountTags
    .map((match) => parsePrice(match[1]))
    .filter((price): price is number => price !== null);
  const trackedPrice = parsePrice(html.match(/data-product_price=["']([^"']+)["']/i)?.[1]);
  const currentPrice = trackedPrice ?? prices.at(-1) ?? null;
  const listPrice = prices.length > 1 ? Math.max(...prices) : currentPrice;

  // Scope the color selector to the main product summary. Recommendation carousels also
  // contain `.img.active` blocks and must never leak a different product name as a color.
  const activeColor = summary.match(/<div\s+class=["'][^"']*\bimg\b[^"']*\bactive\b[^"']*["'][^>]*>[\s\S]*?<a\b[^>]*(?:title|aria-label)=["']([^"']+)["']/i)?.[1];
  const sku = html.match(/class=["'][^"']*sku_var_value[^"']*["'][^>]*data-default=["']([^"']+)["']/i)?.[1];
  const currency = /&euro;|€|data-currency=["']EUR["']/i.test(summary) ? "EUR" : "RON";

  return {
    source_product_id: decodeHtml(sku ?? slugFromUrl(productUrl)),
    model_key: normalizeModelKey(name),
    name,
    color: activeColor ? textContent(activeColor) : null,
    category_id: productCategory(name, html),
    product_url: productUrl,
    images,
    current_price: currentPrice,
    list_price: listPrice,
    currency,
    observed_at: observedAt,
  };
}

function percentage(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 10_000) / 100;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(values.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      const value = values[index];
      if (value === undefined) continue;
      try {
        results[index] = { status: "fulfilled", value: await mapper(value) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

export interface CollectPapuceiOptions {
  fetchHtml: FetchHtml;
  now?: () => string;
  previousLastSuccessAt?: string | null;
  detailConcurrency?: number;
  maxPages?: number;
}

export async function collectPapuceiStaging(
  options: CollectPapuceiOptions,
): Promise<RomaniaSourceStagingResult> {
  const attemptedAt = options.now?.() ?? new Date().toISOString();
  const productUrls: string[] = [];
  const visitedPages = new Set<string>();
  let pageUrl: string | null = PAPUCEI_SOURCE.category_url;
  let paginationComplete = false;
  let listingError: string | null = null;
  const maxPages = options.maxPages ?? 25;

  while (pageUrl && visitedPages.size < maxPages) {
    if (visitedPages.has(pageUrl)) {
      listingError = `Pagination loop detected at ${pageUrl}`;
      break;
    }
    visitedPages.add(pageUrl);
    try {
      const page = parsePapuceiListingPage(await options.fetchHtml(pageUrl));
      if (page.productUrls.length === 0) {
        listingError = `No footwear products found at ${pageUrl}`;
        break;
      }
      productUrls.push(...page.productUrls);
      pageUrl = page.nextPageUrl;
      if (!pageUrl) paginationComplete = true;
    } catch (error) {
      listingError = error instanceof Error ? error.message : String(error);
      break;
    }
  }
  if (pageUrl && visitedPages.size >= maxPages) {
    listingError = `Pagination exceeded ${maxPages} pages`;
  }

  const uniqueProductUrls = unique(productUrls);
  if (uniqueProductUrls.length === 0) {
    const coverage: RomaniaSourceCoverageReport = {
      source_id: PAPUCEI_SOURCE.id,
      source_name: PAPUCEI_SOURCE.name,
      status: "source_unavailable",
      source_total: null,
      collected: 0,
      unique_models: 0,
      missing: null,
      coverage_percent: null,
      gallery_coverage_percent: null,
      price_coverage_percent: null,
      source_unavailable: true,
      pagination_complete: false,
      last_attempt_at: attemptedAt,
      last_success_at: options.previousLastSuccessAt ?? null,
      note: listingError ?? "Papucei footwear listing returned no products",
    };
    return {
      version: 1,
      kind: "romania-source-staging",
      source: PAPUCEI_SOURCE,
      coverage,
      products: [],
      failed_product_urls: [],
      publishable: false,
    };
  }

  const settled = await mapWithConcurrency(
    uniqueProductUrls,
    options.detailConcurrency ?? 6,
    async (url) => parsePapuceiProductPage(await options.fetchHtml(url), url, attemptedAt),
  );
  const products = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  const failedProductUrls = uniqueProductUrls.filter((_, index) => settled[index]?.status === "rejected");
  const sourceTotal = uniqueProductUrls.length;
  const collected = products.length;
  const missing = sourceTotal - collected;
  const galleryCount = products.filter((product) => product.images.length > 0).length;
  const pricedCount = products.filter((product) => product.current_price !== null).length;
  const galleryComplete = collected > 0 && galleryCount === collected;
  const priceComplete = collected > 0 && pricedCount === collected;
  const complete = paginationComplete && missing === 0 && galleryComplete && priceComplete;
  const coverage: RomaniaSourceCoverageReport = {
    source_id: PAPUCEI_SOURCE.id,
    source_name: PAPUCEI_SOURCE.name,
    status: complete ? "ok" : "partial",
    source_total: sourceTotal,
    collected,
    unique_models: new Set(products.map((product) => product.model_key)).size,
    missing,
    coverage_percent: percentage(collected, sourceTotal),
    gallery_coverage_percent: percentage(galleryCount, collected),
    price_coverage_percent: percentage(pricedCount, collected),
    source_unavailable: false,
    pagination_complete: paginationComplete,
    last_attempt_at: attemptedAt,
    last_success_at: complete ? attemptedAt : options.previousLastSuccessAt ?? null,
    note: complete
      ? null
      : listingError
        ?? (failedProductUrls.length > 0
          ? `${failedProductUrls.length} product detail page(s) failed`
          : `${collected - galleryCount} gallery and ${collected - pricedCount} price record(s) are incomplete`),
  };

  return {
    version: 1,
    kind: "romania-source-staging",
    source: PAPUCEI_SOURCE,
    coverage,
    products,
    failed_product_urls: failedProductUrls,
    publishable: complete,
  };
}
