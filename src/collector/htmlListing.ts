import { fetchText, sleep } from "./http";
import { parseProductPageSchema } from "./schemaOrg";
import type { PilotProduct, PilotSourceConfig } from "./types";
import {
  FULL_HTML_LISTING_PAGE_CAP,
  LEGACY_HTML_LISTING_PAGE_CAP,
  fullModeIgnoresProductCap,
} from "./fullCoveragePaths";

const PRODUCT_LINK =
  /href=["']([^"']*(?:\/products\/[^"'#?]+|\/en(?:-[a-z]{2})?\/products\/[^"'#?]+))["']/gi;

function normalizeProductUrl(href: string, baseUrl: string): string | null {
  try {
    const absolute = href.startsWith("http")
      ? new URL(href)
      : new URL(href, baseUrl);
    if (!absolute.pathname.includes("/products/")) return null;
    if (absolute.origin !== new URL(baseUrl).origin) return null;
    return absolute.href.split("?")[0].replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function extractProductUrlsFromHtml(
  html: string,
  baseUrl: string,
): string[] {
  const urls = new Set<string>();

  for (const match of html.matchAll(PRODUCT_LINK)) {
    const normalized = normalizeProductUrl(match[1] ?? "", baseUrl);
    if (normalized) urls.add(normalized);
  }

  return [...urls];
}

export async function collectHtmlListingProducts(
  config: PilotSourceConfig,
  collectionPaths: string[],
): Promise<{
  products: PilotProduct[];
  discoveredLinks: Set<string>;
  errors: string[];
}> {
  const discoveredLinks = new Set<string>();
  const products: PilotProduct[] = [];
  const errors: string[] = [];
  const discoveredAt = new Date().toISOString();
  const seenProducts = new Set<string>();

  const ignoreProductCap = fullModeIgnoresProductCap(config.collectMode);
  const pageCap = ignoreProductCap ? FULL_HTML_LISTING_PAGE_CAP : LEGACY_HTML_LISTING_PAGE_CAP;

  for (const collectionPath of collectionPaths) {
    if (!ignoreProductCap && products.length >= config.maxProducts) break;

    let page = 1;
    while ((ignoreProductCap || products.length < config.maxProducts) && page <= pageCap) {
      const suffix = page === 1 ? "" : `?page=${page}`;
      const listingUrl = `${config.baseUrl.replace(/\/$/, "")}${collectionPath}${suffix}`;
      const result = await fetchText(listingUrl, { delayMs: 1400 });

      if (!result.ok) {
        errors.push(`HTTP ${result.status} for ${listingUrl}`);
        break;
      }

      const productUrls = extractProductUrlsFromHtml(result.text, config.baseUrl);
      if (productUrls.length === 0) break;

      for (const productUrl of productUrls) {
        discoveredLinks.add(productUrl);
        if (seenProducts.has(productUrl)) continue;
        if (!ignoreProductCap && products.length >= config.maxProducts) break;

        seenProducts.add(productUrl);
        try {
          const product = await parseProductPageSchema(
            productUrl,
            config,
            discoveredAt,
          );
          if (product) products.push(product);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(`${productUrl}: ${message}`);
        }

        await sleep(1100);
      }

      page += 1;
    }
  }

  return { products, discoveredLinks, errors };
}
