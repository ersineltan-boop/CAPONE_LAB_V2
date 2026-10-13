import {join} from 'node:path';
import {fetchText} from './http';
import {collectFarfetchProgress} from './farfetchProgress';
import {discoverFarfetchFootwearListings, FARFETCH_SHOES_URL, farfetchCategoryKey, parseFarfetchCatalogPagination, parseFarfetchItemList} from './farfetch';
import {mergeProductCatalog} from './mergeProducts';
import type {PilotProduct} from './types';
import type {VerifiedCategoryScope} from '../marketplaces/verifiedCategoryScopes';

const rootIdentity = (html: string) => JSON.stringify(parseFarfetchItemList(html).map(item => item.offers?.url));

/** Independent category checkpoints do not certify whole-marketplace coverage. */
export async function collectFarfetchCategories(options: {
  directory: string; budgetMs?: number; maxPages?: number;
  listingUrls?: string[];
  http?: typeof fetchText; now?: () => number;
}) {
  const http = options.http ?? fetchText, now = options.now ?? Date.now;
  const started = now(), budget = Math.min(options.budgetMs ?? 20 * 60_000, 20 * 60_000);
  if (!Number.isFinite(budget) || budget <= 0) throw new Error('Invalid Farfetch category budget');
  const deadline = started + budget;
  const maxPages = Math.min(options.maxPages ?? 800, 800);
  if (!Number.isInteger(maxPages) || maxPages < 1) throw new Error('Invalid Farfetch category page limit');
  const errors: string[] = [], observed: PilotProduct[] = [];
  const categories: Array<{url: string; status: string; raw: number; progress: unknown; errors: string[]}> = [];
  const verifiedScopes: VerifiedCategoryScope[] = [];
  let pagesTraversed = 0, blocked = false, rawSourceProducts = 0;
  let total: number | null = null;
  const result = (full = false) => ({
    products: blocked ? [] : mergeProductCatalog([], observed), verifiedScopes,
    coverageStatus: full ? 'FULL' as const : total === null ? 'FAILED' as const : 'PARTIAL' as const,
    errors, blocked, paginationExhausted: full, pagesTraversed,
    sourceReportedProductCount: total, rawSourceProducts,
    progress: {strategy: 'categories', startedAt: new Date(started).toISOString(), categories},
  });
  const home = await http(FARFETCH_SHOES_URL, {delayMs:500}); pagesTraversed++;
  if (!home.ok) {blocked = [403,429].includes(home.status); errors.push(`Farfetch root HTTP ${home.status}: ${home.error ?? 'unavailable'}`); return result();}
  const initial = parseFarfetchCatalogPagination(home.text);
  if (!initial || initial.page !== 1 || !parseFarfetchItemList(home.text).length) {
    errors.push('Farfetch authoritative root metadata missing'); return result();
  }
  total = initial.total;
  // Use only category links advertised by the official source. Smaller groups
  // normally occur last in the menu, so reverse it to retain useful work first.
  const advertised = discoverFarfetchFootwearListings(home.text, FARFETCH_SHOES_URL)
    .filter(url => url !== FARFETCH_SHOES_URL && farfetchCategoryKey(url)).reverse();
  if (options.listingUrls && (!options.listingUrls.length || new Set(options.listingUrls).size !== options.listingUrls.length || options.listingUrls.some(url => !advertised.includes(url)))) {
    throw new Error('Requested Farfetch category is not advertised by the official source');
  }
  const listings = options.listingUrls ?? advertised;
  if (!listings.length) {errors.push('Farfetch official category links missing'); return result();}
  for (const listing of listings) {
    if (now() + 32_000 >= deadline || pagesTraversed >= maxPages) {
      errors.push('FARFETCH_CATEGORY_BUDGET_REACHED_PROGRESS_SAVED'); break;
    }
    const key = farfetchCategoryKey(listing)!;
    const collection = await collectFarfetchProgress({
      directory:join(options.directory, key), listingUrl:listing,
      reconcileCountChanges:true,
      budgetMs:deadline - now() - 16_000, maxPages:maxPages - pagesTraversed, http, now,
    });
    pagesTraversed += collection.pagesTraversed;
    categories.push({url:listing, status:collection.coverageStatus, raw:collection.rawSourceProducts,
      progress:collection.progress, errors:collection.errors});
    errors.push(...collection.errors.map(error => `${key}: ${error}`));
    if (collection.blocked) {blocked = true; break;}
    if (collection.coverageStatus === 'FULL') {
      observed.push(...collection.products);
      verifiedScopes.push({url:listing, sourceTotal:collection.sourceReportedProductCount!, rawCollected:collection.rawSourceProducts,
        productUrls:collection.products.map(product => product.productUrl), checkedAt:collection.progress.checkedAt,
        coverageStatus:'FULL', paginationExhausted:true});
    }
  }
  const unique = mergeProductCatalog([], observed);
  rawSourceProducts = unique.length;
  if (categories.length !== advertised.length || categories.some(category => category.status !== 'FULL') || errors.length) return result();
  // Menu categories may overlap or omit products. Exact URL union and final
  // root validation are mandatory before any publication can be accepted.
  if (unique.length !== total) {
    errors.push(`Farfetch category union does not reconcile: ${unique.length}/${total}`); return result();
  }
  if (now() + 16_000 > deadline) {errors.push('FARFETCH_CATEGORY_FINAL_CHECK_PENDING'); return result();}
  const final = await http(FARFETCH_SHOES_URL, {delayMs:500}); pagesTraversed++;
  const meta = final.ok ? parseFarfetchCatalogPagination(final.text) : null;
  if (!meta || meta.page !== 1 || meta.total !== total || meta.size !== initial.size || rootIdentity(final.text) !== rootIdentity(home.text)) {
    blocked = [403,429].includes(final.status);
    errors.push(`Farfetch category final root check failed (HTTP ${final.status})`); return result();
  }
  return result(true);
}
