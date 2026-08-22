import { extractProductsFromHtml, isBotChallengePage, MYTHERESA_SHOE_CATEGORIES, type MytheresaCategory } from "./mytheresa";
import type { PilotProduct } from "./types";
import { isNewArrivalsCollectionPath } from "../newArrivals/detectNewness";
import { slugifyCategoryId } from "../source/sourceCategories";

export type MytheresaBrowserStatus = "COLLECTED" | "BLOCKED" | "NEEDS_PLAYWRIGHT";

export interface MytheresaBrowserResult {
  status: MytheresaBrowserStatus;
  products: PilotProduct[];
  categories: MytheresaCategory[];
  errors: string[];
  pagesVisited: number;
}

function toPilot(
  item: ReturnType<typeof extractProductsFromHtml>[number],
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
    sourceCategories: [
      {
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        categoryPath: category.categoryPath,
        categoryUrl: category.categoryUrl,
      },
    ],
    isNewArrivalsCollection: isNew,
    hasNewBadge: isNew,
    variants: [{ title: item.name, color: null, sku: null }],
  };
}

export function parseMytheresaRenderedHtml(
  html: string,
  category: MytheresaCategory,
  discoveredAt = new Date().toISOString(),
): { blocked: boolean; products: PilotProduct[] } {
  if (isBotChallengePage(html)) {
    return { blocked: true, products: [] };
  }
  const parsed = extractProductsFromHtml(html);
  return {
    blocked: false,
    products: parsed.map((item) => toPilot(item, category, discoveredAt)),
  };
}

export async function collectMytheresaWithBrowser(options?: {
  headless?: boolean;
  maxPagesPerCategory?: number;
  categories?: MytheresaCategory[];
}): Promise<MytheresaBrowserResult> {
  let playwright: typeof import("playwright") | null = null;
  try {
    playwright = await import("playwright");
  } catch {
    return {
      status: "NEEDS_PLAYWRIGHT",
      products: [],
      categories: [],
      errors: ["Playwright yüklü değil — tarayıcı collector çalıştırılamadı"],
      pagesVisited: 0,
    };
  }

  const categories = options?.categories ?? MYTHERESA_SHOE_CATEGORIES;
  const maxPages = options?.maxPagesPerCategory ?? 8;
  const discoveredAt = new Date().toISOString();
  const products: PilotProduct[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let pagesVisited = 0;
  let blocked = false;

  const browser = await playwright.chromium.launch({
    headless: options?.headless !== false,
  });
  const page = await browser.newPage();

  try {
    for (const category of categories) {
      for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
        const url =
          pageNum === 1
            ? `https://www.mytheresa.com${category.categoryPath}`
            : `https://www.mytheresa.com${category.categoryPath}?page=${pageNum}`;
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForTimeout(2500);
        const html = await page.content();
        pagesVisited += 1;

        const parsed = parseMytheresaRenderedHtml(html, category, discoveredAt);
        if (parsed.blocked) {
          blocked = true;
          errors.push(`Mytheresa challenge/CAPTCHA sayfası (${url}) — ürün uydurulmadı`);
          break;
        }
        if (parsed.products.length === 0) break;

        let added = 0;
        for (const product of parsed.products) {
          if (seen.has(product.productUrl)) continue;
          seen.add(product.productUrl);
          products.push(product);
          added += 1;
        }
        if (added === 0) break;
      }
      if (blocked) break;
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  } finally {
    await browser.close();
  }

  return {
    status: blocked ? "BLOCKED" : products.length > 0 ? "COLLECTED" : "BLOCKED",
    products,
    categories,
    errors,
    pagesVisited,
  };
}

export function categoryIdFromPath(path: string): string {
  return slugifyCategoryId(path.split("/").pop() ?? path);
}
