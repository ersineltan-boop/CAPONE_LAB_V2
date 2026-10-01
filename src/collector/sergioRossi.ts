import { parseStorefrontProductCount } from "../brands/officialShopify/storefrontCount";
import { defaultOnboardingHttp, fetchMaybeJson, type OnboardingHttp } from "../onboarding/http";
import type { CollectionAttemptResult } from "./collectWithFallback";
import { shopifyProductToPilot } from "./shopify";
import type { FootwearCategory, PilotSourceConfig } from "./types";

type RawProduct = Parameters<typeof shopifyProductToPilot>[0];

export const SERGIO_ROSSI_WOMENS_SHOES_PATH = "/collections/womens-shoes";

export const SERGIO_ROSSI_COLLECTIONS: ReadonlyArray<{
  path: string;
  label: string;
  category: FootwearCategory;
}> = [
  { path: "/collections/pumps", label: "Pumps", category: "PUMP" },
  { path: "/collections/slingback", label: "Slingbacks", category: "SLINGBACK" },
  { path: "/collections/womens-sandals", label: "Sandals", category: "SANDAL" },
  { path: "/collections/ballet-flats", label: "Ballet Flats", category: "BALLERINA" },
  { path: "/collections/womens-loafers-and-slippers", label: "Loafers & Slippers", category: "LOAFER" },
  { path: "/collections/womens-elegant-sneakers", label: "Sneakers", category: "SNEAKER" },
  { path: "/collections/womens-ankle-boots-and-booties", label: "Ankle Boots & Booties", category: "ANKLE_BOOT" },
  { path: "/collections/womens-boots", label: "Boots", category: "BOOT" },
  { path: "/collections/bridal-and-ceremony-shoes", label: "Bridal & Ceremony Shoes", category: "PUMP" },
];

const PAGE_SIZE = 250;
const PAGE_CAP = 40;
const TRACKING_QUERY_KEYS = new Set(["shpxid"]);

function normalizedOfficialPath(pathname: string): string {
  const clean = pathname.replace(/\/$/, "");
  return clean.replace(/^\/[a-z]{2}(?:-[a-z]{2})?(?=\/collections\/)/i, "");
}

function sameOfficialScope(url: string, expectedPath: string, json = false): boolean {
  const resolved = new URL(url);
  if (resolved.protocol !== "https:" || resolved.hostname.replace(/^www\./i, "") !== "sergiorossi.com") {
    return false;
  }
  const suffix = json ? `${expectedPath}/products.json` : expectedPath;
  if (normalizedOfficialPath(resolved.pathname) !== suffix) return false;
  return [...resolved.searchParams.keys()].every((key) =>
    json ? key === "limit" || key === "page" || TRACKING_QUERY_KEYS.has(key) : TRACKING_QUERY_KEYS.has(key),
  );
}

function collectionRequestPath(resolvedUrl: string, fallbackPath: string): string {
  const resolved = new URL(resolvedUrl);
  const pathname = resolved.pathname.replace(/\/$/, "");
  return sameOfficialScope(resolvedUrl, fallbackPath) ? pathname : fallbackPath;
}

export function parseSergioRossiStorefrontCount(html: string): number | null {
  const shared = parseStorefrontProductCount(html);
  if (shared != null) return shared;
  const labeled = [...html.matchAll(/>\s*(\d[\d\s.,]*)\s*(?:items?)\s*</gi)]
    .map((match) => Number.parseInt((match[1] ?? "").replace(/[^\d]/g, ""), 10))
    .filter((count) => Number.isFinite(count) && count > 0);
  const unique = [...new Set(labeled)];
  return unique.length === 1 ? unique[0] ?? null : null;
}

/**
 * Sergio Rossi's public women's root is an editorial aggregation. The official
 * customer-visible category pages are authoritative: each printed count must
 * reconcile with its own Shopify products.json membership before activation.
 */
