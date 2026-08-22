import { fetchText } from "./http";
import { sleep } from "./http";
import type { PilotProduct } from "./types";
import { slugifyCategoryId, humanizeCollectionHandle } from "../source/sourceCategories";
import { isNewArrivalsCollectionPath } from "../newArrivals/detectNewness";

const BASE_URL = "https://www.mytheresa.com";
const LOCALE_PATH = "/us/en/women/shoes";

export interface MytheresaCategory {
  categoryId: string;
  categoryName: string;
  categoryPath: string;
  categoryUrl: string;
}

export const MYTHERESA_SHOE_CATEGORIES: MytheresaCategory[] = [
  { categoryId: "ballet-flats", categoryName: "Ballet flats", categoryPath: "/us/en/women/shoes/ballet-flats", categoryUrl: `${BASE_URL}/us/en/women/shoes/ballet-flats` },
  { categoryId: "boots", categoryName: "Boots", categoryPath: "/us/en/women/shoes/boots", categoryUrl: `${BASE_URL}/us/en/women/shoes/boots` },
  { categoryId: "espadrilles", categoryName: "Espadrilles", categoryPath: "/us/en/women/shoes/espadrilles", categoryUrl: `${BASE_URL}/us/en/women/shoes/espadrilles` },
  { categoryId: "loafers", categoryName: "Loafers", categoryPath: "/us/en/women/shoes/loafers", categoryUrl: `${BASE_URL}/us/en/women/shoes/loafers` },
  { categoryId: "mules", categoryName: "Mules", categoryPath: "/us/en/women/shoes/mules", categoryUrl: `${BASE_URL}/us/en/women/shoes/mules` },
  { categoryId: "pumps", categoryName: "Pumps", categoryPath: "/us/en/women/shoes/pumps", categoryUrl: `${BASE_URL}/us/en/women/shoes/pumps` },
  { categoryId: "sandals", categoryName: "Sandals", categoryPath: "/us/en/women/shoes/sandals", categoryUrl: `${BASE_URL}/us/en/women/shoes/sandals` },
  { categoryId: "sneakers", categoryName: "Sneakers", categoryPath: "/us/en/women/shoes/sneakers", categoryUrl: `${BASE_URL}/us/en/women/shoes/sneakers` },
  { categoryId: "new-arrivals", categoryName: "New Arrivals", categoryPath: "/us/en/women/shoes/new-arrivals", categoryUrl: `${BASE_URL}/us/en/women/shoes/new-arrivals` },
];

interface ParsedListingProduct {
  url: string;
  name: string;
  brand: string;
  imageUrl: string | null;
  images: string[];
}

export function isBotChallengePage(html: string): boolean {
  return (
    (html.length < 15000 && !html.includes("__NEXT_DATA__") && /sec-if-cpt-container|behavioral-content/i.test(html)) ||
    (/captcha|cf-challenge|datadome|px-captcha/i.test(html) && !html.includes("__NEXT_DATA__"))
  );
}

export function detectMytheresaHttpBlock(input: {
  status: number;
  html: string;
}): "OK" | "ANTI_BOT" | "CHALLENGE" {
  if (input.status === 403 || input.status === 429 || input.status === 503) return "ANTI_BOT";
  if (isBotChallengePage(input.html)) return "CHALLENGE";
  return "OK";
}

function extractNextData(html: string): unknown | null {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function walkForProducts(node: unknown, found: ParsedListingProduct[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walkForProducts(item, found);
    return;
  }

  const record = node as Record<string, unknown>;
  const url = typeof record.url === "string" ? record.url : typeof record.slug === "string" ? record.slug : null;
  const name = typeof record.name === "string" ? record.name : typeof record.title === "string" ? record.title : null;
  const designer =
    typeof record.designer === "string"
      ? record.designer
      : typeof record.brand === "string"
        ? record.brand
        : typeof (record.designer as { name?: string } | undefined)?.name === "string"
          ? (record.designer as { name: string }).name
          : null;

  if (url && name && designer && (url.includes("/p/") || url.includes("/products/"))) {
    const absoluteUrl = url.startsWith("http")
      ? url
      : `${BASE_URL}${url.startsWith("/") ? url : `/${url}`}`;
    const images: string[] = [];
    if (typeof record.image === "string") images.push(record.image);
    if (Array.isArray(record.images)) {
      for (const image of record.images) {
        if (typeof image === "string") images.push(image);
        if (typeof image === "object" && image && typeof (image as { src?: string }).src === "string") {
          images.push((image as { src: string }).src);
        }
      }
    }
    found.push({
      url: absoluteUrl.split("?")[0]!,
      name,
      brand: designer,
      imageUrl: images[0] ?? null,
      images: [...new Set(images)],
    });
  }

  for (const value of Object.values(record)) {
    walkForProducts(value, found);
  }
}

export function extractProductsFromHtml(html: string): ParsedListingProduct[] {
  const found: ParsedListingProduct[] = [];
  const nextData = extractNextData(html);
  if (nextData) walkForProducts(nextData, found);

  const linkPattern = /href="(\/us\/en\/[^"]+\/p\/[^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(html)) !== null) {
    const url = `${BASE_URL}${match[1]}`;
    if (!found.some((item) => item.url === url)) {
      found.push({
        url,
        name: humanizeCollectionHandle(match[1].split("/").slice(-2, -1)[0] ?? "Product"),
        brand: "Unknown",
        imageUrl: null,
        images: [],
      });
    }
  }

  const deduped = new Map<string, ParsedListingProduct>();
  for (const item of found) deduped.set(item.url, item);
  return [...deduped.values()];
}

