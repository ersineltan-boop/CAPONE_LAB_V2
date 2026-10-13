import { createHash } from 'node:crypto';
import type { CasadeiSearchPage } from './casadei';

export interface CasadeiPageEvidence {
  url: string;
  offset: number | null;
  total: number | null;
  rawCount: number;
  products: Array<{productId: string; productUrl: string}>;
  identitySha256: string;
}
export interface CasadeiReconciliation {
  pages: CasadeiPageEvidence[];
  replayIdentitySha256: string[];
  duplicateOccurrences: number;
  uniqueProductCount: number;
}
export function casadeiPageEvidence(url: string, page: CasadeiSearchPage): CasadeiPageEvidence {
  const products = page.hits.map(({productId, productUrl}) => ({productId, productUrl}));
  const identity = {offset: page.offset, total: page.total, rawCount: page.rawCount, products};
  return {url, ...identity, identitySha256: createHash('sha256').update(JSON.stringify(identity)).digest('hex')};
}

/** Repeated slots are accounted for only after a second identical traversal. */
export function reconciledCasadeiTotal(total: number | null, urls: readonly string[], evidence?: CasadeiReconciliation): number | null {
  if (!evidence || !Number.isInteger(total) || total! <= 0 || evidence.pages.length === 0 ||
      evidence.pages.length !== evidence.replayIdentitySha256.length) return null;
  let covered = 0;
  const ids = new Map<string, string>();
  const uniqueUrls = new Set<string>();
  for (const [index, page] of evidence.pages.entries()) {
    const expectedUrl = 'https://www.casadei.com/en-us/shoes/' + (index ? `?page=${index + 1}` : '');
    const identity = {offset: page.offset, total: page.total, rawCount: page.rawCount, products: page.products};
    const hash = createHash('sha256').update(JSON.stringify(identity)).digest('hex');
    if (page.url !== expectedUrl || page.total !== total || page.offset !== covered ||
        !Number.isInteger(page.rawCount) || page.rawCount <= 0 || page.rawCount !== page.products.length ||
        page.identitySha256 !== hash || evidence.replayIdentitySha256[index] !== hash) return null;
    covered += page.rawCount;
    if (covered > total!) return null;
    for (const product of page.products) {
      if (!product.productId || !product.productUrl || (ids.has(product.productId) && ids.get(product.productId) !== product.productUrl)) return null;
      ids.set(product.productId, product.productUrl);
      uniqueUrls.add(product.productUrl);
    }
  }
  if (covered !== total || uniqueUrls.size !== ids.size || urls.length !== uniqueUrls.size || new Set(urls).size !== urls.length ||
      urls.some(url => !uniqueUrls.has(url)) || evidence.uniqueProductCount !== ids.size ||
      evidence.duplicateOccurrences !== covered - ids.size || evidence.duplicateOccurrences <= 0) return null;
  return ids.size;
}
