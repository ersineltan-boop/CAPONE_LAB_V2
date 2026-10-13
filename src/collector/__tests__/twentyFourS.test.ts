import {describe, it, expect} from 'vitest';
import {collect24S, parse24SPage, parse24SProductCategory} from '../twentyFourS';
function page(index: number, id: string) {
 const state = {props:{pageProps:{initialState:{plp:{universe:'women', idCategory:'women_shoes',page:index,nbPages:2,nbHits:2,hits:[{objectID:id,brand:'ISABEL MARANT',title:'Fersi loafers',productSlug:'fersi-loafers',images:{1:'imagehash'}}]}}}}};
 return `<img src="https://www.24s.com/static/images/signature/fit-in/500x0/imagehash"><script id="__NEXT_DATA__">${JSON.stringify(state)}</script>`;
}
describe('24S collection',()=>{
 it('uses only an exact product breadcrumb as source category evidence',()=>{
  const html='<nav><a href="/en-us/women/shoes/sneakers">Sneakers</a></nav><div class="breadcrumb"><a href="https://www.24s.com/en-us/">Home</a><a href="https://www.24s.com/en-us/women/shoes">Shoes</a><a href="https://www.24s.com/en-us/women/shoes/oxfords-derbies">Oxfords &amp; Derbies</a></div>';
  expect(parse24SProductCategory(html)).toMatchObject({categoryId:'oxfords-derbies',categoryName:'Oxfords & Derbies'});
  expect(parse24SProductCategory('<nav><a href="/en-us/women/shoes/sneakers">Sneakers</a></nav>')).toBeNull();
 });
 it('recovers an ambiguous listing only from its own product breadcrumb',async()=>{
  const listing=page(0,'ABC').replace('"nbPages":2','"nbPages":1').replace('"nbHits":2','"nbHits":1')
    .replace('Fersi loafers','Jazz shoe in leather').replace('fersi-loafers','jazz-shoe');
  const detail='<div class="breadcrumb"><a href="https://www.24s.com/en-us/">Home</a><a href="https://www.24s.com/en-us/women/shoes">Shoes</a><a href="https://www.24s.com/en-us/women/shoes/sneakers">Sneakers</a></div>';
  const result=await collect24S(async url=>({ok:true,status:200,text:url.includes('jazz-shoe')?detail:listing,url}));
  expect(result.coverage.status).toBe('FULL');expect(result.products[0]).toMatchObject({category:'SNEAKER',sourceCategoryId:'sneakers'});
 });
 it('stops unresolved detail enrichment on an access block',async()=>{
  const listing=page(0,'ABC').replace('"nbPages":2','"nbPages":1').replace('"nbHits":2','"nbHits":1')
    .replace('Fersi loafers','Awar lace up').replace('fersi-loafers','awar-lace-up');
  const result=await collect24S(async url=>url.includes('awar-lace-up')
    ? {ok:false,status:403,text:'Forbidden',url}:{ok:true,status:200,text:listing,url});
  expect(result.coverage.status).toBe('PARTIAL');expect(result.coverage.errors[0]).toContain('no retry/bypass');
 });
 it('requires the women footwear source and preserves real image URLs',()=>{
  const p=parse24SPage(page(0,'ABC'));expect(p.products[0].brand).toBe('ISABEL MARANT');
  expect(p.products[0].images).toEqual(['https://www.24s.com/static/images/signature/fit-in/500x0/imagehash']);
  expect(()=>parse24SPage(page(0,'ABC').replace('women_shoes','women_bags'))).toThrow();
 });
 it('recovers explicit bootie wording but keeps unsupported and opaque silhouettes unresolved',()=>{
  expect(parse24SPage(page(0,'ABC').replace('Fersi loafers','Leather booties')).products[0].category).toBe('BOOT');
  expect(parse24SPage(page(0,'ABC').replace('Fersi loafers','Soft leather Derby')).products[0].category).toBe('OTHER_FOOTWEAR');
  expect(parse24SPage(page(0,'ABC').replace('Fersi loafers','Leather lace-up shoes')).products[0].category).toBe('OTHER_FOOTWEAR');
 });
 it('marks repeated pages partial rather than replacing last-good',async()=>{
  const result=await collect24S(async(url)=>({ok:true,status:200,text:page(0,'ABC'),url}));
  expect(result.coverage.status).toBe('PARTIAL');expect(result.coverage.errors.length).toBe(1);
 });
 it('requires all unique products and pages for full coverage',async()=>{
  const result=await collect24S(async(url)=>({ok:true,status:200,text:page(url.includes('?')?1:0,url.includes('?')?'DEF':'ABC'),url}));
  expect(result.coverage.status).toBe('FULL');expect(result.products.length).toBe(2);
 });
});
