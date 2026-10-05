import { fetchText } from './http';
import { evaluateFootwearProduct } from './footwearGate';
import type { PilotProduct } from './types';
import {withExplicitMarketplaceTaxonomy} from './marketplaceTaxonomy';

const SOURCE = 'https://www.24s.com/en-us/women/shoes';
interface Hit {
  objectID: string; title: string; brand: string; productSlug: string;
  color?: string; images: Record<string, string>;
}
export function parse24SPage(html: string, discoveredAt = new Date().toISOString()) {
  const match = html.match(/<script\b[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('24S storefront state missing');
  const plp = JSON.parse(match[1]).props?.pageProps?.initialState?.plp;
  if (plp?.universe !== 'women' || plp?.idCategory !== 'women_shoes' || !Array.isArray(plp.hits)) {
    throw new Error('24S response is not the women shoes catalog');
  }
  if (!Number.isInteger(plp.page) || !Number.isInteger(plp.nbPages) || plp.nbPages < 1 || !Number.isInteger(plp.nbHits)) {
    throw new Error('24S pagination metadata missing');
  }
  // Keep only actual signed image URLs present in the source HTML.
  const imageUrls = [...html.matchAll(/https:\/\/www\.24s\.com\/static\/images\/[^"\s<>]+/g)]
    .map(m => m[0].replaceAll('&amp;', '&'));
  const products: PilotProduct[] = [];
  const rejected: string[] = [];
  const excluded: string[] = [];
  for (const hit of plp.hits as Hit[]) {
    if (!hit.objectID || !hit.brand || !hit.title || !hit.productSlug) throw new Error('24S malformed product');
    const gate = evaluateFootwearProduct({title: hit.title, productType: '', handle: hit.productSlug,
      collectionPath: '/women/shoes', fromVerifiedFootwearCollection: true});
    if (gate.decision === 'EXCLUDE_NON_FOOTWEAR') { excluded.push(hit.objectID); continue; }
    const images = Object.values(hit.images ?? {}).flatMap(hash => {
      const url = imageUrls.find(url => url.includes('/' + hash));
      return url ? [url] : [];
    });
    if (gate.decision !== 'ACCEPT_FOOTWEAR' || !gate.category || images.length === 0) {
      rejected.push(hit.objectID); continue;
    }
    products.push(withExplicitMarketplaceTaxonomy({source: '24s', brand: hit.brand, productName: hit.title,
      productUrl: `https://www.24s.com/en-us/${hit.productSlug}_${hit.objectID}`,
      imageUrl: images[0], images, category: gate.category, color: hit.color ?? null,
      material: null, toeShape: null, heelType: null, heelHeight: null, details: null,
      discoveredAt, collectionPath: '/women/shoes', collectionLabel: 'Shoes',
      sourceCategoryId: 'women_shoes', sourceCategoryName: 'Shoes',
      sourceCategoryPath: '/women/shoes', sourceCategoryUrl: SOURCE,
      isNewArrivalsCollection: false, hasNewBadge: false,
      variants: [{title: hit.title, color: hit.color ?? null, sku: hit.objectID, images}],
    }));
  }
  return {page: plp.page as number, pages: plp.nbPages as number, total: plp.nbHits as number,
    products, rejected, excluded, rawIds: (plp.hits as Hit[]).map(hit => hit.objectID)};
}

export async function collect24S(http = fetchText, maxPages = 100) {
  const products = new Map<string, PilotProduct>();
  const ids = new Set<string>();
  const errors: string[] = [];
  const rejected: string[] = [];
  const excluded = new Set<string>();
  let total = 0, pages = 1, traversed = 0;
  for (let page = 0; page < pages && page < maxPages; page++) {
    const response = await http(page === 0 ? SOURCE : `${SOURCE}?page=${page + 1}`);
    if (!response.ok) { errors.push(`page ${page + 1}: HTTP ${response.status}`); break; }
    try {
      const parsed = parse24SPage(response.text);
      if (parsed.page !== page) throw new Error('pagination returned the wrong page');
      if (page > 0 && (parsed.total !== total || parsed.pages !== pages)) throw new Error('catalog changed during pagination');
      total = parsed.total; pages = parsed.pages; traversed++;
      const fresh = parsed.rawIds.filter(id => !ids.has(id));
      if (!fresh.length) throw new Error('empty or repeated page');
      parsed.rawIds.forEach(id => ids.add(id));
      rejected.push(...parsed.rejected);
      parsed.excluded.forEach(id => excluded.add(id));
      parsed.products.forEach(product => products.set(product.productUrl, product));
    } catch (error) { errors.push(String(error)); break; }
  }
  const full = errors.length === 0 && rejected.length === 0 && traversed === pages && ids.size === total && products.size + excluded.size === total;
  return {products: [...products.values()], coverage: {source: '24s', status: full ? 'FULL' : products.size ? 'PARTIAL' : 'FAILED',
    sourceReportedProductCount: total, pagesTraversed: traversed, expectedPages: pages,
    rawProductCount: ids.size, acceptedProductCount: products.size, excluded: [...excluded], rejected, errors}};
}
