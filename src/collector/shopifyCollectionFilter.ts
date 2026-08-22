import { isNewArrivalsCollectionPath } from "../newArrivals/detectNewness";
import { isFullCatalogRootPath, normalizeCollectionPath } from "./fullCoveragePaths";

const FOOTWEAR =
  /shoe|footwear|boot|sandal|pump|loafer|sneaker|heel|flat|mule|clog|espadr|oxford|derby|ballerin|slipper|slide|wedge|trainer|mary.?jane|platform|stiletto|moccasin|brogue|court|thong|flip.?flop|wellington|rain.?boot|ankle|knee.?high|over.?the.?knee|ballet|clog|sapato|sapatilha|soca|salto|rasteira|chinelo|mocassim|escarpin|chaussure|bottine|ballerine|sabot/i;

const NOT_FOOTWEAR =
  /\b(bag|handbag|dress|skirt|pant|trouser|jean|shirt|jacket|coat|fragrance|beauty|jewelry|jewellery|candle|gift.?card|ready.?to.?wear|apparel|clothing|lingerie|swim)\b/i;

const MEN = /\b(men'?s?|mens|homme)\b/i;
const WOMEN = /\b(women'?s?|womens|woman|ladies)\b/i;

const PROMO_COLLECTION =
  /sale|black[- ]?friday|under[- ]?\d|promo|flash[- ]?sale|deal of|vip\b|bf23|\d+%-off|extra-\d+|starting at|caroussel|carousel|sms\b|gift[- ]?guide|holiday-glam/i;

export interface ShopifyCollectionRef {
  handle: string;
  title: string;
  productsCount: number;
}

export function isLikelyProductNamedCollection(
  handle: string,
  title: string,
  productsCount: number,
): boolean {
  if (productsCount >= 25) return false;
  if (/^the-/.test(handle)) return true;
  if (/\bthe [a-z0-9'’-]+ (sandal|boot|flat|loafer|sneaker|clog|mule|pump|heel)\b/i.test(title)) {
    return true;
  }
  return false;
}

export function isPromoFootwearCollection(handle: string, title: string): boolean {
  return PROMO_COLLECTION.test(`${handle} ${title}`);
}

export function isStoreWideMixedCatalog(handle: string, title: string): boolean {
  const hay = `${handle} ${title}`.toLowerCase().replace(/-/g, " ");
  if (FOOTWEAR.test(hay)) return false;
  return /^(all|shop all|view all|all products|shop|frontpage)$/.test(hay.trim());
}

export function isMixedCatalogPath(path: string): boolean {
  return /\/collections\/(all|shop-all|all-products|view-all|frontpage)\/?$/i.test(path);
}

export function isWomensFootwearCollection(handle: string, title: string): boolean {
  const hay = `${handle} ${title}`.toLowerCase().replace(/-/g, " ");
  if (/^color-/.test(handle)) return false;
  if (handle === "default-category") return false;
  if (MEN.test(hay) && !WOMEN.test(hay)) return false;
  if (NOT_FOOTWEAR.test(hay) && !FOOTWEAR.test(hay)) return false;
  if (FOOTWEAR.test(hay)) return true;
  if (
    (isNewArrivalsCollectionPath(handle) || /new arrival|new in|just landed/.test(hay)) &&
    FOOTWEAR.test(hay)
  ) {
    return true;
  }
  if (isStoreWideMixedCatalog(handle, title)) return true;
  if (/shop all shoes|all shoes|womens shoes|women shoes|women s shoes|all footwear/.test(hay)) {
    return true;
  }
  return false;
}

export function collectionCrawlRank(collection: ShopifyCollectionRef): number {
  const handle = collection.handle.toLowerCase();
  if (
    /^(pumps?|boots?|sandals?|flats?|loafers?|sneakers?|mules?|booties?|heels?|ballet-flats?|ballerinas?|mary-janes?|platforms?|slides?|espadrilles?|oxfords?|clogs?|wedges?)$/.test(
      handle,
    )
  ) {
    return 0;
  }
  if (isFullCatalogRootPath(`/collections/${handle}`)) return 0;
  if (isPromoFootwearCollection(collection.handle, collection.title)) return 2;
  return 1;
}

export function collectionPathFromHandle(handle: string): string {
  return handle.startsWith("/") ? normalizeCollectionPath(handle) : `/collections/${handle}`;
}

/**
 * Safety ceiling only — not a sampling cap. Daily jobs should crawl every
 * women's footwear collection up to this guardrail.
 */
export function selectShopifyFootwearCollectionsToCrawl(
  collections: readonly ShopifyCollectionRef[],
  preferredPaths: readonly string[] = [],
  cap: number,
): {
  paths: string[];
  selected: ShopifyCollectionRef[];
  footwearCollectionCount: number;
  hitCollectionCrawlCap: boolean;
} {
  const preferred = new Set(
    preferredPaths.map((path) => normalizeCollectionPath(path).toLowerCase()),
  );
  const footwear = collections.filter(
    (collection) =>
      collection.productsCount > 0 &&
      !isLikelyProductNamedCollection(
        collection.handle,
        collection.title,
        collection.productsCount,
      ) &&
      (isWomensFootwearCollection(collection.handle, collection.title) ||
        preferred.has(collectionPathFromHandle(collection.handle).toLowerCase())),
  );

  const specific = footwear.filter(
    (collection) => !isStoreWideMixedCatalog(collection.handle, collection.title),
  );
  const pool = specific.length > 0 ? specific : footwear;

  pool.sort(
    (a, b) =>
      collectionCrawlRank(a) - collectionCrawlRank(b) || b.productsCount - a.productsCount,
  );

  const selected = pool.slice(0, Math.max(1, cap));
  const paths: string[] = [];
  const seen = new Set<string>();
  const push = (path: string) => {
    const normalized = normalizeCollectionPath(path);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) return;
    seen.add(key);
    paths.push(normalized);
  };

  for (const path of preferredPaths) push(path);
  for (const collection of selected) push(collectionPathFromHandle(collection.handle));

  return {
    paths,
    selected,
    footwearCollectionCount: pool.length,
    hitCollectionCrawlCap: pool.length > cap,
  };
}

export function authoritativeFootwearReportedCount(
  counts: Map<string, number>,
  collectionPaths: readonly string[],
): number | null {
  const specificRoots = collectionPaths.filter(
    (path) => isFullCatalogRootPath(path) && !isMixedCatalogPath(path),
  );
  const otherSpecific = collectionPaths.filter((path) => !isMixedCatalogPath(path));
  const pool =
    specificRoots.length > 0
      ? specificRoots
      : otherSpecific.length > 0
        ? otherSpecific
        : [...collectionPaths];
  let max = 0;
  for (const path of pool) {
    const count = counts.get(path.toLowerCase()) ?? counts.get(normalizeCollectionPath(path).toLowerCase()) ?? 0;
    if (count > max) max = count;
  }
  return max > 0 ? max : null;
}
