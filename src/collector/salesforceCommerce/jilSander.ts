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

export const JIL_SANDER_ORIGIN = "https://www.jilsander.com";
export const JIL_SANDER_PAGE_SIZE = 40;

export const JIL_SANDER_SCOPE: SalesforceScope = {
  brand: "JIL SANDER",
  slug: "jil-sander",
  officialUrl: JIL_SANDER_ORIGIN,
  storefront: "en-us",
  country: "US",
  collectionUrl: "https://www.jilsander.com/en-us/women/accessories/shoes",
  collectionId: "jilsander-woman-other-shoes",
  sourceStrategy: "salesforce-storefront-search-ajax",
  storefrontCurrency: null,
};

export interface JilSanderTile {
  productId: string;
  productName: string;
  productUrl: string;
  imageUrl: string | null;
}

export function jilSanderListingUrl(start: number, pageSize = JIL_SANDER_PAGE_SIZE): string {
  const params = new URLSearchParams({
    cgid: JIL_SANDER_SCOPE.collectionId,
    start: String(start),
    sz: String(pageSize),
  });
  return `https://www.jilsander.com/on/demandware.store/Sites-JilSanderUS-Site/en_US/Search-ShowAjax?${params}`;
}

export function jilSanderVariationUrl(pid: string, options: { size?: string; color?: string } = {}): string {
  const params = new URLSearchParams({ pid, quantity: "1" });
  if (options.color) params.set(`dwvar_${pid}_color`, options.color);
  if (options.size) params.set(`dwvar_${pid}_size`, options.size);
  return `https://www.jilsander.com/on/demandware.store/Sites-JilSanderUS-Site/en_US/Product-Variation?${params}`;
}

export function jilSanderModelCode(productId: string): string {
  return productId.match(/^([A-Z]\d{2}[A-Z]{2}\d{4})/)?.[1] ?? productId;
}

export function parseJilSanderResultTotal(html: string): number | null {
  const values = [...html.matchAll(/(\d+)\s+results\b/gi)].map((match) => Number(match[1]));
  const unique = [...new Set(values)];
  return unique.length === 1 ? unique[0] : null;
}

function decode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function parseJilSanderTiles(html: string): JilSanderTile[] {
  const chunks = html.split('class="product-tile"').slice(1);
  const tiles: JilSanderTile[] = [];
  const seen = new Set<string>();
  for (const chunk of chunks) {
    const window = chunk.slice(0, 12000);
    const href = window.match(/href="(\/en-us\/[^"]+\.html)"/i)?.[1];
    const named = window.match(/<h2 class="link">\s*<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/i);
    const path = named?.[1] ?? href;
    const productName = named?.[2]?.replace(/\s+/g, " ").trim()
      ?? window.match(/alt="([^"]+)"/i)?.[1]?.split(" - ")[0]?.trim()
      ?? "";
    if (!path || !productName) continue;
    const productUrl = canonicalProductUrl(decode(path), JIL_SANDER_ORIGIN);
    const productId = productUrl?.match(/\/([A-Za-z0-9]+)\.html$/)?.[1] ?? "";
    if (!productUrl || !productId || seen.has(productId)) continue;
    seen.add(productId);
    const image = window.match(/https:\/\/www\.jilsander\.com\/[^"'\\\s]+\/images\/large\/[^"'\\\s?]+/i)?.[0] ?? null;
    tiles.push({
      productId,
      productName: decode(productName),
      productUrl,
      imageUrl: image,
    });
  }
  return tiles;
}

interface JilVariation {
  productId: string;
  productName: string;
  productUrl: string | null;
  gender: SalesforceGender;
  color: string | null;
  images: string[];
  sizes: Array<{ size: string; displaySize: string | null; selectable: boolean | null; color: string | null }>;
  currency: string | null;
  categoryId: string | null;
  defaultSku: string | null;
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
  if (text === "F" || text.startsWith("F") || text === "WOMAN" || text === "WOMEN") return "FEMALE";
  if (text === "M" || text === "MALE" || text === "MAN" || text === "MEN") return "MALE";
  return "UNKNOWN";
}

