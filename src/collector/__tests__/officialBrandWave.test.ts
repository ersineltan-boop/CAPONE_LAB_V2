import { describe, expect, it } from 'vitest';
import type { OnboardingHttp } from '../../onboarding/http';
import { evaluateOfficialSourceCoverage } from '../../onboarding/validate';
import { collectOfficialBrandWave, parseWaveCount, parseWaveStorefrontCards, sameOfficialWaveScope } from '../officialBrandWave';
import { evaluateFootwearProduct, evaluateStoredPilotProduct } from '../footwearGate';

const root = 'https://coperni.com/collections/all-shoes';
const config = { id: 'coperni', brand: 'COPERNI', baseUrl: 'https://coperni.com', collectionPaths: ['/collections/all-shoes'], maxProducts: 250 };
function transport(options: { count?: number; repeat?: boolean; redirect?: boolean; missingImage?: boolean; incomplete?: boolean } = {}): OnboardingHttp {
  const products = Array.from({ length: 21 }, (_, i) => ({ id: i + 1, handle: `boot-${i}`, title: `Leather Boot ${i}`, product_type: 'Boots', tags: ['NEW IN'], images: options.missingImage && i === 0 ? [] : [{ src: `https://coperni.com/boot-${i}.jpg` }], variants: [{ title: '38', sku: `BOOT-${i}-38` }] }));
  if (options.incomplete) products[0] = { ...products[0]!, title: 'Mystery Object', product_type: 'Unknown', tags: [], handle: 'mystery-object' };
  return { async fetchText(url) {
    const parsed = new URL(url);
    const text = parsed.pathname.endsWith('/products.json') ? JSON.stringify({ products: parsed.searchParams.get('page') === '1' || options.repeat ? products : [] }) : `<span id="ProductCount">${options.count ?? products.length} products</span>`;
    return { ok: true, status: 200, text, url: options.redirect ? url.replace('/collections/', '/en-us/collections/') : url };
  } };
}