function toPilotProduct(
  item: ParsedListingProduct,
  category: MytheresaCategory,
  discoveredAt: string,
): PilotProduct {
  const isNew = isNewArrivalsCollectionPath(category.categoryPath);
  return {
    source: "mytheresa",
    brand: item.brand,
    productName: item.name,
    productUrl: item.url,
    imageUrl: item.imageUrl,
    images: item.images,
    category: "OTHER_FOOTWEAR",
    color: null,
    material: null,
    toeShape: null,
    heelType: null,
    heelHeight: null,
    details: null,
    discoveredAt,
    sourceCategoryId: category.categoryId,
    sourceCategoryName: category.categoryName,
    sourceCategoryPath: category.categoryPath,
    sourceCategoryUrl: category.categoryUrl,
    collectionPath: category.categoryPath,
    collectionLabel: category.categoryName,
    isNewArrivalsCollection: isNew,
    hasNewBadge: isNew,
    variants: [{ title: item.name, color: null, sku: null }],
  };
}

export async function collectMytheresaProducts(options?: {
  categories?: MytheresaCategory[];
  maxPagesPerCategory?: number;
}): Promise<{
  products: PilotProduct[];
  categories: MytheresaCategory[];
  errors: string[];
  paginationStatus: Record<string, { pagesFetched: number; productsFound: number }>;
}> {
  const categories = options?.categories ?? MYTHERESA_SHOE_CATEGORIES;
  const maxPages = options?.maxPagesPerCategory ?? 5;
  const discoveredAt = new Date().toISOString();
  const products: PilotProduct[] = [];
  const errors: string[] = [];
  const paginationStatus: Record<string, { pagesFetched: number; productsFound: number }> = {};
  const seenUrls = new Set<string>();

  for (const category of categories) {
    paginationStatus[category.categoryId] = { pagesFetched: 0, productsFound: 0 };
    for (let page = 1; page <= maxPages; page += 1) {
      const url =
        page === 1
          ? `${BASE_URL}${category.categoryPath}`
          : `${BASE_URL}${category.categoryPath}?page=${page}`;
      const result = await fetchText(url, { delayMs: 1800 });
      paginationStatus[category.categoryId]!.pagesFetched = page;
      if (!result.ok) {
        errors.push(result.error ?? `HTTP ${result.status} for ${url}`);
        break;
      }
      if (isBotChallengePage(result.text) || detectMytheresaHttpBlock({ status: result.status, html: result.text }) !== "OK") {
        errors.push(`Mytheresa bot koruması tespit edildi (${url}) — tarayıcı veya özel adapter gerekli`);
        break;
      }

      const parsed = extractProductsFromHtml(result.text);
      if (parsed.length === 0) break;

      let added = 0;
      for (const item of parsed) {
        if (seenUrls.has(item.url)) continue;
        seenUrls.add(item.url);
        products.push(toPilotProduct(item, category, discoveredAt));
        added += 1;
      }
      paginationStatus[category.categoryId]!.productsFound += added;
      if (added === 0) break;
      await sleep(1200);
    }
  }

  return { products, categories, errors, paginationStatus };
}

export function discoverMytheresaCategoriesFromHtml(html: string): MytheresaCategory[] {
  const categories = new Map<string, MytheresaCategory>();
  const pattern = /href="(\/us\/en\/women\/shoes\/[a-z0-9-]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const path = match[1]!;
    const name = humanizeCollectionHandle(path);
    categories.set(path, {
      categoryId: slugifyCategoryId(name),
      categoryName: name,
      categoryPath: path,
      categoryUrl: `${BASE_URL}${path}`,
    });
  }
  return [...categories.values()];
}