export function parseJilSanderVariation(payload: unknown): JilVariation | null {
  const root = asRecord(payload);
  const product = asRecord(root?.product);
  if (!product) return null;
  const productId = asString(product.id);
  const productName = asString(product.productName);
  if (!productId || !productName) return null;
  const selectedUrl = asString(product.selectedProductUrl);
  const imagesRecord = asRecord(product.images);
  const large = Array.isArray(imagesRecord?.large) ? imagesRecord.large : [];
  const images = dedupeUrls(
    large
      .map((image) => asString(asRecord(image)?.url))
      .filter((url): url is string => Boolean(url))
      .map((url) => url.split("?")[0] ?? url),
  );
  const attributes = Array.isArray(product.variationAttributes) ? product.variationAttributes : [];
  const colorAttribute = attributes
    .map(asRecord)
    .find((attribute) => asString(attribute?.id) === "color");
  const sizeAttribute = attributes
    .map(asRecord)
    .find((attribute) => asString(attribute?.id) === "size");
  const colorValues = Array.isArray(colorAttribute?.values) ? colorAttribute.values : [];
  const selectedColor = colorValues
    .map(asRecord)
    .find((value) => value?.selected === true);
  const color = asString(selectedColor?.displayValue);
  const colorId = asString(selectedColor?.value);
  const sizeValues = Array.isArray(sizeAttribute?.values) ? sizeAttribute.values : [];
  const sizes = sizeValues.flatMap((value) => {
    const record = asRecord(value);
    const size = asString(record?.value);
    if (!record || !size) return [];
    return [{
      size,
      displaySize: asString(record.displayValue),
      selectable: typeof record.selectable === "boolean" ? record.selectable : null,
      color: colorId,
    }];
  });
  const price = asRecord(asRecord(product.price)?.sales);
  const defaultVariant = asRecord(product.defaultVariant);
  return {
    productId,
    productName,
    productUrl: selectedUrl ? canonicalProductUrl(selectedUrl, JIL_SANDER_ORIGIN) : null,
    gender: parseGender(product.genderCode),
    color,
    images,
    sizes,
    currency: asString(price?.currency),
    categoryId: asString(product.masterCategoryID),
    defaultSku: defaultVariant?.isVariant === true ? asString(defaultVariant.id) : null,
  };
}

/**
 * A size SKU is recorded only when that size response identifies its own variant.
 * The colourway's default SKU is not copied onto sizes the storefront left unresolved.
 */
export function resolveJilSanderSizeSku(payload: unknown, groupDefaultSku: string | null): string | null {
  const product = asRecord(asRecord(payload)?.product);
  if (!product) return null;
  if (product.isVariant === true) return asString(product.id);
  const fallback = asRecord(product.defaultVariant);
  const fallbackSku = fallback?.isVariant === true ? asString(fallback.id) : null;
  if (fallbackSku && fallbackSku !== groupDefaultSku) return fallbackSku;
  return null;
}

async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index] as T);
    }
  }
  const workers = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workers }, () => run()));
  return results;
}

const JIL_FOOTWEAR_NAME =
  /\b(ballerinas?|pumps?|boots?|sandals?|sneakers?|shoes?|slippers?|mules?|loafers?|slingbacks?|flats?)\b/i;

function classifyJilFootwear(name: string, categoryId: string | null, productUrl: string) {
  const input = {
    title: name,
    productType: categoryId ?? "",
    handle: productUrl,
    collectionPath: "/en-us/women/accessories/shoes",
    fromVerifiedFootwearCollection: true,
  };
  if (JIL_FOOTWEAR_NAME.test(name) && !/\b(bag|handbag|hat|belt|scarf)\b/i.test(name)) {
    return {
      decision: "ACCEPT_FOOTWEAR" as const,
      category: inferFootwearCategoryFromSignals(input) ?? "OTHER_FOOTWEAR" as const,
    };
  }
  return evaluateFootwearProduct(input);
}

function classifyVariation(
  tile: JilSanderTile,
  variation: JilVariation | null,
  sizes: SalesforceSizeSku[],
): { accepted: SalesforceColorway | null; quarantine: SalesforceQuarantine | null } {
  const productUrl = variation?.productUrl ?? tile.productUrl;
  const base = { productId: tile.productId, productUrl, productName: variation?.productName ?? tile.productName };
  if (!variation) return { accepted: null, quarantine: { ...base, reason: "off-scope" } };
  if (variation.gender === "MALE" || /-man-/.test(variation.categoryId ?? "")) {
    return { accepted: null, quarantine: { ...base, reason: "mens" } };
  }
  const gate = classifyJilFootwear(variation.productName, variation.categoryId, productUrl);
  if (gate.decision !== "ACCEPT_FOOTWEAR" || !gate.category) {
    return {
      accepted: null,
      quarantine: { ...base, reason: gate.decision === "EXCLUDE_NON_FOOTWEAR" ? "non-footwear" : "uncertain" },
    };
  }
  const images = variation.images.length > 0 ? variation.images : dedupeUrls(tile.imageUrl ? [tile.imageUrl] : []);
  if (images.length === 0) return { accepted: null, quarantine: { ...base, reason: "missing-gallery" } };
  if (sizes.length === 0) return { accepted: null, quarantine: { ...base, reason: "missing-size" } };
  if (!variation.defaultSku && sizes.every((size) => !size.sku)) {
    return { accepted: null, quarantine: { ...base, reason: "missing-sku" } };
  }
  return {
    accepted: {
      productId: tile.productId,
      productUrl,
      productName: variation.productName,
      color: variation.color,
      material: null,
      sku: variation.defaultSku,
      category: gate.category,
      images,
      sizes,
      modelCode: jilSanderModelCode(tile.productId),
      gender: variation.gender,
      sourceCategoryId: variation.categoryId,
      sourceCategoryName: "Shoes",
      inNewArrivals: false,
      isNew: false,
      hasNewBadge: false,
    },
    quarantine: null,
  };
}

