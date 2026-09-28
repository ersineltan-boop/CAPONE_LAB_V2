import {describe, it, expect} from 'vitest';
import {collect24S, parse24SPage} from '../twentyFourS';
function page(index: number, id: string) {
 const state = {props:{pageProps:{initialState:{plp:{universe:'women', idCategory:'women_shoes',page:index,nbPages:2,nbHits:2,hits:[{objectID:id,brand:'ISABEL MARANT',title:'Fersi loafers',productSlug:'fersi-loafers',images:{1:'imagehash'}}]}}}}};
 return `<img src="https://www.24s.com/static/images/signature/fit-in/500x0/imagehash"><script id="__NEXT_DATA__">${JSON.stringify(state)}</script>`;
}
describe('24S collection',()=>{
 it('requires the women footwear source and preserves real image URLs',()=>{
  const p=parse24SPage(page(0,'ABC'));expect(p.products[0].brand).toBe('ISABEL MARANT');
  expect(p.products[0].images).toEqual(['https://www.24s.com/static/images/signature/fit-in/500x0/imagehash']);
  expect(()=>parse24SPage(page(0,'ABC').replace('women_shoes','women_bags'))).toThrow();
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
