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
    const state = {products: [product(api ? 2 : 1)], pagination: {page: api && fixture.mode !== 'repeated' ? 1 : 0,size: 1,totalCount: 2}};
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
  it.each(['blocked','repeated'])('fails closed on %s later pages', async mode => {
    fixture.mode = mode;
    const result = await collectLevelShoes();
    expect(result.coverageStatus).toBe('PARTIAL');
    expect(result.paginationExhausted).toBe(false);
    expect(result.errors[0]).toContain(mode === 'blocked' ? 'HTTP 403' : 'wrong page');
  });
});