export async function collectSergioRossi(
  config: PilotSourceConfig,
  http: OnboardingHttp = defaultOnboardingHttp,
): Promise<CollectionAttemptResult & {
  categoryStorefrontCounts: Record<string, number | null>;
}> {
  const origin = new URL(config.baseUrl);
  if (origin.protocol !== "https:" || origin.hostname.replace(/^www\./i, "") !== "sergiorossi.com") {
    throw new Error("Sergio Rossi collector requires the official HTTPS storefront");
  }
  const base = origin.origin;
  const errors: string[] = [];
  const links = new Set<string>();
  const rawById = new Map<number, RawProduct>();
  const membership = new Map<number, (typeof SERGIO_ROSSI_COLLECTIONS)[number]>();
  const categoryStorefrontCounts: Record<string, number | null> = {};
  let pagesTraversed = 0;
  let paginationExhausted = true;

  const root = await http.fetchText(`${base}${SERGIO_ROSSI_WOMENS_SHOES_PATH}`);
  if (!root.ok || !sameOfficialScope(root.url, SERGIO_ROSSI_WOMENS_SHOES_PATH)) {
    errors.push(`SERGIO_ROSSI_ROOT_INVALID:${root.status}`);
  } else {
    for (const category of SERGIO_ROSSI_COLLECTIONS) {
      const handle = category.path.split("/").pop() ?? "";
      if (!new RegExp(`/collections/${handle}(?:["'/?#]|$)`, "i").test(root.text)) {
        errors.push(`SERGIO_ROSSI_ROOT_MISSING_CATEGORY:${handle}`);
      }
    }
  }

  for (const category of SERGIO_ROSSI_COLLECTIONS) {
    const page = await http.fetchText(`${base}${category.path}`);
    const count = page.ok && sameOfficialScope(page.url, category.path)
      ? parseSergioRossiStorefrontCount(page.text)
      : null;
    categoryStorefrontCounts[category.path] = count;
    if (count == null) {
      errors.push(`SERGIO_ROSSI_CATEGORY_COUNT_UNKNOWN:${category.path}:${page.status}`);
    }
    const requestPath = page.ok && sameOfficialScope(page.url, category.path)
      ? collectionRequestPath(page.url, category.path)
      : category.path;
    const categoryProducts = new Map<number, RawProduct>();
    let exhausted = false;

    for (let pageNumber = 1; pageNumber <= PAGE_CAP; pageNumber += 1) {
      const response = await fetchMaybeJson(
        http,
        `${base}${requestPath}/products.json?limit=${PAGE_SIZE}&page=${pageNumber}`,
      );
      pagesTraversed += 1;
      const batch = (response.json as { products?: RawProduct[] } | null)?.products;
      if (
        !response.ok ||
        !sameOfficialScope(response.url, category.path, true) ||
        !Array.isArray(batch)
      ) {
        errors.push(`SERGIO_ROSSI_PAGE_INVALID:${category.path}:${pageNumber}:${response.status}`);
        break;
      }
      if (batch.length === 0) {
        exhausted = true;
        break;
      }
      let added = 0;
      for (const raw of batch) {
        if (!Number.isSafeInteger(raw.id) || !raw.handle || !raw.title) {
          errors.push(`SERGIO_ROSSI_IDENTITY_MISSING:${category.path}`);
          continue;
        }
        if (!categoryProducts.has(raw.id)) {
          categoryProducts.set(raw.id, raw);
          added += 1;
        }
      }
      if (added === 0) {
        errors.push(`SERGIO_ROSSI_REPEATED_PAGE:${category.path}:${pageNumber}`);
        break;
      }
      if (batch.length < PAGE_SIZE) {
        exhausted = true;
        break;
      }
    }

    if (!exhausted) {
      paginationExhausted = false;
      errors.push(`SERGIO_ROSSI_PAGINATION_NOT_EXHAUSTED:${category.path}`);
    }
    if (count != null && categoryProducts.size !== count) {
      errors.push(`SERGIO_ROSSI_CATEGORY_MISMATCH:${category.path}:${categoryProducts.size}/${count}`);
    }

    for (const [id, raw] of categoryProducts) {
      rawById.set(id, raw);
      if (!membership.has(id)) membership.set(id, category);
    }
  }

  const verifiedPaths = SERGIO_ROSSI_COLLECTIONS.map((category) => category.path);
  const scopedConfig: PilotSourceConfig = {
    ...config,
    baseUrl: base,
    collectionPaths: verifiedPaths,
    verifiedFootwearPaths: verifiedPaths,
  };
  const products: CollectionAttemptResult["products"] = [];
  const now = new Date().toISOString();

  for (const [id, raw] of rawById) {
    const category = membership.get(id);
    const url = `${base}/products/${raw.handle}`;
    links.add(url);
    if (!category) {
      errors.push(`SERGIO_ROSSI_CATEGORY_MEMBERSHIP_MISSING:${raw.handle}`);
      continue;
    }
    const mapped = shopifyProductToPilot(
      raw,
      scopedConfig,
      now,
      category.path,
      category.label,
      category.category,
    );
    if (!mapped) {
      errors.push(`SERGIO_ROSSI_REJECTED_SHOE:${raw.handle}`);
    } else if (!mapped.imageUrl || !mapped.images?.length) {
      errors.push(`SERGIO_ROSSI_MISSING_GALLERY:${raw.handle}`);
    } else {
      products.push(mapped);
    }
  }

  for (const category of SERGIO_ROSSI_COLLECTIONS) {
    const finalPage = await http.fetchText(`${base}${category.path}`);
    const finalCount = finalPage.ok && sameOfficialScope(finalPage.url, category.path)
      ? parseSergioRossiStorefrontCount(finalPage.text)
      : null;
    if (finalCount == null || finalCount !== categoryStorefrontCounts[category.path]) {
      errors.push(`SERGIO_ROSSI_STOREFRONT_CHANGED_OR_UNAVAILABLE:${category.path}`);
    }
  }

  console.log("[sergio-rossi]", JSON.stringify({
    sourceTotal: rawById.size,
    accepted: products.length,
    categoryStorefrontCounts,
    pagesTraversed,
    paginationExhausted,
    errors,
  }));

  return {
    products,
    discoveredLinks: links,
    errors,
    method: "shopify",
    pagesTraversed,
    rawProductUrlsDiscovered: rawById.size,
    paginationExhausted,
    sourceReportedProductCount: rawById.size > 0 ? rawById.size : null,
    hitCollectionCrawlCap: !paginationExhausted,
    collectionsCrawled: [SERGIO_ROSSI_WOMENS_SHOES_PATH, ...verifiedPaths],
    categoryStorefrontCounts,
  };
}
