import { parseStorefrontProductCount } from "../brands/officialShopify/storefrontCount";
import { defaultOnboardingHttp, fetchMaybeJson, type OnboardingHttp } from "../onboarding/http";
import type { CollectionAttemptResult } from "./collectWithFallback";
import { isMensOnlyProduct } from "./footwearGate";
import { shopifyProductToPilot } from "./shopify";
import type { FootwearCategory, PilotSourceConfig } from "./types";

type RawProduct = Parameters<typeof shopifyProductToPilot>[0];
export const MARGAUX_COLLECTIONS: ReadonlyArray<{ path: string; label: string; category: FootwearCategory }> = [
  { path: "/collections/boots", label: "Boots", category: "BOOT" },
  { path: "/collections/loafers", label: "Loafers", category: "LOAFER" },
  { path: "/collections/sandals", label: "Sandals", category: "SANDAL" },
  { path: "/collections/heels", label: "Heels", category: "PUMP" },
  { path: "/collections/flats", label: "Flats", category: "BALLERINA" },
];
const SHOP_PATH = "/collections/shop";
const ACCESSORY_TYPE = /^(?:socks?|tights|tote)$/i;

/** Reconcile the mixed official Shop total, then prove every shoe's category membership. */
export async function collectMargaux(config: PilotSourceConfig, http: OnboardingHttp = defaultOnboardingHttp):
Promise<CollectionAttemptResult & { storefrontCount: number | null; excludedAccessories: Array<{ url: string; type: string }> }> {
  const origin = new URL(config.baseUrl);
  if (origin.protocol !== "https:" || !/^(?:www\.)?margauxny\.com$/i.test(origin.hostname)) {
    throw new Error("Margaux requires the official HTTPS storefront");
  }
  let base = origin.origin;
  const errors: string[] = [];
  let pagesTraversed = 0;
  let paginationExhausted = true;
  const sameScope = (url: string, path: string) => {
    const u = new URL(url);
    return u.protocol === "https:" && /^(?:www\.)?margauxny\.com$/i.test(u.hostname) &&
      u.pathname.replace(/\/$/, "") === path && [...u.searchParams.keys()].every(key => key === "shpxid");
  };
  const listing = await http.fetchText(`${base}${SHOP_PATH}`);
  const storefrontCount = listing.ok && sameScope(listing.url, SHOP_PATH) ? parseStorefrontProductCount(listing.text) : null;
  console.log(`[margaux] storefront ${JSON.stringify({ status: listing.status, url: listing.url, storefrontCount })}`);
  if (storefrontCount == null) errors.push("MARGAUX_STOREFRONT_COUNT_UNKNOWN");
  if (listing.ok && sameScope(listing.url, SHOP_PATH)) base = new URL(listing.url).origin;
  async function paginate(path: string): Promise<Map<number, RawProduct>> {
    const result = new Map<number, RawProduct>();
    for (let page = 1; page <= 80; page++) {
      const response = await fetchMaybeJson(http, `${base}${path}/products.json?limit=250&page=${page}`);
      pagesTraversed++;
      const u = new URL(response.url);
      const validScope = u.protocol === "https:" && u.origin === base && u.pathname === `${path}/products.json` &&
        [...u.searchParams.keys()].every(key => ["limit", "page", "shpxid"].includes(key)) &&
        u.searchParams.get("page") === String(page);
      const batch = (response.json as { products?: RawProduct[] } | null)?.products;
      if (!response.ok || !validScope || !Array.isArray(batch)) {
        errors.push(`MARGAUX_PAGE_INVALID:${path}:${page}:${response.status}`); break;
      }
      if (batch.length === 0) return result;
      let added = 0;
      for (const raw of batch) {
        if (!Number.isSafeInteger(raw.id) || !raw.handle || !raw.title) {
          errors.push(`MARGAUX_IDENTITY_MISSING:${path}`); continue;
        }
        if (!result.has(raw.id)) { result.set(raw.id, raw); added++; }
      }
      if (!added) { errors.push(`MARGAUX_REPEATED_PAGE:${path}:${page}`); break; }
    }
    paginationExhausted = false;
    errors.push(`MARGAUX_PAGINATION_NOT_EXHAUSTED:${path}`);
    return result;
  }
  const shop = await paginate(SHOP_PATH);
  if (storefrontCount != null && shop.size !== storefrontCount) errors.push(`MARGAUX_SHOP_MISMATCH:${shop.size}/${storefrontCount}`);
  const memberships = new Map<number, typeof MARGAUX_COLLECTIONS[number]>();
  for (const category of MARGAUX_COLLECTIONS) {
    const members = await paginate(category.path);
    for (const [id, member] of members) {
      if (!shop.has(id) || shop.get(id)?.handle !== member.handle) errors.push(`MARGAUX_CATEGORY_OUTSIDE_SHOP:${member.handle}`);
      if (!memberships.has(id)) memberships.set(id, category);
    }
  }
  const products: CollectionAttemptResult["products"] = [];
  const excludedAccessories: Array<{ url: string; type: string }> = [];
  const links = new Set<string>();
  const now = new Date().toISOString();
  for (const [id, raw] of shop) {
    const url = `${base}/products/${raw.handle}`;
    const membership = memberships.get(id);
    if (ACCESSORY_TYPE.test(raw.product_type?.trim() ?? "")) {
      excludedAccessories.push({ url, type: raw.product_type! });
      if (membership) errors.push(`MARGAUX_ACCESSORY_IN_SHOE_CATEGORY:${raw.handle}`);
      continue;
    }
    links.add(url);
    if (!membership || isMensOnlyProduct({ title: raw.title, productType: raw.product_type, handle: raw.handle })) {
      errors.push(`MARGAUX_UNVERIFIED_SHOE:${raw.handle}`); continue;
    }
    const mapped = shopifyProductToPilot(raw, { ...config, baseUrl: base,
      verifiedFootwearPaths: MARGAUX_COLLECTIONS.map(x => x.path) }, now, membership.path, membership.label, membership.category);
    if (!mapped) errors.push(`MARGAUX_REJECTED_SHOE:${raw.handle}`);
    else if (!mapped.imageUrl || !mapped.images?.length) errors.push(`MARGAUX_MISSING_GALLERY:${raw.handle}`);
    else products.push(mapped);
  }
  const expectedShoes = storefrontCount == null ? null : storefrontCount - excludedAccessories.length;
  if (expectedShoes != null && products.length !== expectedShoes) errors.push(`MARGAUX_SHOE_MISMATCH:${products.length}/${expectedShoes}`);
  const final = await http.fetchText(`${base}${SHOP_PATH}`);
  if (!final.ok || !sameScope(final.url, SHOP_PATH) || parseStorefrontProductCount(final.text) !== storefrontCount || storefrontCount == null) {
    errors.push("MARGAUX_STOREFRONT_CHANGED_OR_UNAVAILABLE");
  }
  return { products, discoveredLinks: links, errors, method: "shopify", pagesTraversed,
    rawProductUrlsDiscovered: links.size, paginationExhausted, sourceReportedProductCount: expectedShoes,
    hitCollectionCrawlCap: !paginationExhausted, collectionsCrawled: [SHOP_PATH, ...MARGAUX_COLLECTIONS.map(x => x.path)],
    storefrontCount, excludedAccessories };
}
