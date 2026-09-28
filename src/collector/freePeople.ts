import { evaluateFootwearProduct } from "./footwearGate";
import { normalizeProductImageUrls, pickHighestResolutionUrl } from "../images/resolveImageQuality";
import { isNewArrivalsCollectionPath } from "../newArrivals/detectNewness";
import { slugifyCategoryId } from "../source/sourceCategories";
import type { FootwearCategory, PilotProduct, PilotProductVariant } from "./types";

export const FREE_PEOPLE_ID = "free-people";
export const FREE_PEOPLE_NAME = "Free People";
export const FREE_PEOPLE_BASE = "https://www.freepeople.com";
export const FREE_PEOPLE_SHOES_URL = "https://www.freepeople.com/shoes/";
export const FREE_PEOPLE_IMAGE_BASE = "https://images.urbndata.com/is/image/FreePeople/";

const NON_FOOTWEAR_NAME =
  /\b(socks?|tights?|hosiery|pantyhose|gift\s*card|handbag|tote bag|crossbody)\b/i;
const STRONG_FOOTWEAR_NAME =
  /\b(shoe|shoes|boot|boots|sandal|sandals|sneaker|sneakers|loafer|loafers|mule|mules|clog|clogs|flat|flats|heel|heels|wedge|wedges|slipper|slippers|slide|slides|espadrille|ballerina|pump|pumps)\b/i;

export function isFreePeopleAntiBot(status: number, body: string): boolean {
  if (status === 403 || status === 429 || status === 503) return true;
  if (body.length < 2000 && /#cmsg|pardon our interruption|access denied|captcha|akamai|datadome/i.test(body)) {
    return true;
  }
  return /Pardon Our Interruption|Access Denied|cdn-cgi\/challenge|dd\.freepeople\.com\/captcha/i.test(body);
}

export function freePeopleImageUrl(styleNumber: string, colorCode: string, view: string): string {
  const style = styleNumber.trim();
  const color = colorCode.trim();
  const code = view.trim() || "a";
  return `${FREE_PEOPLE_IMAGE_BASE}${style}_${color}_${code}`;
}

export function freePeopleProductUrl(slug: string, colorCode?: string | null): string {
  const handle = slug.replace(/^\/+/, "").replace(/\/+$/, "");
  const base = `${FREE_PEOPLE_BASE}/shop/${handle}/`;
  return colorCode ? `${base}?color=${encodeURIComponent(colorCode)}` : base;
}

export function extractFreePeopleStyleNumber(input: {
  styleNumber?: string | null;
  sku?: string | null;
  productUrl?: string | null;
  imageUrl?: string | null;
}): string | null {
  if (input.styleNumber && /^\d{6,}$/.test(input.styleNumber.trim())) {
    return input.styleNumber.trim();
  }
  const sku = input.sku?.trim() ?? "";
  const skuMatch = sku.match(/(\d{6,})/);
  if (skuMatch) return skuMatch[1]!;
  const fromUrl = `${input.productUrl ?? ""} ${input.imageUrl ?? ""}`;
  const imageMatch = fromUrl.match(/(?:FreePeople\/)?(\d{6,})_\d{2,3}_/i);
  return imageMatch?.[1] ?? null;
}

export interface FreePeopleColorSlice {
  code?: string;
  displayName?: string;
  id?: string;
  images?: string[];
  swatchUrl?: string;
}

export interface FreePeopleTileProduct {
  brand?: string;
  displayName?: string;
  productId?: string;
  productSlug?: string;
  styleNumber?: string;
  defaultColorCode?: string;
  defaultImage?: string;
}

export interface FreePeopleTile {
  recordType?: string;
  faceOutColorCode?: string;
  faceOutImage?: string;
  hoverImage?: string;
  product?: FreePeopleTileProduct | null;
  skuInfo?: {
    listPriceLow?: number;
    listPriceHigh?: number;
    salePriceLow?: number;
    salePriceHigh?: number;
    primarySlice?: { sliceItems?: FreePeopleColorSlice[] };
  } | null;
}

