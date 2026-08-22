import { fetchText, sleep } from "./http";
import { mergeProductCatalog } from "./mergeProducts";
import { evaluateFootwearProduct } from "./footwearGate";
import { isNewArrivalsCollectionPath, detectNewBadgeInText } from "../newArrivals/detectNewness";
import { slugifyCategoryId } from "../source/sourceCategories";
import { normalizeProductImageUrls } from "../images/resolveImageQuality";
import type { CollectionAttemptResult } from "./collectWithFallback";
import type { PilotProduct } from "./types";
import type { BrandRegistryEntry } from "../registry/types/brand";

export const ZARA_BRAND_ID = "zara";
export const ZARA_BRAND_NAME = "ZARA";
export const ZARA_BASE = "https://www.zara.com";
export const ZARA_LOCALE = "us/en";
export const ZARA_WOMAN_SHOES_VIEW_ALL_ID = 2419160;
export const ZARA_WOMAN_SHOES_ID = 2419159;

const JSON_HEADERS = {
  Accept: "application/json",
  Referer: `${ZARA_BASE}/${ZARA_LOCALE}/`,
  "X-Requested-With": "XMLHttpRequest",
};

const MIXED_OR_NON_FOOTWEAR =
  /bag|handbag|accessories|fragrance|beauty|home|pumpkin|gilet|vest|suit|dress|ready to wear/i;
const MENS_OR_KIDS = /\b(man|men|hombre|kid|ninos|niños|boy|girl|baby|toddler|mini)\b/i;

export interface ZaraCategoryNode {
  id: number;
  name: string;
  key?: string;
  sectionName?: string;
  seoKeyword?: string;
  seoCategoryId?: number;
  path: string[];
  subcategories: ZaraCategoryNode[];
}

export interface ZaraPaginationInfo {
  page?: number;
  pageSize?: number;
  isLastPage?: boolean;
}

interface ZaraSeo {
  keyword?: string;
  seoProductId?: string | number;
  seoCategoryId?: number;
  irrelevant?: boolean;
}

