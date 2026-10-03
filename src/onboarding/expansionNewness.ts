import { mergeProductCatalog, normalizeProductUrl } from '../collector/mergeProducts';
import type { PilotProduct } from '../collector/types';
import { isNewArrivalsCollectionPath } from '../newArrivals/detectNewness';
import { isWomensNewArrivalsCollection } from '../brands/wave50/collections';

type JsonHttp = (url: string) => Promise<{ok: boolean; status: number; data: any}>;
type Membership = Map<string, {path: string; title: string}>;

/** Read only source-discovered New In collections; never guess collection handles. */
export async function collectExpansionNewMembership(baseUrl: string, http: JsonHttp) {
  const root = baseUrl.replace(/\/$/, '');
  const collections = new Map<string, string>();
  const memberships: Membership = new Map();
  const errors: string[] = [];
  for (let page = 1; page <= 20; page++) {
    const response = await http(`${root}/collections.json?limit=250&page=${page}`);
    const batch = response.data?.collections;
    if (!response.ok || !Array.isArray(batch)) { errors.push(`New In collection discovery HTTP/schema ${response.status}`); break; }
    let added = 0;
    for (const row of batch) {
      if (typeof row.handle !== 'string' || !/^[a-z\d][a-z\d_-]*$/i.test(row.handle)) continue;
      if (isWomensNewArrivalsCollection(row.handle, row.title ?? row.handle) && !collections.has(row.handle)) {
        collections.set(row.handle, row.title ?? row.handle); added++;
      }
    }
    if (batch.length < 250) break;
    if (page === 20) errors.push('New In collection discovery page cap');
    // Repeated large payloads cannot prove discovery exhausted.
    if (page > 1 && added === 0 && batch.every((row: any) => collections.has(row.handle))) {
      errors.push('New In collection discovery repeated'); break;
    }
  }
  if (collections.size > 8) errors.push('New In collection count exceeds safety cap');
  if (errors.length) return {memberships, errors};
  for (const [handle, title] of collections) {
    const path = `/collections/${handle}`;
    const seen = new Set<string>();
    for (let page = 1; page <= 20; page++) {
      const response = await http(`${root}${path}/products.json?limit=250&page=${page}`);
      const rows = response.data?.products;
      if (!response.ok || !Array.isArray(rows)) { errors.push(`New In ${handle} HTTP/schema ${response.status}`); break; }
      if (!rows.length) break;
      let added = 0;
      for (const row of rows) {
        if (typeof row.handle !== 'string' || !/^[a-z\d][a-z\d_-]*$/i.test(row.handle)) continue;
        if (!seen.has(row.handle)) added++;
        seen.add(row.handle);
        memberships.set(normalizeProductUrl(`${root}/products/${row.handle}`), {path, title});
      }
      if (!added) { errors.push(`New In ${handle} pagination repeated`); break; }
      if (page === 20) errors.push(`New In ${handle} page cap`);
    }
  }
  return {memberships, errors};
}

/** Archive rows/galleries survive; this successful source observation owns NEW. */
export function mergeExpansionRefreshProducts(previous: PilotProduct[], incoming: PilotProduct[], memberships: Membership): PilotProduct[] {
  const fresh = new Map(incoming.map(product => [normalizeProductUrl(product.productUrl), product]));
  return mergeProductCatalog(previous, incoming).map(product => {
    const current = fresh.get(normalizeProductUrl(product.productUrl));
    const membership = current && memberships.get(normalizeProductUrl(product.productUrl));
    const clean = {...product, isNewArrivalsCollection: Boolean(membership), hasNewBadge: Boolean(current?.hasNewBadge),
      sourceCategories: (product.sourceCategories ?? []).filter(category => !isNewArrivalsCollectionPath(category.categoryPath) && !isNewArrivalsCollectionPath(category.categoryUrl))};
    for (const field of ['collectionPath', 'sourceCategoryPath', 'sourceCategoryUrl'] as const) {
      if (isNewArrivalsCollectionPath(clean[field])) clean[field] = null;
    }
    if (membership) {
      clean.collectionPath = membership.path;
      clean.collectionLabel = membership.title;
      clean.sourceCategories.push({categoryId: membership.path.split('/').at(-1)!, categoryName: membership.title,
        categoryPath: membership.path, categoryUrl: new URL(membership.path, product.productUrl).href});
    }
    return clean;
  });
}
