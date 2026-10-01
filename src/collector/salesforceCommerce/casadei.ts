import { evaluateFootwearProduct, inferFootwearCategoryFromSignals } from "../footwearGate";
import { assessSalesforceCatalog } from "./coverage";
import { canonicalProductUrl, dedupeUrls } from "./gallery";
import { groupColorwaysIntoModelCards } from "./families";
import type {
  SalesforceCatalog,
  SalesforceColorway,
  SalesforceGender,
  SalesforceHttp,
  SalesforceQuarantine,
  SalesforceScope,
  SalesforceSizeSku,
} from "./types";

export const CASADEI_ORIGIN = "https://www.casadei.com";

export const CASADEI_SCOPE: SalesforceScope = {
  brand: "CASADEI",
  slug: "casadei",
  officialUrl: CASADEI_ORIGIN,
  storefront: "en-us",
  country: "US",
  collectionUrl: "https://www.casadei.com/en-us/shoes/",
  collectionId: "shoes",
  sourceStrategy: "salesforce-mobify-embedded-search",
  storefrontCurrency: null,
};

const NON_FOOTWEAR_CATEGORY = /\b(bags?|hats?|accessories|jewell?ery)\b/i;
const FOOTWEAR_CATEGORY = /shoe|pump|sandal|platform|mule|flat|wedge|sneaker|boot|slipper|loafer|sling/i;

export function casadeiListingUrl(page: number): string {
  const base = "https://www.casadei.com/en-us/shoes/";
  if (page <= 1) return base;
  return `${base}?page=${page}`;
}

export interface CasadeiSearchPage {
  total: number | null;
  offset: number | null;
  limit: number | null;
  currency: string | null;
  hits: CasadeiHit[];
}