export interface FreePeopleCategoryState {
  slug?: string;
  currentPage?: number;
  totalPages?: number;
  totalRecordCount?: number;
  pages?: Record<string, { wrapper?: { tiles?: FreePeopleTile[] } } | { tiles?: FreePeopleTile[] }>;
}

export type FreePeopleColorSource =
  | "pinia-slice"
  | "image-code"
  | "url-query"
  | "none";

export interface FreePeopleParseStats {
  tilesSeen: number;
  editorialSkipped: number;
  nonFootwearRejected: number;
  duplicateCount: number;
  sourceReportedProductCount: number | null;
  totalPages: number | null;
  currentPage: number | null;
  colorFromPiniaSlice: number;
  colorFromImageCode: number;
  colorFromUrlQuery: number;
  colorEmpty: number;
  colorNameCount: number;
  colorCodeOnlyCount: number;
}

export interface FreePeopleParseResult {
  products: PilotProduct[];
  stats: FreePeopleParseStats;
}

export interface FreePeopleResolvedColor {
  color: string | null;
  colorCode: string | null;
  source: FreePeopleColorSource;
  isName: boolean;
}

export function isFreePeopleNonFootwear(name: string, slug: string): boolean {
  const haystack = `${name} ${slug}`.replace(/-/g, " ");
  if (NON_FOOTWEAR_NAME.test(haystack)) return true;
  const gate = evaluateFootwearProduct({
    title: name,
    handle: slug,
    collectionPath: "/shoes/",
    fromVerifiedFootwearCollection: true,
  });
  if (gate.decision !== "EXCLUDE_NON_FOOTWEAR") return false;
  return !STRONG_FOOTWEAR_NAME.test(haystack);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonBlank(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function tilesFromPage(page: unknown): FreePeopleTile[] {
  const record = asRecord(page);
  if (!record) return [];
  const wrapper = asRecord(record.wrapper) ?? record;
  const tiles = wrapper.tiles;
  return Array.isArray(tiles) ? (tiles as FreePeopleTile[]) : [];
}

function colorSlices(tile: FreePeopleTile): FreePeopleColorSlice[] {
  const items = tile.skuInfo?.primarySlice?.sliceItems;
  return Array.isArray(items)
    ? items.filter((item) => item && nonBlank(item.code))
    : [];
}

/** Scene7 / faceOut token: `{style}_{color}_{view}` */
export function extractFreePeopleColorCodeFromImage(
  image: string | null | undefined,
): string | null {
  const value = nonBlank(image);
  if (!value) return null;
  const match = value.match(/(?:FreePeople\/)?(\d{6,})_(\d{2,3})(?:_[a-z0-9]+)?/i);
  return match?.[2] ?? null;
}

export function extractFreePeopleColorCodeFromUrl(
  productUrl: string | null | undefined,
): string | null {
  if (!productUrl) return null;
  try {
    return nonBlank(new URL(productUrl, FREE_PEOPLE_BASE).searchParams.get("color"));
  } catch {
    const match = productUrl.match(/[?&]color=([^&#]+)/i);
    return match ? nonBlank(decodeURIComponent(match[1]!)) : null;
  }
}

function sliceDisplayName(
  slices: FreePeopleColorSlice[],
  colorCode: string | null,
): string | null {
  if (!colorCode) return null;
  const slice = slices.find((item) => nonBlank(item.code) === colorCode);
  return nonBlank(slice?.displayName) ?? null;
}

/**
 * Prefer official color display names from Pinia slices; fall back to official
 * color codes from face-out / Scene7 / URL. Never invent names.
 */
export function resolveFreePeopleFaceColor(input: {
  tile?: FreePeopleTile | null;
  slices?: FreePeopleColorSlice[];
  productUrl?: string | null;
  imageUrl?: string | null;
}): FreePeopleResolvedColor {
  const tile = input.tile ?? null;
  const slices = input.slices ?? (tile ? colorSlices(tile) : []);
  const codeCandidates = [
    nonBlank(tile?.faceOutColorCode),
    nonBlank(tile?.product?.defaultColorCode),
    extractFreePeopleColorCodeFromImage(tile?.faceOutImage),
    extractFreePeopleColorCodeFromImage(tile?.product?.defaultImage),
    extractFreePeopleColorCodeFromImage(input.imageUrl),
    extractFreePeopleColorCodeFromUrl(input.productUrl),
    nonBlank(slices[0]?.code),
  ].filter((code): code is string => Boolean(code));

  for (const colorCode of codeCandidates) {
    const name = sliceDisplayName(slices, colorCode);
    if (name) {
      const fromUrl = extractFreePeopleColorCodeFromUrl(input.productUrl) === colorCode
        && !nonBlank(tile?.faceOutColorCode)
        && !extractFreePeopleColorCodeFromImage(tile?.faceOutImage)
        && !extractFreePeopleColorCodeFromImage(tile?.product?.defaultImage)
        && !extractFreePeopleColorCodeFromImage(input.imageUrl);
      return {
        color: name,
        colorCode,
        source: fromUrl ? "url-query" : "pinia-slice",
        isName: true,
      };
    }
  }

  const firstNamed = slices.find((slice) => nonBlank(slice.displayName));
  if (firstNamed) {
    return {
      color: nonBlank(firstNamed.displayName),
      colorCode: nonBlank(firstNamed.code),
      source: "pinia-slice",
      isName: true,
    };
  }

  const colorCode = codeCandidates[0] ?? null;
  if (colorCode) {
    const fromUrl = extractFreePeopleColorCodeFromUrl(input.productUrl) === colorCode;
    const fromImage = Boolean(
      extractFreePeopleColorCodeFromImage(tile?.faceOutImage) === colorCode ||
        extractFreePeopleColorCodeFromImage(tile?.product?.defaultImage) === colorCode ||
        extractFreePeopleColorCodeFromImage(input.imageUrl) === colorCode,
    );
    return {
      color: colorCode,
      colorCode,
      source: fromUrl ? "url-query" : fromImage ? "image-code" : "image-code",
      isName: false,
    };
  }

  return { color: null, colorCode: null, source: "none", isName: false };
}

function imagesForColor(tile: FreePeopleTile, styleNumber: string, colorCode: string): string[] {
  const slice = colorSlices(tile).find((item) => item.code === colorCode);
  const views = Array.isArray(slice?.images) && slice.images.length > 0
    ? slice.images
    : ["a", "e", "f", "b"];
  const urls = views
    .filter((view) => typeof view === "string" && view.trim() && view !== "swatch")
    .map((view) => freePeopleImageUrl(styleNumber, colorCode, view));
  if (slice?.swatchUrl) urls.push(slice.swatchUrl);
  return normalizeProductImageUrls(urls);
}

function variantFromSlice(
  tile: FreePeopleTile,
  styleNumber: string,
  slice: FreePeopleColorSlice,
  productName: string,
): PilotProductVariant {
  const colorCode = nonBlank(slice.code) ?? "000";
  const colorName = nonBlank(slice.displayName) ?? colorCode;
  const images = imagesForColor(tile, styleNumber, colorCode);
  return {
    title: `${productName} — ${colorName}`,
    color: colorName,
    sku: nonBlank(slice.id) ?? `${styleNumber}_${colorCode}`,
    imageUrl: images[0] ?? null,
    images,
  };
}

function emptyStats(): FreePeopleParseStats {
  return {
    tilesSeen: 0,
    editorialSkipped: 0,
    nonFootwearRejected: 0,
    duplicateCount: 0,
    sourceReportedProductCount: null,
    totalPages: null,
    currentPage: null,
    colorFromPiniaSlice: 0,
    colorFromImageCode: 0,
    colorFromUrlQuery: 0,
    colorEmpty: 0,
    colorNameCount: 0,
    colorCodeOnlyCount: 0,
  };
}

function mergeProduct(existing: PilotProduct, incoming: PilotProduct): PilotProduct {
  const seenColors = new Set(
    existing.variants.map((variant) => (variant.sku ?? variant.color ?? "").toLowerCase()),
  );
  const extraVariants: PilotProductVariant[] = [];
  for (const variant of incoming.variants) {
    const key = (variant.sku ?? variant.color ?? "").toLowerCase();
    if (key && seenColors.has(key)) continue;
    if (key) seenColors.add(key);
    extraVariants.push(variant);
  }
  const images = normalizeProductImageUrls([
    ...(existing.images ?? []),
    existing.imageUrl,
    ...(incoming.images ?? []),
    incoming.imageUrl,
  ]);
  return {
    ...existing,
    images,
    imageUrl: pickHighestResolutionUrl(images) ?? existing.imageUrl,
    variants: [...existing.variants, ...extraVariants],
    color: nonBlank(existing.color) ?? nonBlank(incoming.color),
    details: existing.details ?? incoming.details,
  };
}

export function parseFreePeopleTiles(
  tiles: FreePeopleTile[],
  options?: {
    discoveredAt?: string;
    collectionUrl?: string;
    collectionPath?: string;
    stats?: FreePeopleParseStats;
  },
): FreePeopleParseResult {
  const discoveredAt = options?.discoveredAt ?? new Date().toISOString();
  const collectionUrl = options?.collectionUrl ?? FREE_PEOPLE_SHOES_URL;
  const collectionPath = options?.collectionPath ?? "/shoes/";
  const stats = options?.stats ?? emptyStats();
  const byStyle = new Map<string, PilotProduct>();
  const categoryName = "Shoes";
  const isNew = isNewArrivalsCollectionPath(collectionPath);

  for (const tile of tiles) {
    stats.tilesSeen += 1;
    if ((tile.recordType ?? "PRODUCT") !== "PRODUCT" || !tile.product) {
      stats.editorialSkipped += 1;
      continue;
    }
    const product = tile.product;
    const brand = product.brand?.trim() ?? "";
    const name = product.displayName?.trim() ?? "";
    const slug = product.productSlug?.trim() ?? "";
    const styleNumber = extractFreePeopleStyleNumber({
      styleNumber: product.styleNumber,
      sku: product.productId,
      imageUrl: tile.faceOutImage ?? product.defaultImage,
    });
    if (!brand || !name || !slug) {
      stats.editorialSkipped += 1;
      continue;
    }
    if (isFreePeopleNonFootwear(name, slug)) {
      stats.nonFootwearRejected += 1;
      continue;
    }

    const slices = colorSlices(tile);
    const resolved = resolveFreePeopleFaceColor({ tile, slices });
    const colorCode = resolved.colorCode;
    const faceColor = resolved.color;
    const variants =
      slices.length > 0
        ? slices.map((slice) => variantFromSlice(tile, styleNumber ?? slug, slice, name))
        : [
            {
              title: faceColor ? `${name} — ${faceColor}` : name,
              color: faceColor,
              sku: styleNumber && colorCode ? `${styleNumber}_${colorCode}` : styleNumber,
              imageUrl:
                styleNumber && colorCode
                  ? freePeopleImageUrl(styleNumber, colorCode, "a")
                  : null,
              images:
                styleNumber && colorCode ? imagesForColor(tile, styleNumber, colorCode) : [],
            } satisfies PilotProductVariant,
          ];
    const images = normalizeProductImageUrls(variants.flatMap((variant) => variant.images ?? []));
    const listPrice = tile.skuInfo?.listPriceLow ?? tile.skuInfo?.listPriceHigh ?? null;
    const salePrice = tile.skuInfo?.salePriceLow ?? tile.skuInfo?.salePriceHigh ?? null;
    const gate = evaluateFootwearProduct({
      title: name,
      handle: slug,
      collectionPath,
      fromVerifiedFootwearCollection: true,
    });
    const category: FootwearCategory | null = STRONG_FOOTWEAR_NAME.test(`${name} ${slug}`)
      ? gate.category
      : (gate.category ?? "OTHER_FOOTWEAR");

    const detailParts: string[] = [];
    if (listPrice != null || salePrice != null) {
      detailParts.push(`price=${salePrice ?? listPrice} listPrice=${listPrice ?? ""} currency=USD`);
    }
    if (resolved.source !== "none") {
      detailParts.push(`colorSource=${resolved.source}`);
      if (colorCode) detailParts.push(`colorCode=${colorCode}`);
    }

    const parsed: PilotProduct = {
      source: FREE_PEOPLE_ID,
      brand,
      productName: name,
      productUrl: freePeopleProductUrl(slug, colorCode),
      imageUrl: pickHighestResolutionUrl(images) ?? images[0] ?? null,
      images,
      category: category ?? "OTHER_FOOTWEAR",
      color: faceColor,
      material: null,
      toeShape: null,
      heelType: null,
      heelHeight: null,
      details: detailParts.length > 0 ? detailParts.join(" ") : null,
      discoveredAt,
      collectionPath,
      collectionLabel: categoryName,
      sourceCategoryId: slugifyCategoryId(categoryName),
      sourceCategoryName: categoryName,
      sourceCategoryPath: collectionPath,
      sourceCategoryUrl: collectionUrl,
      isNewArrivalsCollection: isNew,
      hasNewBadge: false,
      variants,
    };

    const identity = styleNumber ?? slug.toLowerCase();
    const existing = byStyle.get(identity);
    if (existing) {
      stats.duplicateCount += 1;
      byStyle.set(identity, mergeProduct(existing, parsed));
    } else {
      byStyle.set(identity, parsed);
    }
  }

  const products = [...byStyle.values()];
  stats.colorFromPiniaSlice = 0;
  stats.colorFromImageCode = 0;
  stats.colorFromUrlQuery = 0;
  stats.colorEmpty = 0;
  stats.colorNameCount = 0;
  stats.colorCodeOnlyCount = 0;
  for (const product of products) {
    const sourceMatch = product.details?.match(/colorSource=([a-z-]+)/i);
    const source = (sourceMatch?.[1] ?? "none") as FreePeopleColorSource | "none";
    const color = nonBlank(product.color);
    if (!color) {
      stats.colorEmpty += 1;
      continue;
    }
    if (/^\d{2,3}$/.test(color)) stats.colorCodeOnlyCount += 1;
    else stats.colorNameCount += 1;
    if (source === "pinia-slice") stats.colorFromPiniaSlice += 1;
    else if (source === "image-code") stats.colorFromImageCode += 1;
    else if (source === "url-query") stats.colorFromUrlQuery += 1;
  }

  return { products, stats };
}

export function parseFreePeoplePiniaCategory(
  category: FreePeopleCategoryState | null | undefined,
  options?: { discoveredAt?: string; collectionUrl?: string; onlyPage?: number | "all" },
): FreePeopleParseResult {
  const stats = emptyStats();
  stats.totalPages = category?.totalPages ?? null;
  stats.currentPage = category?.currentPage ?? null;
  stats.sourceReportedProductCount = category?.totalRecordCount ?? null;
  const pages = category?.pages ?? {};
  const onlyPage = options?.onlyPage ?? "all";
  const tiles: FreePeopleTile[] = [];
  if (onlyPage === "all") {
    for (const page of Object.values(pages)) {
      tiles.push(...tilesFromPage(page));
    }
  } else {
    const key = String(onlyPage);
    tiles.push(...tilesFromPage(pages[key]));
  }
  const collectionPath = category?.slug ? `/${category.slug}/` : "/shoes/";
  return parseFreePeopleTiles(tiles, {
    ...options,
    collectionPath,
    collectionUrl: options?.collectionUrl ?? `${FREE_PEOPLE_BASE}${collectionPath}`,
    stats,
  });
}

function jsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(match[1]!));
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return blocks;
}

function flattenJsonLd(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  const record = asRecord(value);
  if (!record) return [];
  if (record["@graph"]) return flattenJsonLd(record["@graph"]);
  return [record];
}

function brandFromJsonLd(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  const record = asRecord(value);
  if (typeof record?.name === "string" && record.name.trim()) return record.name.trim();
  return null;
}

export function parseFreePeopleJsonLd(
  html: string,
  options?: { discoveredAt?: string; collectionUrl?: string },
): FreePeopleParseResult {
  const stats = emptyStats();
  const tiles: FreePeopleTile[] = [];
  for (const block of jsonLdBlocks(html).flatMap(flattenJsonLd)) {
    const record = asRecord(block);
    if (!record || record["@type"] !== "ItemList") continue;
    const elements = Array.isArray(record.itemListElement) ? record.itemListElement : [];
    for (const element of elements) {
      const node = asRecord(element);
      const item = asRecord(node?.item) ?? node;
      if (!item) continue;
      const url = typeof item.url === "string" ? item.url : typeof item["@id"] === "string" ? item["@id"] : "";
      const slug = /\/shop\/([^/?#]+)/i.exec(url)?.[1] ?? "";
      const image = Array.isArray(item.image) ? item.image[0] : item.image;
      const imageUrl = typeof image === "string" ? image : null;
      const styleNumber = extractFreePeopleStyleNumber({ imageUrl, productUrl: url });
      let color: string | null = null;
      try {
        color = url ? new URL(url, FREE_PEOPLE_BASE).searchParams.get("color") : null;
      } catch {
        color = null;
      }
      tiles.push({
        recordType: "PRODUCT",
        faceOutColorCode: color,
        faceOutImage: imageUrl ?? undefined,
        product: {
          brand: brandFromJsonLd(item.brand) ?? undefined,
          displayName: typeof item.name === "string" ? item.name : undefined,
          productSlug: slug,
          styleNumber,
          defaultColorCode: color,
        },
      });
    }
  }
  return parseFreePeopleTiles(tiles, { ...options, stats });
}

export function parseFreePeopleRenderedTiles(
  html: string,
  options?: { discoveredAt?: string; collectionUrl?: string },
): FreePeopleParseResult {
  const stats = emptyStats();
  const tiles: FreePeopleTile[] = [];
  const seen = new Set<string>();
  const pattern =
    /href="(https?:\/\/www\.freepeople\.com)?\/shop\/([^"/?#]+)\/?(?:\?[^"]*)?"[^>]*>[\s\S]{0,400}?<h2[^>]*>([^<]+)<\/h2>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const slug = match[2]!;
    const name = match[3]!.trim();
    if (seen.has(slug)) continue;
    seen.add(slug);
    tiles.push({
      recordType: "PRODUCT",
      product: {
        brand: undefined,
        displayName: name,
        productSlug: slug,
      },
    });
  }
  return parseFreePeopleTiles(
    tiles.filter((tile) => tile.product?.brand),
    { ...options, stats },
  );
}

export function parseFreePeoplePage(
  input: { piniaCategory?: FreePeopleCategoryState | null; html?: string },
  options?: { discoveredAt?: string; collectionUrl?: string; onlyPage?: number | "all" },
): FreePeopleParseResult {
  const pinia = parseFreePeoplePiniaCategory(input.piniaCategory, options);
  if (pinia.products.length > 0) return pinia;
  if (input.html) {
    const jsonLd = parseFreePeopleJsonLd(input.html, options);
    if (jsonLd.products.length > 0) return jsonLd;
  }
  return pinia.stats.tilesSeen > 0 || !input.html
    ? pinia
    : parseFreePeopleJsonLd(input.html ?? "", options);
}

export async function collectFreePeople(): Promise<{
  products: PilotProduct[];
  errors: string[];
  blocked: boolean;
  coverageStatus: "FAILED" | "NEEDS_PROBE";
  blocker: string;
}> {
  return {
    products: [],
    errors: [],
    blocked: false,
    coverageStatus: "NEEDS_PROBE",
    blocker:
      "Free People retailer collector is staging-only (npm run collect:free-people-staging). Production catalog merge is disabled.",
  };
}