export async function collectJilSanderWomensShoes(
  http: SalesforceHttp,
  options: { maxPages?: number; collectedAt?: string; concurrency?: number } = {},
): Promise<SalesforceCatalog> {
  const maxPages = options.maxPages ?? 8;
  const concurrency = options.concurrency ?? 6;
  const pagesVisited: string[] = [];
  const errors: string[] = [];
  const tiles = new Map<string, JilSanderTile>();
  let sourceReportedTotal: number | null = null;
  let paginationExhausted = false;

  const firstUrl = JIL_SANDER_SCOPE.collectionUrl;
  const first = await http.fetchText(firstUrl);
  pagesVisited.push(first.url || firstUrl);
  if (!first.ok) {
    errors.push(`Jil Sander listing HTTP ${first.status || 0}`);
  } else {
    sourceReportedTotal = parseJilSanderResultTotal(first.text);
    for (const tile of parseJilSanderTiles(first.text)) tiles.set(tile.productId, tile);
    if (sourceReportedTotal === null) errors.push("Jil Sander listing did not include a single source total");
  }

  for (let page = 1; page < maxPages; page += 1) {
    if (sourceReportedTotal !== null && tiles.size >= sourceReportedTotal) {
      paginationExhausted = true;
      break;
    }
    const start = page * JIL_SANDER_PAGE_SIZE;
    const url = jilSanderListingUrl(start);
    const response = await http.fetchText(url);
    pagesVisited.push(response.url || url);
    if (!response.ok) {
      errors.push(`Jil Sander page start=${start} HTTP ${response.status || 0}`);
      break;
    }
    const parsed = parseJilSanderTiles(response.text);
    let added = 0;
    for (const tile of parsed) {
      if (tiles.has(tile.productId)) continue;
      tiles.set(tile.productId, tile);
      added += 1;
    }
    if (sourceReportedTotal !== null && tiles.size >= sourceReportedTotal) {
      paginationExhausted = true;
      break;
    }
    if (added === 0) {
      errors.push(`Jil Sander pagination stalled at start=${start}`);
      break;
    }
  }
  if (sourceReportedTotal !== null && tiles.size === sourceReportedTotal) paginationExhausted = true;

  const variations = await mapPool([...tiles.values()], concurrency, async (tile) => {
    const response = await http.fetchText(jilSanderVariationUrl(tile.productId));
    if (!response.ok) {
      errors.push(`Jil Sander variation ${tile.productId} HTTP ${response.status || 0}`);
      return { tile, variation: null as JilVariation | null };
    }
    try {
      return { tile, variation: parseJilSanderVariation(JSON.parse(response.text)) };
    } catch {
      errors.push(`Jil Sander variation ${tile.productId} was not JSON`);
      return { tile, variation: null };
    }
  });

  const sizeJobs = variations.flatMap((item) =>
    (item.variation?.sizes ?? []).map((size) => ({
      productId: item.tile.productId,
      size: size.size,
      displaySize: size.displaySize,
      selectable: size.selectable,
      color: size.color,
      groupDefaultSku: item.variation?.defaultSku ?? null,
    })),
  );
  const skuByKey = new Map<string, string>();
  await mapPool(sizeJobs, concurrency, async (job) => {
    const response = await http.fetchText(jilSanderVariationUrl(job.productId, {
      size: job.size,
      color: job.color ?? undefined,
    }));
    if (!response.ok) {
      errors.push(`Jil Sander size ${job.productId}/${job.size} HTTP ${response.status || 0}`);
      return;
    }
    try {
      const sku = resolveJilSanderSizeSku(JSON.parse(response.text), job.groupDefaultSku);
      if (sku) skuByKey.set(`${job.productId}:${job.size}`, sku);
    } catch {
      errors.push(`Jil Sander size ${job.productId}/${job.size} was not JSON`);
    }
  });

  const accepted: SalesforceColorway[] = [];
  const quarantined: SalesforceQuarantine[] = [];
  let currency: string | null = null;
  for (const item of variations) {
    currency ??= item.variation?.currency ?? null;
    const sizes = (item.variation?.sizes ?? []).map((size) => ({
      size: size.size,
      displaySize: size.displaySize,
      sku: skuByKey.get(`${item.tile.productId}:${size.size}`) ?? null,
      selectable: size.selectable,
    }));
    const classified = classifyVariation(item.tile, item.variation, sizes);
    if (classified.accepted) accepted.push(classified.accepted);
    if (classified.quarantine) quarantined.push(classified.quarantine);
  }
  accepted.sort((a, b) => a.productUrl.localeCompare(b.productUrl));
  quarantined.sort((a, b) => a.productUrl.localeCompare(b.productUrl));
  const scopeProductUrls = [...tiles.values()].map((tile) => tile.productUrl).sort();
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
    scope: { ...JIL_SANDER_SCOPE, storefrontCurrency: currency },
    collectedAt: options.collectedAt ?? new Date().toISOString(),
    status: assessment.status,
    blocker: assessment.blocker,
    sourceReportedTotal,
    scopeProductUrls,
    accepted,
    quarantined,
    families: groupColorwaysIntoModelCards(JIL_SANDER_SCOPE.slug, JIL_SANDER_SCOPE.brand, accepted),
    pagesVisited,
    paginationExhausted,
    errors,
    newProducts: assessment.newProducts,
  };
}