describe('Pinned official-source brand wave', () => {
  it('recognizes footwear vocabulary while preserving non-footwear exclusions', () => {
    for (const title of ['Quilted Espadrilles', 'Leather Moccasins', 'Ruched Strap Maryjanes']) {
      expect(evaluateStoredPilotProduct({ productName: title, productUrl: 'https://www.pazzion.com/products/shoe', category: 'OTHER_FOOTWEAR' }).decision).toBe('ACCEPT_FOOTWEAR');
    }
    expect(evaluateFootwearProduct({ title: 'Wallet with espadrille pattern', productType: 'Wallet' }).decision).toBe('EXCLUDE_NON_FOOTWEAR');
  });
  it('keeps proven Coperni Belt shoes while excluding arbitrary belts and grip socks', () => {
    const productUrl='https://coperni.com/products/copsh74f6016-leather-black';
    expect(evaluateFootwearProduct({ title:'Belt Ballerinas',productType:'Ballerinas',officialProductUrl:productUrl }).decision).toBe('ACCEPT_FOOTWEAR');
    expect(evaluateStoredPilotProduct({productName:'Belt Ballerinas',productUrl,category:'BALLERINA'}).decision).toBe('ACCEPT_FOOTWEAR');
    for(const [url,type] of [[productUrl,'Jewelry'],['https://example.com/products/copsh74f6016-leather-black','Ballerinas']]) expect(evaluateFootwearProduct({ title:'Belt Ballerinas',productType:type,officialProductUrl:url }).decision).toBe('EXCLUDE_NON_FOOTWEAR');
    expect(evaluateFootwearProduct({title:'Barreletics x Coperni Grip Sock',productType:'SS26'}).decision).toBe('EXCLUDE_NON_FOOTWEAR');
  });
  it('uses storefront counts instead of stale collection metadata and keeps first delivery as baseline', async () => {
    const result = await collectOfficialBrandWave(config, transport());
    expect(result.errors).toEqual([]);
    expect(result.products).toHaveLength(21);
    expect(result.products.every(p => !p.hasNewBadge && !p.isNewArrivalsCollection && p.variants?.[0]?.sku)).toBe(true);
    expect(evaluateOfficialSourceCoverage({ ...result, acceptedProductCount: result.products.length }).full).toBe(true);
  });
  it('refuses mismatched totals, repeated pages, market redirects, missing galleries and uncertain merchandise', async () => {
    for (const options of [{ count: 22 }, { repeat: true }, { redirect: true }, { missingImage: true }, { incomplete: true }]) {
      const result = await collectOfficialBrandWave(config, transport(options));
      expect(evaluateOfficialSourceCoverage({ ...result, acceptedProductCount: result.products.length }).full).toBe(false);
    }
  });
  it('pins the exact market, collection, and pagination parameters', () => {
    const url = 'https://www.moonboot.com/en-eu/collections/woman-fall-winter-2026/products.json?limit=250&page=2';
    expect(sameOfficialWaveScope(url, url)).toBe(true);
    for (const changed of [url.replace('/en-eu/', '/en-us/'), url.replace('page=2', 'page=1'), url + '&filter.v.availability=1', url.replace('moonboot.com', 'example.com')]) expect(sameOfficialWaveScope(url, changed)).toBe(false);
  });
  it('reads dedicated totals despite unrelated variant filter counters, and rejects contradictory totals', () => {
    expect(parseWaveCount('<span>black (14 products)</span><span id="ProductCount">63 products </span>')).toBe(63);
    expect(parseWaveCount('<p id="ProductCountMobile">29 products</p><p id="ProductCount">30 products</p>')).toBeNull();
  });
  it('restricts customer-visible identities to actual collection cards', () => {
    const url = 'https://www.moonboot.com/en-eu/collections/woman-fall-winter-2026';
    const parsed = parseWaveStorefrontCards(`<grid-item data-url="/en-eu/products/cart-item"></grid-item><collection-component><grid-item data-url="/en-eu/products/womens-boot"></grid-item></collection-component><link rel="next" href="${url}?page=2">`, 'moon-boot', url);
    expect([...parsed.handles]).toEqual(['womens-boot']);
    expect(parsed.next).toBe(url + '?page=2');
    expect(parseWaveStorefrontCards('<main>no listing</main>', 'moon-boot', url).valid).toBe(false);
  });
  it('reconciles URL identities, not just equal card counts', async () => {
    const moon = { ...config, id: 'moon-boot', brand: 'MOON BOOT', baseUrl: 'https://www.moonboot.com' };
    const http: OnboardingHttp = { async fetchText(url) {
      const isJson = url.includes('products.json');
      const text = isJson ? JSON.stringify({ products: url.includes('page=1') ? [{ id: 1, title: 'Boot', handle: 'different-boot', product_type: 'Boots', images: [{ src: 'https://www.moonboot.com/photo.jpg' }] }] : [] }) : '<collection-component><grid-item data-url="/en-eu/products/listed-boot"></grid-item></collection-component>';
      return { ok: true, status: 200, url, text };
    } };
    const result = await collectOfficialBrandWave(moon, http);
    expect(result.errors).toContain('WAVE_STOREFRONT_URL_IDENTITY_MISMATCH');
  });
  it('keeps explicitly identified childrens footwear outside the women catalog', async () => {
    const http: OnboardingHttp = { async fetchText(url) {
      const text = url.includes('products.json') ? JSON.stringify({ products: url.includes('page=1') ? [{ id: 1, title: 'Little Ballerina', handle: 'little-ballerina', product_type: 'Kids', images: [{ src: 'https://www.pazzion.com/photo.jpg' }] }] : [] }) : '<div>1 products</div>';
      return { ok: true, status: 200, url, text };
    } };
    const result = await collectOfficialBrandWave({ ...config, id: 'pazzion', brand: 'PAZZION', baseUrl: 'https://www.pazzion.com' }, http);
    expect(result.products).toHaveLength(0);
    expect(result.sourceReportedProductCount).toBe(0);
    expect(evaluateOfficialSourceCoverage({ ...result, acceptedProductCount: 0 }).full).toBe(false);
  });
});