interface ZaraCommercialComponent {
  id?: number | string;
  type?: string;
  name?: string;
  reference?: string;
  familyName?: string;
  subfamilyName?: string;
  sectionName?: string;
  colorList?: string;
  seo?: ZaraSeo;
  xmedia?: unknown;
  detail?: { colors?: Array<{ name?: string; xmedia?: unknown }> };
  availableColors?: Array<{ name?: string }>;
  productTag?: Array<{ type?: string; name?: string } | string>;
  extraInfo?: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function zaraImageUrl(url: string): string {
  return url.replaceAll("{width}", "1200");
}

export function collectZaraImageUrls(node: unknown): string[] {
  const urls: string[] = [];
  const visit = (value: unknown, depth: number) => {
    if (!value || depth > 8) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    if (!isRecord(value)) return;
    if (typeof value.url === "string" && /\.(jpe?g|png|webp)(\?|$)/i.test(value.url)) {
      urls.push(zaraImageUrl(value.url));
    }
    if (isRecord(value.extraInfo) && typeof value.extraInfo.deliveryUrl === "string") {
      urls.push(zaraImageUrl(value.extraInfo.deliveryUrl));
    }
    if (value.xmedia) visit(value.xmedia, depth + 1);
    if (value.layers) visit(value.layers, depth + 1);
    if (value.colors) visit(value.colors, depth + 1);
    if (value.detail) visit(value.detail, depth + 1);
    if (value.pdpMedia) visit(value.pdpMedia, depth + 1);
  };
  visit(node, 0);
  return normalizeProductImageUrls(urls);
}

export function zaraProductUrl(seo: ZaraSeo | undefined, fallbackId?: number | string): string | null {
  const keyword = seo?.keyword?.trim();
  const seoProductId = String(seo?.seoProductId ?? "").trim() || String(fallbackId ?? "").trim();
  if (!keyword || !seoProductId || seo?.irrelevant) return null;
  return `${ZARA_BASE}/${ZARA_LOCALE}/${keyword}-p${seoProductId}.html`;
}

export function zaraColorNames(component: ZaraCommercialComponent): string[] {
  const names = new Set<string>();
  for (const part of (component.colorList ?? "").split("|")) {
    const name = part.trim();
    if (name) names.add(name);
  }
  for (const color of component.availableColors ?? []) {
    if (color.name?.trim()) names.add(color.name.trim());
  }
  for (const color of component.detail?.colors ?? []) {
    if (color.name?.trim()) names.add(color.name.trim());
  }
  return [...names];
}

export function extractZaraCommercialComponents(payload: unknown): ZaraCommercialComponent[] {
  if (!isRecord(payload)) return [];
  const groups = Array.isArray(payload.productGroups) ? payload.productGroups : [];
  const components: ZaraCommercialComponent[] = [];
  for (const group of groups) {
    if (!isRecord(group) || !Array.isArray(group.elements)) continue;
    for (const element of group.elements) {
      if (!isRecord(element) || !Array.isArray(element.commercialComponents)) continue;
      for (const raw of element.commercialComponents) {
        if (isRecord(raw)) components.push(raw as ZaraCommercialComponent);
      }
    }
  }
  return components;
}

export function parseZaraPagination(payload: unknown): ZaraPaginationInfo | null {
  if (!isRecord(payload) || !isRecord(payload.paginationInfo)) return null;
  const info = payload.paginationInfo;
  return {
    page: typeof info.page === "number" ? info.page : undefined,
    pageSize: typeof info.pageSize === "number" ? info.pageSize : undefined,
    isLastPage: typeof info.isLastPage === "boolean" ? info.isLastPage : undefined,
  };
}

function asCategoryNode(raw: unknown, path: string[]): ZaraCategoryNode | null {
  if (!isRecord(raw) || typeof raw.id !== "number") return null;
  const name = String(raw.name ?? raw.key ?? "").trim();
  const seo = isRecord(raw.seo) ? (raw.seo as ZaraSeo) : undefined;
  const children = Array.isArray(raw.subcategories) ? raw.subcategories : [];
  const nextPath = name ? [...path, name] : path;
  return {
    id: raw.id,
    name,
    key: typeof raw.key === "string" ? raw.key : undefined,
    sectionName: typeof raw.sectionName === "string" ? raw.sectionName : undefined,
    seoKeyword: seo?.keyword,
    seoCategoryId: seo?.seoCategoryId,
    path: nextPath,
    subcategories: children
      .map((child) => asCategoryNode(child, nextPath))
      .filter((child): child is ZaraCategoryNode => Boolean(child)),
  };
}

export function parseZaraCategoryTree(payload: unknown): ZaraCategoryNode[] {
  if (!isRecord(payload) || !Array.isArray(payload.categories)) return [];
  return payload.categories
    .map((node) => asCategoryNode(node, []))
    .filter((node): node is ZaraCategoryNode => Boolean(node));
}

function flattenCategories(nodes: ZaraCategoryNode[]): ZaraCategoryNode[] {
  return nodes.flatMap((node) => [node, ...flattenCategories(node.subcategories)]);
}

export function selectZaraWomensFootwearCategories(
  tree: ZaraCategoryNode[],
): ZaraCategoryNode[] {
  const woman = tree.find(
    (node) =>
      node.sectionName === "WOMAN" ||
      node.name.toUpperCase() === "WOMAN" ||
      /mujer/i.test(node.key ?? ""),
  );
  if (!woman) return [];

  const shoesRoot = flattenCategories([woman]).find(
    (node) =>
      node.id === ZARA_WOMAN_SHOES_ID ||
      (node.name.toUpperCase() === "SHOES" &&
        node.path.some((part) => /shoes/i.test(part)) &&
        !MENS_OR_KIDS.test(node.path.join(" "))),
  );
  if (!shoesRoot) return [];

  const selected = flattenCategories([shoesRoot]).filter((node) => {
    const label = `${node.name} ${node.key ?? ""}`;
    if (MENS_OR_KIDS.test(node.path.join(" "))) return false;
    if (MIXED_OR_NON_FOOTWEAR.test(node.name) && !/^shoes$/i.test(node.name) && !/view all/i.test(node.name)) {
      return false;
    }
    if (/shoes\s*\|\s*(bags|accessories)/i.test(label)) return false;
    return true;
  });

  const viewAll = flattenCategories([woman]).find((node) => node.id === ZARA_WOMAN_SHOES_VIEW_ALL_ID);
  if (viewAll && !selected.some((node) => node.id === viewAll.id)) selected.unshift(viewAll);
  return selected;
}

function categoryUrl(category: ZaraCategoryNode): string {
  const keyword = category.seoKeyword ?? "woman-shoes";
  const seoId = category.seoCategoryId ?? category.id;
  return `${ZARA_BASE}/${ZARA_LOCALE}/${keyword}-l${seoId}.html`;
}

function categoryAjaxUrl(category: ZaraCategoryNode, page: number): string {
  const base = categoryUrl(category);
  return page <= 1 ? `${base}?ajax=true` : `${base}?ajax=true&page=${page}`;
}

function categoryProductsUrl(category: ZaraCategoryNode): string {
  return `${ZARA_BASE}/${ZARA_LOCALE}/category/${category.id}/products?ajax=true`;
}

async function fetchZaraJson(
  url: string,
  delayMs: number,
): Promise<{ ok: boolean; status: number; payload: unknown; error?: string }> {
  const result = await fetchText(url, { delayMs, headers: JSON_HEADERS });
  if (!result.ok) {
    return { ok: false, status: result.status, payload: null, error: result.error ?? `HTTP ${result.status}` };
  }
  const trimmed = result.text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return { ok: false, status: result.status, payload: null, error: "Zara ajax did not return JSON" };
  }
  try {
    return { ok: true, status: result.status, payload: JSON.parse(trimmed) };
  } catch {
    return { ok: false, status: result.status, payload: null, error: "Invalid Zara JSON" };
  }
}

