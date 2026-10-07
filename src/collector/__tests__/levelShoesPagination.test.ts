import {describe, expect, it, vi} from 'vitest';
import {collectLevelShoes, LEVEL_SHOES_FOOTWEAR_ROOT} from '../levelShoes';
const fixture = vi.hoisted(() => ({mode: 'complete'}));
const product = (id: number) => ({name: 'Leather mule', brandName: 'Aeyde',
  action: {url: `https://www.levelshoes.com/aeyde-leather-mule-women-mules-${id}.html`},
  analytics: {category1: 'Shoes', category3: 'Mules'}, imagePreviewGallery: [{url: 'https://assets.levelshoes.com/shoe.jpg'}]});
vi.mock('../http', () => ({sleep: async () => {}, fetchJsonPost: async () => ({ok: false}),
  fetchText: async (url: string) => {
    const api = url.startsWith('https://api.levelshoes.com/');
    if (api && fixture.mode === 'blocked') return {ok: false,status: 403,text: 'Access denied',url};
    const long = fixture.mode === 'long';
    const page = api ? Number(new URL(url).searchParams.get('page')) : 0;
    const item = product(long ? page + 1 : api ? 2 : 1);
    if (fixture.mode === 'unisex') {
      item.action.url = item.action.url.replace('-women', '');
      (item.analytics as Record<string, string>).gender = 'Unisex';
    }
    const state = {products: [item], pagination: {page: long ? page : api && fixture.mode !== 'repeated' ? 1 : 0,size: 1,totalCount: long ? 81 : 2}};
    return {ok: true,status: 200,url,text: api ? JSON.stringify(state) : `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({props:{pageProps:{__APOLLO_STATE__:{ROOT_QUERY:{'_productList:{}':state}}}}})}</script>`};
  }}));
describe('current Level Shoes storefront pagination', () => {
  it('uses the source total and the actual later-page transport, with source taxonomy', async () => {
    fixture.mode = 'complete';
    const result = await collectLevelShoes();
    expect(result.coverageStatus).toBe('FULL');
    expect(result.sourceReportedProductCount).toBe(2);
    expect(result.products.map(p => p.category)).toEqual(['MULE','MULE']);
    expect(result.categoriesDiscovered[0].url).toBe(LEVEL_SHOES_FOOTWEAR_ROOT);
  });
  it('finishes a catalog beyond the old 80-page cap', async () => {
    fixture.mode = 'long';
    const result = await collectLevelShoes();
    expect(result.coverageStatus).toBe('FULL');
    expect(result.products).toHaveLength(81);
    const capped = await collectLevelShoes({maxPagesPerListing: 80});
    expect(capped.coverageStatus).toBe('PARTIAL');
    expect(capped.paginationExhausted).toBe(false);
  });
  it('includes source-confirmed unisex shoes without a women slug', async () => {
    fixture.mode = 'unisex';
    const result = await collectLevelShoes();
    expect(result.coverageStatus).toBe('FULL');
    expect(result.products).toHaveLength(2);
  });
  it('stops at its time budget without publishing an incomplete catalog', async () => {
    fixture.mode = 'complete';
    const result = await collectLevelShoes({maxDurationMs: 0});
    expect(result.coverageStatus).toBe('FAILED');
    expect(result.errors).toContain('Level Shoes collection time budget exhausted');
  });
  it.each(['blocked','repeated'])('fails closed on %s later pages', async mode => {
    fixture.mode = mode;
    const result = await collectLevelShoes();
    expect(result.coverageStatus).toBe('PARTIAL');
    expect(result.paginationExhausted).toBe(false);
    expect(result.errors[0]).toContain(mode === 'blocked' ? 'HTTP 403' : 'wrong page');
  });
});
