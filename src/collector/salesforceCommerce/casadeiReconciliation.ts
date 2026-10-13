import type { CasadeiSearchPage } from './casadei';
import type { CasadeiPageEvidence, CasadeiReconciliation } from './types';
export function casadeiPageEvidence(url: string, page: CasadeiSearchPage): CasadeiPageEvidence {
  const products = page.hits.map(({productId, productUrl}) => ({productId, productUrl}));
  const identity = {offset: page.offset, total: page.total, rawCount: page.rawCount, products};
  return {url, ...identity};
}
export function casadeiPageIdentity(page: CasadeiPageEvidence): string {
  return JSON.stringify({url:page.url,offset:page.offset,total:page.total,rawCount:page.rawCount,
    products:page.products.map(({productId,productUrl})=>({productId,productUrl}))});
}

/** Repeated slots are accounted for only after a second identical traversal. */
export function reconciledCasadeiTotal(total: number | null, urls: readonly string[], evidence?: CasadeiReconciliation): number | null {
  if (!evidence || !Number.isInteger(total) || total! <= 0 || evidence.pages.length === 0 ||
      evidence.pages.length !== evidence.replayPages.length) return null;
  let covered = 0;
  const ids = new Map<string, string>();
  const uniqueUrls = new Set<string>();
  for (const [index, page] of evidence.pages.entries()) {
    const expectedUrl = 'https://www.casadei.com/en-us/shoes/' + (index ? `?page=${index + 1}` : '');
    if (page.url !== expectedUrl || page.total !== total || page.offset !== covered ||
        !Number.isInteger(page.rawCount) || page.rawCount <= 0 || page.rawCount !== page.products.length ||
        casadeiPageIdentity(page) !== casadeiPageIdentity(evidence.replayPages[index]!)) return null;
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