export interface CasadeiHit {
  sourceHsCode?: string;
  productId: string;
  productName: string;
  productUrl: string;
  currency: string | null;
  images: string[];
  sizes: SalesforceSizeSku[];
  modelCode: string;
  color: string | null;
  material: string | null;
  gender: SalesforceGender;
  sourceCategoryId: string | null;
  sourceCategoryName: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseGender(value: unknown): SalesforceGender {
  const text = asString(value)?.toUpperCase() ?? "";
  if (text.startsWith("F") || text === "WOMAN" || text === "WOMEN") return "FEMALE";
  if (text === "MALE" || text === "MAN" || text === "MEN") return "MALE";
  return "UNKNOWN";
}

function collectSearchPayloads(value: unknown, found: Record<string, unknown>[] = []): Record<string, unknown>[] {
  const record = asRecord(value);
  if (!record) return found;
  if ("total" in record && "pages" in record && ("offset" in record || "limit" in record)) {
    found.push(record);
  }
  for (const child of Object.values(record)) collectSearchPayloads(child, found);
  return found;
}

function hitsFromPages(pages: unknown): unknown[] {
  if (Array.isArray(pages)) {
    return pages.flatMap((page) => (Array.isArray(page) ? page : []));
  }
  const record = asRecord(pages);
  if (!record) return [];
  return Object.values(record).flatMap((page) => (Array.isArray(page) ? page : []));
}

function imagesFromHit(hit: Record<string, unknown>): string[] {
  const groups = Array.isArray(hit.imageGroups) ? hit.imageGroups : [];
  const urls: string[] = [];
  for (const group of groups) {
    const record = asRecord(group);
    if (!record) continue;
    if ((asString(record.viewType) ?? "").toLowerCase() === "swatch") continue;
    const images = Array.isArray(record.images) ? record.images : [];
    for (const image of images) {
      const imageRecord = asRecord(image);
      const raw = asString(imageRecord?.link) ?? asString(imageRecord?.disBaseLink);
      if (!raw) continue;
      urls.push(raw.split("?")[0] ?? raw);
    }
  }
  return dedupeUrls(urls);
}

function sizesFromHit(hit: Record<string, unknown>): SalesforceSizeSku[] {
  const variants = Array.isArray(hit.variants) ? hit.variants : [];
  const sizes: SalesforceSizeSku[] = [];
  for (const variant of variants) {
    const record = asRecord(variant);
    if (!record) continue;
    const values = asRecord(record.variationValues);
    const size = asString(values?.size);
    const sku = asString(record.productId);
    if (!size || !sku) continue;
    sizes.push({
      size,
      displaySize: size,
      sku,
      selectable: typeof record.orderable === "boolean" ? record.orderable : null,
    });
  }
  return sizes;
}

function mapHit(value: unknown): CasadeiHit | null {
  const hit = asRecord(value);
  if (!hit) return null;
  const represented = asRecord(hit.representedProduct);
  const productId = asString(hit.productId);
  const productName = asString(hit.productName);
  const productUrl = asString(hit.c_url);
  if (!productId || !productName || !productUrl) return null;
  const canonical = canonicalProductUrl(productUrl, CASADEI_ORIGIN);
  if (!canonical) return null;
  return {
    sourceHsCode: asString(represented?.c_hsCode) ?? undefined,
    productId,
    productName,
    productUrl: canonical,
    currency: asString(hit.currency),
    images: imagesFromHit(hit),
    sizes: sizesFromHit(hit),
    modelCode: asString(represented?.c_model) ?? productId,
    color: asString(represented?.c_colorDescription),
    material: asString(represented?.c_materialDescription) ?? asString(represented?.c_material),
    gender: parseGender(represented?.c_gender),
    sourceCategoryId: asString(represented?.c_categoryId),
    sourceCategoryName: asString(represented?.c_categoryName),
  };
}

export function parseCasadeiMobifySearch(html: string): CasadeiSearchPage {
  const match = html.match(/<script[^>]*id="mobify-data"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match?.[1]) {
    return { total: null, offset: null, limit: null, currency: null, hits: [] };
  }
  let payload: unknown;
  try {
    payload = JSON.parse(match[1]);
  } catch {
    return { total: null, offset: null, limit: null, currency: null, hits: [] };
  }
  const search = collectSearchPayloads(payload)
    .sort((a, b) => (typeof b.total === "number" ? b.total : 0) - (typeof a.total === "number" ? a.total : 0))[0];
  if (!search) {
    return { total: null, offset: null, limit: null, currency: null, hits: [] };
  }
  const hits = hitsFromPages(search.pages).map(mapHit).filter((hit): hit is CasadeiHit => hit !== null);
  return {
    total: typeof search.total === "number" ? search.total : null,
    offset: typeof search.offset === "number" ? search.offset : null,
    limit: typeof search.limit === "number" ? search.limit : null,
    currency: hits.find((hit) => hit.currency)?.currency ?? null,
    hits,
  };
}

function classifyHit(hit: CasadeiHit): { accepted: SalesforceColorway | null; quarantine: SalesforceQuarantine | null } {
  const categoryHaystack = `${hit.sourceCategoryId ?? ""} ${hit.sourceCategoryName ?? ""}`;
  const base = {
    productId: hit.productId,
    productUrl: hit.productUrl,
    productName: hit.productName,
  };
  if (hit.gender === "MALE" || NON_FOOTWEAR_CATEGORY.test(categoryHaystack)) {
    return {
      accepted: null,
      quarantine: {
        ...base,
        reason: hit.gender === "MALE" ? "mens" : "non-footwear",
      },
    };
  }

  const footwearCategory = FOOTWEAR_CATEGORY.test(categoryHaystack);
  const gate = evaluateFootwearProduct({
    title: hit.productName,
    productType: /over.?the.?knee|to.?the.?knee/i.test(categoryHaystack) ? "Boot" : hit.sourceCategoryName ?? "",
    handle: hit.productUrl,
    collectionPath: "/en-us/shoes/",
    fromVerifiedFootwearCollection: footwearCategory,
  });
  if (gate.decision !== "ACCEPT_FOOTWEAR" || !gate.category) {
    return { accepted: null, quarantine: { ...base, reason: "uncertain" } };
  }
  if (hit.images.length === 0) {
    return { accepted: null, quarantine: { ...base, reason: "missing-gallery" } };
  }
  if (hit.sizes.length === 0 || hit.sizes.some((size) => !size.sku)) {
    return { accepted: null, quarantine: { ...base, reason: hit.sizes.length === 0 ? "missing-size" : "missing-sku" } };
  }

  const accepted: SalesforceColorway = {
    sourceHsCode: hit.sourceHsCode,
    productId: hit.productId,
    productUrl: hit.productUrl,
    productName: hit.productName,
    color: hit.color,
    material: hit.material,
    sku: null,
    category: gate.category,
    images: hit.images,
    sizes: hit.sizes,
    modelCode: hit.modelCode,
    gender: hit.gender,
    sourceCategoryId: hit.sourceCategoryId,
    sourceCategoryName: hit.sourceCategoryName,
    inNewArrivals: false,
    isNew: false,
    hasNewBadge: false,
  };
  return { accepted, quarantine: null };
}

export async function collectCasadeiWomensShoes(
  http: SalesforceHttp,
  options: { maxPages?: number; collectedAt?: string } = {},
): Promise<SalesforceCatalog> {
  const maxPages = options.maxPages ?? 40;
  const seen = new Map<string, CasadeiHit>();
  const pagesVisited: string[] = [];
  const errors: string[] = [];
  let sourceReportedTotal: number | null = null;
  let currency: string | null = null;
  let paginationExhausted = false;

  for (let page = 1; page <= maxPages; page += 1) {
    const url = casadeiListingUrl(page);
    const response = await http.fetchText(url);
    pagesVisited.push(response.url || url);
    if (!response.ok) {
      errors.push(`Casadei page ${page} HTTP ${response.status || 0}`);
      break;
    }
    const parsed = parseCasadeiMobifySearch(response.text);
    if (parsed.total === null) {
      errors.push(`Casadei page ${page} did not include a source total`);
      break;
    }
    sourceReportedTotal = parsed.total;
    currency ??= parsed.currency;
    let added = 0;
    for (const hit of parsed.hits) {
      if (seen.has(hit.productId)) continue;
      seen.set(hit.productId, hit);
      added += 1;
    }
    const offset = parsed.offset ?? 0;
    const covered = offset + parsed.hits.length;
    if (covered >= parsed.total || seen.size >= parsed.total) {
      paginationExhausted = seen.size === parsed.total;
      break;
    }
    if (added === 0) {
      errors.push(`Casadei pagination stalled at page ${page}`);
      break;
    }
  }

  const accepted: SalesforceColorway[] = [];
  const quarantined: SalesforceQuarantine[] = [];
  for (const hit of seen.values()) {
    const classified = classifyHit(hit);
    if (classified.accepted) {
      if (classified.accepted.category === "OTHER_FOOTWEAR") {
        const url = new URL(hit.productUrl);
        url.pathname = url.pathname.replace(/^\/en\//, "/en-us/");
        const response = await http.fetchText(url.href);
        let description: string | null = null;
        for (const match of response.text.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
          try {
            const product = asRecord(JSON.parse(match[1]));
            const offers = asRecord(product?.offers);
            if (response.ok && product?.["@type"] === "Product" && product.sku === hit.productId && offers?.priceCurrency === "USD" &&
                asRecord(product.audience)?.audienceType === "FEMALE") description = asString(product.description);
          } catch { /* An unrelated JSON-LD block is not product evidence. */ }
        }
        if (description && /^640[1-5]\d{4}$/.test(hit.sourceHsCode ?? "")) {
          classified.accepted.sourceDescription = description;
          classified.accepted.category = inferFootwearCategoryFromSignals({title: description, productType: hit.sourceCategoryName ?? ""}) ?? classified.accepted.category;
        } else errors.push(`Casadei product construction unverified: ${hit.productId}`);
      }
      accepted.push(classified.accepted);
    }
    if (classified.quarantine) quarantined.push(classified.quarantine);
  }
  accepted.sort((a, b) => a.productUrl.localeCompare(b.productUrl));
  quarantined.sort((a, b) => a.productUrl.localeCompare(b.productUrl));
  const scopeProductUrls = [...seen.values()].map((hit) => hit.productUrl).sort();
  const assessment = assessSalesforceCatalog({
    blocked: false,
    sourceReportedTotal,
    scopeProductUrls,
    accepted,
    quarantined,
    paginationExhausted,
    pageErrors: errors,
  });

  return {
    scope: { ...CASADEI_SCOPE, storefrontCurrency: currency },
    collectedAt: options.collectedAt ?? new Date().toISOString(),
    status: assessment.status,
    blocker: assessment.blocker,
    sourceReportedTotal,
    scopeProductUrls,
    accepted,
    quarantined,
    families: groupColorwaysIntoModelCards(CASADEI_SCOPE.slug, CASADEI_SCOPE.brand, accepted),
    pagesVisited,
    paginationExhausted,
    errors,
    newProducts: assessment.newProducts,
  };
}
