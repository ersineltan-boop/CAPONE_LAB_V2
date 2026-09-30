import { parseStorefrontProductCount } from "../brands/officialShopify/storefrontCount";
import { defaultOnboardingHttp, fetchMaybeJson, type OnboardingHttp } from "../onboarding/http";
import type { CollectionAttemptResult } from "./collectWithFallback";
import { shopifyProductToPilot } from "./shopify";
import type { PilotSourceConfig } from "./types";

export const JW_WOMENS_SHOES_PATH = "/collections/womens-shoes";
const PAGE_SIZE = 250;
const PAGE_CAP = 80;
type ShopifyProduct = Parameters<typeof shopifyProductToPilot>[0];

/** Only the customer-visible women's collection is authoritative, not admin membership. */
export async function collectJwAnderson(
  config: PilotSourceConfig,
  http: OnboardingHttp = defaultOnboardingHttp,
): Promise<CollectionAttemptResult & { storefrontCount: number | null; collectionResourceCount: number | null }> {
  const base = config.baseUrl.replace(/\/$/, "");
  const origin = new URL(base);
  if (!/^(www\.)?jwanderson\.com$/i.test(origin.hostname) || origin.protocol !== "https:") {
    throw new Error("JW Anderson collector requires the official HTTPS storefront");
  }
  const collectionUrl = `${base}${JW_WOMENS_SHOES_PATH}`;
  const errors: string[] = [];
  const links = new Set<string>();
  const products: CollectionAttemptResult["products"] = [];
  const seenIds = new Set<number>();
  const collection = await http.fetchText(collectionUrl);
  const sameCollection = (url: string) => {
    const resolved = new URL(url);
    return resolved.hostname.replace(/^www\./, "") === "jwanderson.com" &&
      resolved.pathname.replace(/\/$/, "") === JW_WOMENS_SHOES_PATH && !resolved.search;
  };
  const storefrontCount = collection.ok && sameCollection(collection.url)
    ? parseStorefrontProductCount(collection.text) : null;
  if (storefrontCount == null) errors.push("JW_ANDERSON_STOREFRONT_COUNT_UNKNOWN");

  const resource = await fetchMaybeJson(http, `${collectionUrl}.json`);
  const resourceCount = (resource.json as { collection?: { products_count?: number } } | null)?.collection?.products_count;
  const collectionResourceCount = typeof resourceCount === "number" ? resourceCount : null;
  const scopedConfig = { ...config, collectionPaths: [JW_WOMENS_SHOES_PATH], verifiedFootwearPaths: [JW_WOMENS_SHOES_PATH] };
  const now = new Date().toISOString();
  let pagesTraversed = 0;
  let paginationExhausted = false;
  for (let page = 1; page <= PAGE_CAP; page += 1) {
    const response = await fetchMaybeJson(http, `${collectionUrl}/products.json?limit=${PAGE_SIZE}&page=${page}`);
    pagesTraversed += 1;
    const batch = (response.json as { products?: ShopifyProduct[] } | null)?.products;
    if (!response.ok || !Array.isArray(batch)) {
      errors.push(`JW_ANDERSON_PAGE_${page}_INVALID:${response.status}`);
      break;
    }
    if (batch.length === 0) {
      paginationExhausted = true;
      break;
    }
    let added = 0;
    for (const raw of batch) {
      if (!Number.isSafeInteger(raw.id) || !raw.handle || !raw.title) {
        errors.push("JW_ANDERSON_PRODUCT_IDENTITY_MISSING");
        continue;
      }
      if (seenIds.has(raw.id)) continue;
      seenIds.add(raw.id);
      added += 1;
      links.add(`${base}/products/${raw.handle}`);
      const mapped = shopifyProductToPilot(raw, scopedConfig, now, JW_WOMENS_SHOES_PATH, "Women's Shoes");
      if (!mapped || !/\bwomens?\b/i.test(`${raw.title} ${raw.handle.replaceAll("-", " ")}`)) {
        errors.push(`JW_ANDERSON_NON_WOMENS_FOOTWEAR:${raw.handle}`);
      } else if (!mapped.imageUrl || !mapped.images?.length) {
        errors.push(`JW_ANDERSON_MISSING_GALLERY:${raw.handle}`);
      } else products.push(mapped);
    }
    if (added === 0) {
      errors.push(`JW_ANDERSON_REPEATED_PAGE:${page}`);
      break;
    }
  }
  if (!paginationExhausted) errors.push("JW_ANDERSON_PAGINATION_NOT_EXHAUSTED");
  if (storefrontCount != null && (seenIds.size !== storefrontCount || products.length !== storefrontCount)) {
    errors.push(`JW_ANDERSON_STOREFRONT_MISMATCH:${products.length}/${seenIds.size}/${storefrontCount}`);
  }
  const finalCollection = await http.fetchText(collectionUrl);
  const finalCount = finalCollection.ok && sameCollection(finalCollection.url)
    ? parseStorefrontProductCount(finalCollection.text) : null;
  if (finalCount !== storefrontCount || finalCount == null) errors.push("JW_ANDERSON_STOREFRONT_CHANGED_OR_UNAVAILABLE");
  return {
    products, discoveredLinks: links, errors, method: "shopify", pagesTraversed,
    rawProductUrlsDiscovered: links.size, paginationExhausted,
    sourceReportedProductCount: storefrontCount, hitCollectionCrawlCap: !paginationExhausted,
    collectionsCrawled: [JW_WOMENS_SHOES_PATH], storefrontCount, collectionResourceCount,
  };
}
