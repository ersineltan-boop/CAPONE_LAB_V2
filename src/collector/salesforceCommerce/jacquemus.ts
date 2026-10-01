import type { SalesforceCatalog, SalesforceHttp, SalesforceScope } from "./types";

export const JACQUEMUS_ORIGIN = "https://www.jacquemus.com";

export const JACQUEMUS_SCOPE: SalesforceScope = {
  brand: "JACQUEMUS",
  slug: "jacquemus",
  officialUrl: JACQUEMUS_ORIGIN,
  storefront: "en-us",
  country: "US",
  collectionUrl: "https://www.jacquemus.com/en-us/",
  collectionId: "unknown",
  sourceStrategy: "salesforce-public-unavailable",
  storefrontCurrency: null,
};

export const JACQUEMUS_PROBE_URLS = [
  "https://www.jacquemus.com/",
  "https://www.jacquemus.com/en-us/",
  "https://www.jacquemus.com/robots.txt",
  "https://www.jacquemus.com/sitemap.xml",
  "https://www.jacquemus.com/on/demandware.store/Sites-JacquemusUS-Site/en_US/Search-Show?cgid=women-shoes",
] as const;

export function jacquemusPageTitle(html: string): string | null {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim();
  return title || null;
}

export function isJacquemusStorefrontBlocked(input: { status: number; html: string }): boolean {
  if (input.status === 401 || input.status === 403 || input.status === 429) return true;
  return /site en cours de maintenance|access denied|attention required|cf-challenge|akamai/i.test(input.html);
}

export async function collectJacquemusWomensShoes(
  http: SalesforceHttp,
  options: { collectedAt?: string } = {},
): Promise<SalesforceCatalog> {
  const attempts: Array<{ url: string; status: number; title: string | null }> = [];
  const errors: string[] = [];
  for (const url of JACQUEMUS_PROBE_URLS) {
    const response = await http.fetchText(url);
    const title = jacquemusPageTitle(response.text);
    attempts.push({ url, status: response.status, title });
    if (isJacquemusStorefrontBlocked({ status: response.status, html: response.text })) {
      errors.push(`${url} HTTP ${response.status || 0}${title ? ` (${title})` : ""}`);
      continue;
    }
    errors.push(`${url} returned HTTP ${response.status} without a verified women's footwear catalog`);
  }

  return {
    scope: JACQUEMUS_SCOPE,
    collectedAt: options.collectedAt ?? new Date().toISOString(),
    status: "BLOCKED",
    blocker: "OFFICIAL_STOREFRONT_BLOCKED",
    sourceReportedTotal: null,
    scopeProductUrls: [],
    accepted: [],
    quarantined: [],
    families: [],
    pagesVisited: attempts.map((attempt) => attempt.url),
    paginationExhausted: false,
    errors,
    newProducts: 0,
    attempts,
  };
}
