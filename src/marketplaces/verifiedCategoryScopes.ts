import {farfetchCategoryKey} from '../collector/farfetch';
import {normalizeProductUrl} from '../collector/mergeProducts';
import type {PilotProduct} from '../collector/types';

export interface VerifiedCategoryScope {
  url: string;
  sourceTotal: number;
  rawCollected: number;
  productUrls: string[];
  checkedAt: string;
  coverageStatus: 'FULL';
  paginationExhausted: true;
}

/** Only independently complete official categories may be appended to an archive. */
export function validateVerifiedCategoryScopes(input: {
  sourceId: string; products: readonly PilotProduct[]; scopes: readonly VerifiedCategoryScope[];
  preserveMissing: boolean; rawCollected: number; now?: number;
}): string[] {
  const errors: string[] = [], union = new Set<string>(), categories = new Set<string>();
  if (input.sourceId !== 'farfetch') errors.push('verified category publication is only enabled for Farfetch');
  if (!input.preserveMissing) errors.push('verified categories require archive-preserving publication');
  if (!input.scopes.length) errors.push('verified category evidence is missing');
  const products = new Map(input.products.map(product => [normalizeProductUrl(product.productUrl), product]));
  const now = input.now ?? Date.now();
  for (const scope of input.scopes) {
    const key = farfetchCategoryKey(scope.url);
    if (!key || key === 'shoes' || categories.has(scope.url)) errors.push('invalid or duplicate verified category');
    categories.add(scope.url);
    const age = now - Date.parse(scope.checkedAt);
    if (!Number.isFinite(age) || age < 0 || age > 60 * 60_000) errors.push('verified category evidence is stale');
    const urls = scope.productUrls.map(normalizeProductUrl);
    if (scope.coverageStatus !== 'FULL' || scope.paginationExhausted !== true ||
        !Number.isInteger(scope.sourceTotal) || scope.sourceTotal < 1 || scope.rawCollected !== scope.sourceTotal ||
        urls.length !== scope.sourceTotal || new Set(urls).size !== urls.length) errors.push('verified category does not reconcile');
    for (const url of urls) {
      union.add(url);
      const product = products.get(url);
      if (!url.startsWith('https://www.farfetch.com/uk/shopping/women/') || !product ||
          !(product.sourceCategoryUrl === scope.url || product.sourceCategories?.some(ref => ref.categoryUrl === scope.url))) {
        errors.push('product has no matching verified category evidence');
      }
    }
  }
  if (union.size !== input.rawCollected || union.size !== input.products.length ||
      [...products.keys()].some(url => !union.has(url))) errors.push('verified category union does not match the candidate');
  return [...new Set(errors)];
}
