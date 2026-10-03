import { describe, expect, it } from 'vitest';
import type { OnboardingHttp } from '../../onboarding/http';
import { evaluateOfficialSourceCoverage } from '../../onboarding/validate';
import { collectOfficialBrandWave, officialWaveUrl, parseOfficialProductGallery, parseWaveCount, parseWaveStorefrontCards, sameOfficialWaveScope } from '../officialBrandWave';
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
  it('selects one country on both the storefront and every JSON page without accepting market changes', async () => {
    const requested: string[] = [];
    const mock = transport();
    const result = await collectOfficialBrandWave(config, { async fetchText(url, options) {
      requested.push(url);
      return mock.fetchText(url, options);
    } });
    expect(result.errors).toEqual([]);
    expect(requested.length).toBeGreaterThan(3);
    expect(requested.every(url => new URL(url).searchParams.get('country') === 'FR')).toBe(true);
    const url = officialWaveUrl('moon-boot', '/en-eu/collections/woman-fall-winter-2026', { page: '2' });
    expect(sameOfficialWaveScope(url, url.replace('country=DE', 'country=GB'))).toBe(false);
    expect(sameOfficialWaveScope(url, url.replace('/en-eu/', '/en-gb/'))).toBe(false);
  });
  it('uses official descriptions to classify opaque Paloma titles and retains original product types', async () => {
    const products = [
      { id: 1, handle: '007km', title: 'no 2654 / 007KM', product_type: 'Shoes', body_html: '<p>Leather ankle boots with inner side zipper.</p>' },
      { id: 2, handle: 'judo', title: 'no 1365 / Judo', product_type: 'Leather boots', body_html: '<p>Tall leather boot with a cone heel.</p>' },
      { id: 3, handle: 'micaela', title: 'no 2579 / Micaela', product_type: 'Shoes', body_html: '<p>Lined leather loafer with a pocket detail.</p>' },
      { id: 4, handle: 'anastasia', title: 'no 3068 / Anastasia', product_type: 'Shoes', body_html: '<p>Slide sandal with a fur footbed.</p>' },
      { id: 5, handle: 'wallet', title: 'Wallet', product_type: 'Wallet', body_html: '<p>Wallet inspired by leather boots.</p>' },
    ].map(product => ({ ...product, images: [{ src: 'https://palomawool.com/photo.jpg' }], variants: [{ title: '38', sku: `REAL-${product.id}` }] }));
    const http: OnboardingHttp = { async fetchText(url) {
      return { ok: true, status: 200, url, text: url.includes('products.json') ? JSON.stringify({ products: url.includes('page=1') ? products : [] }) : '<span id="ProductCount">5 products</span>' };
    } };
    const result = await collectOfficialBrandWave({ ...config, id: 'paloma-wool', brand: 'PALOMA WOOL', baseUrl: 'https://palomawool.com' }, http);
    expect(result.errors).toEqual([]);
    expect(result.products.map(product => product.category)).toEqual(['ANKLE_BOOT', 'BOOT', 'LOAFER', 'SANDAL']);
    expect(result.products[0]?.sourceProductType).toBe('Shoes');
    expect(result.products[0]?.productName).toBe('no 2654 / 007KM');
    expect(result.products[0]?.variants[0]?.sku).toBe('REAL-1');
  });
  it('reads dedicated totals despite unrelated variant filter counters, and rejects contradictory totals', () => {
    expect(parseWaveCount('<span>black (14 products)</span><span id="ProductCount">63 products </span>')).toBe(63);
    expect(parseWaveCount('<p id="ProductCountMobile">29 products</p><p id="ProductCount">30 products</p>')).toBeNull();
  });
  it('recovers video preview galleries only from the exact product schema, ignoring recommendation images', () => {
    const url = 'https://pedromiralles.com/products/29710-03-almada';
    const script = (id: string, image: string) => `<script type="application/ld+json">${JSON.stringify({ '@type': 'ProductGroup', '@id': id, hasVariant: [{ image }] })}</script>`;
    const html = script('/products/other#product', 'https://pedromiralles.com/other.jpg') + script('/products/29710-03-almada#product', 'https://pedromiralles.com/real-preview.jpg');
    expect(parseOfficialProductGallery(html, url)).toEqual(['https://pedromiralles.com/real-preview.jpg']);
    expect(parseOfficialProductGallery('<img src="https://pedromiralles.com/recommendation.jpg">', url)).toEqual([]);
  });
  it('keeps Pedro partial when an official product has no proven gallery', async () => {
    const products = [
      { id: 1, handle: 'ingels', title: 'INGELS', product_type: 'BOTAS', tags: ['TOP VENTAS'], images: [{ src: 'https://pedromiralles.com/ingels.jpg' }] },
      { id: 2, handle: 'audes', title: 'AUDES', product_type: 'SANDALIAS DE TACÓN', tags: [], images: [] },
    ];
    const http: OnboardingHttp = { async fetchText(url) {
      const text = url.includes('products.json') ? JSON.stringify({ products: url.includes('page=1') ? products : [] }) : url.includes('/collections/') ? '<div class="collection-listing"><product-block><a href="/products/ingels"></a></product-block><product-block><a href="/products/audes"></a></product-block></div>' : '<img src="https://pedromiralles.com/unrelated.jpg">';
      return { ok: true, status: 200, url, text };
    } };
    const result = await collectOfficialBrandWave({ ...config, id: 'pedro-miralles', brand: 'PEDRO MIRALLES', baseUrl: 'https://pedromiralles.com' }, http);
    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.sourceProductTags).toContain('TOP VENTAS');
    expect(result.errors).toContain('WAVE_INCOMPLETE_FOOTWEAR:audes');
    expect(evaluateOfficialSourceCoverage({ ...result, acceptedProductCount: result.products.length }).full).toBe(false);
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