export function zaraComponentToProduct(
  component: ZaraCommercialComponent,
  category: ZaraCategoryNode,
  discoveredAt: string,
): PilotProduct | null {
  const name = component.name?.trim();
  const productUrl = zaraProductUrl(component.seo, component.id);
  if (!name || !productUrl) return null;

  const gate = evaluateFootwearProduct({
    title: name,
    productType: [component.familyName, component.subfamilyName, category.name].filter(Boolean).join(" "),
    tags: [component.sectionName, category.path.join(" ")].filter(
      (tag): tag is string => Boolean(tag),
    ),
    handle: component.seo?.keyword,
    collectionPath: new URL(categoryUrl(category)).pathname,
    fromVerifiedFootwearCollection: true,
  });
  if (gate.decision !== "ACCEPT_FOOTWEAR" || !gate.category) return null;

  const images = collectZaraImageUrls({
    xmedia: component.xmedia,
    detail: component.detail,
  });
  const colors = zaraColorNames(component);
  const tags = (component.productTag ?? []).map((tag) =>
    typeof tag === "string" ? tag : [tag.type, tag.name].filter(Boolean).join(" "),
  );
  const collectionPath = new URL(categoryUrl(category)).pathname;
  const isNewCollection =
    isNewArrivalsCollectionPath(collectionPath) || isNewArrivalsCollectionPath(category.path.join("/"));
  const hasNewBadge = detectNewBadgeInText(name, ...tags);

  return {
    source: ZARA_BRAND_ID,
    brand: ZARA_BRAND_NAME,
    productName: name,
    productUrl,
    imageUrl: images[0] ?? null,
    images,
    category: gate.category,
    color: colors[0] ?? null,
    material: null,
    toeShape: null,
    heelType: null,
    heelHeight: null,
    details: component.subfamilyName ?? component.familyName ?? null,
    discoveredAt,
    collectionPath,
    collectionLabel: category.name,
    sourceCategoryId: slugifyCategoryId(category.name),
    sourceCategoryName: category.name,
    sourceCategoryPath: collectionPath,
    sourceCategoryUrl: categoryUrl(category),
    sourceCategories: [
      {
        categoryId: slugifyCategoryId(category.name),
        categoryName: category.name,
        categoryPath: collectionPath,
        categoryUrl: categoryUrl(category),
      },
    ],
    isNewArrivalsCollection: isNewCollection,
    hasNewBadge,
    variants: colors.length
      ? colors.map((color) => ({ title: `${name} ${color}`, color, sku: null }))
      : [{ title: name, color: null, sku: null }],
  };
}

