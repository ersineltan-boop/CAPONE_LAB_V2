import {
  FREE_PEOPLE_ID,
  FREE_PEOPLE_SHOES_URL,
  isFreePeopleAntiBot,
  parseFreePeoplePage,
  parseFreePeopleJsonLd,
  extractFreePeopleStyleNumber,
  type FreePeopleCategoryState,
  type FreePeopleParseStats,
} from "./freePeople";
import type { PilotProduct } from "./types";

export type FreePeopleBrowserStatus = "COLLECTED" | "BLOCKED" | "NEEDS_PLAYWRIGHT";

export interface FreePeopleBrowserResult {
  status: FreePeopleBrowserStatus;
  products: PilotProduct[];
  errors: string[];
  pagesVisited: number;
  stats: FreePeopleParseStats;
  paginationExhausted: boolean;
  sourceReportedProductCount: number | null;
}

const DEFAULT_MAX_PAGES = 40;

export function freePeopleBrowserProductKey(product: PilotProduct): string {
  const styleNumber = extractFreePeopleStyleNumber({
    sku: product.variants?.[0]?.sku ?? null,
    productUrl: product.productUrl,
    imageUrl: product.imageUrl,
  });
  if (styleNumber) return `style:${styleNumber}`;

  try {
    const url = new URL(product.productUrl);
    const pathname = url.pathname.replace(/\/+$/, "").toLowerCase();
    return `url:${url.origin.toLowerCase()}${pathname}`;
  } catch {
    return `name:${product.brand.trim().toLowerCase()}:${product.productName.trim().toLowerCase()}`;
  }
}

function shoesPageUrl(page: number): string {
  return page <= 1 ? FREE_PEOPLE_SHOES_URL : `${FREE_PEOPLE_SHOES_URL}?page=${page}`;
}