async function collectZaraCategory(
  category: ZaraCategoryNode,
  discoveredAt: string,
): Promise<{ products: PilotProduct[]; pages: number; exhausted: boolean; errors: string[] }> {
  const products: PilotProduct[] = [];
  const errors: string[] = [];
  let pages = 0;
  let exhausted = false;

  const bulk = await fetchZaraJson(categoryProductsUrl(category), 700);
  if (bulk.ok) {
    pages += 1;
    const mapped = extractZaraCommercialComponents(bulk.payload)
      .map((component) => zaraComponentToProduct(component, category, discoveredAt))
      .filter((item): item is PilotProduct => Boolean(item));
    products.push(...mapped);
    if (mapped.length > 0) {
      return { products, pages, exhausted: true, errors };
    }
  } else if (bulk.error) {
    errors.push(`${category.name}: ${bulk.error}`);
  }

  for (let page = 1; page <= 80; page += 1) {
    const result = await fetchZaraJson(categoryAjaxUrl(category, page), page === 1 ? 400 : 800);
    pages += 1;
    if (!result.ok) {
      if (result.error) errors.push(`${category.name} page ${page}: ${result.error}`);
      break;
    }
    const mapped = extractZaraCommercialComponents(result.payload)
      .map((component) => zaraComponentToProduct(component, category, discoveredAt))
      .filter((item): item is PilotProduct => Boolean(item));
    const before = products.length;
    products.push(...mapped);
    const pagination = parseZaraPagination(result.payload);
    if (pagination?.isLastPage || mapped.length === 0 || products.length === before) {
      exhausted = pagination?.isLastPage === true || mapped.length === 0;
      break;
    }
    if (page === 80) exhausted = false;
  }

  return { products, pages, exhausted, errors };
}

export async function collectZara(
  _entry?: BrandRegistryEntry,
): Promise<
  CollectionAttemptResult & {
    discoveryStatus: BrandRegistryEntry["collectionDiscoveryStatus"];
    footwearCollectionPath: string;
    footwearCollectionUrl: string;
    catalogFootwearCount: number;
    pagesTraversed: number;
    rawProductUrlsDiscovered: number;
    duplicateCount: number;
    paginationExhausted: boolean;
    sourceReportedProductCount: number | null;
    collectionsCrawled: string[];
  }
> {
  const discoveredAt = new Date().toISOString();
  const catalog = await fetchZaraJson(`${ZARA_BASE}/${ZARA_LOCALE}/categories?ajax=true`, 400);
  const errors: string[] = catalog.error ? [catalog.error] : [];
  const tree = catalog.ok ? parseZaraCategoryTree(catalog.payload) : [];
  const viewAll: ZaraCategoryNode = {
    id: ZARA_WOMAN_SHOES_VIEW_ALL_ID,
    name: "VIEW ALL",
    seoKeyword: "woman-shoes",
    seoCategoryId: 1251,
    path: ["WOMAN", "SHOES", "VIEW ALL"],
    subcategories: [],
  };
  const discovered = selectZaraWomensFootwearCategories(tree).filter(
    (category) => category.id !== ZARA_WOMAN_SHOES_VIEW_ALL_ID,
  );
  const categories = [viewAll, ...discovered];

  const collected: PilotProduct[] = [];
  const discoveredLinks = new Set<string>();
  let pagesTraversed = 0;
  let paginationExhausted = true;
  const collectionsCrawled: string[] = [];

  for (const category of categories) {
    collectionsCrawled.push(categoryUrl(category));
    const page = await collectZaraCategory(category, discoveredAt);
    pagesTraversed += page.pages;
    paginationExhausted = paginationExhausted && page.exhausted;
    errors.push(...page.errors);
    for (const product of page.products) discoveredLinks.add(product.productUrl);
    collected.push(...page.products);
    await sleep(250);
  }

  const merged = mergeProductCatalog([], collected);
  return {
    products: merged,
    discoveredLinks,
    errors,
    method: "custom-adapter",
    discoveryStatus: categories.length > 0 ? "VERIFIED" : "UNKNOWN",
    footwearCollectionPath: "/us/en/woman-shoes-l1251.html",
    footwearCollectionUrl: `${ZARA_BASE}/${ZARA_LOCALE}/woman-shoes-l1251.html`,
    catalogFootwearCount: merged.length,
    pagesTraversed,
    rawProductUrlsDiscovered: discoveredLinks.size,
    duplicateCount: Math.max(0, collected.length - merged.length),
    paginationExhausted,
    sourceReportedProductCount: null,
    collectionsCrawled,
  };
}