export async function collectFreePeopleWithBrowser(options?: {
  headless?: boolean;
  maxPages?: number;
  startPage?: number;
  allowHeadedRetry?: boolean;
}): Promise<FreePeopleBrowserResult> {
  let playwright: typeof import("playwright") | null = null;
  try {
    playwright = await import("playwright");
  } catch {
    return {
      status: "NEEDS_PLAYWRIGHT",
      products: [],
      errors: ["Playwright is not installed — Free People browser collector cannot run"],
      pagesVisited: 0,
      stats: {
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
      },
      paginationExhausted: false,
      sourceReportedProductCount: null,
    };
  }

  const maxPages = options?.maxPages ?? DEFAULT_MAX_PAGES;
  const startPage = options?.startPage ?? 1;
  const discoveredAt = new Date().toISOString();
  const products: PilotProduct[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const stats: FreePeopleParseStats = {
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
  let pagesVisited = 0;
  let blocked = false;
  let sourceReported: number | null = null;
  let totalPages = maxPages;

  const launchOptions = {
    headless: options?.headless !== false,
    args: ["--disable-dev-shm-usage"],
  };
  let browser;
  try {
    browser = await playwright.chromium.launch({ ...launchOptions, channel: "chrome" });
  } catch {
    browser = await playwright.chromium.launch(launchOptions);
  }
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    serviceWorkers: "block",
  });
  const page = await context.newPage();

  try {
    for (let pageNum = startPage; pageNum <= Math.min(maxPages, totalPages); pageNum += 1) {
      const url = shoesPageUrl(pageNum);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(3500);
      try {
        await page.waitForFunction(
          (expectedPage) => {
            const urbn = (window as unknown as {
              urbn?: {
                initialPiniaState?: {
                  category?: {
                    pages?: Record<string, unknown>;
                    currentPage?: number;
                  };
                };
              };
            }).urbn;
            const category = urbn?.initialPiniaState?.category;
            if (!category?.pages) return false;
            if (expectedPage <= 1) return true;
            return (
              category.currentPage === expectedPage ||
              Boolean(category.pages[String(expectedPage)])
            );
          },
          pageNum,
          { timeout: 20000 },
        );
      } catch {
        const html = await page.content();
        if (isFreePeopleAntiBot(403, html) || (html.length < 4000 && isFreePeopleAntiBot(0, html))) {
          blocked = true;
          errors.push(`Free People anti-bot/challenge page at ${url}`);
          break;
        }
      }

      const html = await page.content();
      if (html.length < 4000 && isFreePeopleAntiBot(0, html)) {
        blocked = true;
        errors.push(`Free People anti-bot/challenge page at ${url}`);
        break;
      }

      const piniaCategory = await page.evaluate(() => {
        const urbn = (window as unknown as { urbn?: { initialPiniaState?: { category?: unknown } } }).urbn;
        return (urbn?.initialPiniaState?.category ?? null) as FreePeopleCategoryState | null;
      });

      const piniaParsed = parseFreePeoplePage(
        { piniaCategory, html },
        {
          discoveredAt,
          collectionUrl: FREE_PEOPLE_SHOES_URL,
          onlyPage: pageNum,
        },
      );

      let parsed = piniaParsed;
      const reportedCurrentPage = piniaCategory?.currentPage ?? null;
      if (pageNum > 1 && !piniaCategory?.pages?.[String(pageNum)] && reportedCurrentPage !== pageNum) {
        const htmlParsed = parseFreePeopleJsonLd(html, {
          discoveredAt,
          collectionUrl: FREE_PEOPLE_SHOES_URL,
        });
        if (htmlParsed.products.length > 0) {
          htmlParsed.stats.currentPage = pageNum;
          htmlParsed.stats.totalPages = piniaCategory?.totalPages ?? stats.totalPages;
          htmlParsed.stats.sourceReportedProductCount =
            piniaCategory?.totalRecordCount ?? stats.sourceReportedProductCount;
          parsed = htmlParsed;
          errors.push(
            `Pinia pagination mismatch at page ${pageNum} (reported ${reportedCurrentPage ?? "unknown"}); used page HTML fallback`,
          );
        }
      }
      pagesVisited += 1;
      stats.tilesSeen += parsed.stats.tilesSeen;
      stats.editorialSkipped += parsed.stats.editorialSkipped;
      stats.nonFootwearRejected += parsed.stats.nonFootwearRejected;
      stats.duplicateCount += parsed.stats.duplicateCount;
      stats.colorFromPiniaSlice += parsed.stats.colorFromPiniaSlice;
      stats.colorFromImageCode += parsed.stats.colorFromImageCode;
      stats.colorFromUrlQuery += parsed.stats.colorFromUrlQuery;
      stats.colorEmpty += parsed.stats.colorEmpty;
      stats.colorNameCount += parsed.stats.colorNameCount;
      stats.colorCodeOnlyCount += parsed.stats.colorCodeOnlyCount;
      stats.currentPage = parsed.stats.currentPage ?? pageNum;
      if (parsed.stats.totalPages) {
        stats.totalPages = parsed.stats.totalPages;
        totalPages = parsed.stats.totalPages;
      }
      if (parsed.stats.sourceReportedProductCount != null) {
        sourceReported = parsed.stats.sourceReportedProductCount;
        stats.sourceReportedProductCount = sourceReported;
      }

      if (parsed.products.length === 0) {
        errors.push(`No footwear tiles parsed at ${url}`);
        break;
      }

      let added = 0;
      for (const product of parsed.products) {
        const key = freePeopleBrowserProductKey(product);
        if (seen.has(key)) {
          stats.duplicateCount += 1;
          continue;
        }
        seen.add(key);
        products.push(product);
        added += 1;
      }
      if (added === 0) {
        errors.push(`No new footwear products added at ${url}; continuing pagination`);
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  } finally {
    await context.close();
    await browser.close();
  }

  const incomplete =
    sourceReported != null &&
    sourceReported > 0 &&
    products.length < Math.floor(sourceReported * 0.5);

  if (
    !blocked && (products.length === 0 || incomplete) &&
    options?.headless !== false &&
    options?.allowHeadedRetry !== false
  ) {
    return collectFreePeopleWithBrowser({
      ...options,
      headless: false,
      allowHeadedRetry: false,
    });
  }
  if (incomplete) {
    errors.push(
      `Incomplete Free People collect: parsed ${products.length} of source-reported ${sourceReported} products`,
    );
  }

  return {
    status: blocked || incomplete ? "BLOCKED" : products.length > 0 ? "COLLECTED" : "BLOCKED",
    products,
    errors,
    pagesVisited,
    stats,
    paginationExhausted: !blocked && errors.length === 0 && stats.totalPages != null && pagesVisited >= stats.totalPages,
    sourceReportedProductCount: sourceReported,
  };
}

export { FREE_PEOPLE_ID };
