import {afterEach, describe, expect, it} from 'vitest';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {collectFarfetchCategories} from '../farfetchCategories';
import {FARFETCH_SHOES_URL, discoverFarfetchFootwearListings, farfetchCategoryKey} from '../farfetch';
import type {fetchText} from '../http';
const dirs:string[]=[];
async function directory() {const dir=await mkdtemp(join(tmpdir(),'farfetch-categories-'));dirs.push(dir);return dir;}
afterEach(async()=>{await Promise.all(dirs.splice(0).map(dir=>rm(dir,{recursive:true,force:true})));});
const mules=FARFETCH_SHOES_URL.replace('shoes-1','mules-1');
const loafers=FARFETCH_SHOES_URL.replace('shoes-1','loafers-1');
function html(ids:number[], total=ids.length, links:string[]=[]) {
 const state={apolloInitialState:{ROOT_QUERY:{'productCatalog:{"first":2}':{totalCount:total,pageInfo:{startCursor:btoa('1'),hasNextPage:total>2}}}}};
 const items=ids.map(id=>({'@type':'Product',name:`Leather mule ${id}`,brand:{name:'Test'},image:`https://cdn-images.farfetch-contents.com/${id}_480.jpg`,offers:{url:`/uk/shopping/women/test-mule-item-${id}.aspx`}}));
 return `<script>window.__HYDRATION_STATE__=${JSON.stringify(JSON.stringify(state))};</script><script type="application/ld+json">${JSON.stringify({'@type':'ItemList',itemListElement:items})}</script>`+links.map(url=>`<a href="${url}">category</a>`).join('');
}
const response=(url:string,text:string)=>({url,text,ok:true,status:200});
describe('Farfetch category completeness',()=>{
 it('stops the entire source at an HTTP 200 human-verification page',async()=>{
  const calls:string[]=[];
  const r=await collectFarfetchCategories({directory:await directory(),http:async url=>{calls.push(url);return response(url,'<h1>Verify you are human</h1>');}});
  expect(r.blocked).toBe(true);expect(r.products).toEqual([]);expect(calls).toEqual([FARFETCH_SHOES_URL]);
 });
 it('includes official Oxford, slide and slipper routes while excluding accessories and brand pages',()=>{
  const routes=['derby-oxford-shoes','flip-flops-slides','slippers'].map(key=>FARFETCH_SHOES_URL.replace('shoes-1',key+'-1'));
  const forbidden=[FARFETCH_SHOES_URL.replace('shoes-1','shoe-accessories-1'),FARFETCH_SHOES_URL.replace('shoes-1','test-brand/shoes-1')];
  const found=discoverFarfetchFootwearListings(html([1,2],2,[...routes,...forbidden]),FARFETCH_SHOES_URL).filter(url=>url!==FARFETCH_SHOES_URL&&farfetchCategoryKey(url));
  expect(found).toEqual(routes);
  for(const url of forbidden)expect(farfetchCategoryKey(url)).toBeNull();
 });
 it('merges overlapping categories only after root and every category reconcile',async()=>{
  const calls:string[]=[];
  const http:typeof fetchText=async url=>{calls.push(url);return response(url,html([1,2],2,url===FARFETCH_SHOES_URL?[mules,loafers]:[]));};
  const r=await collectFarfetchCategories({directory:await directory(),http});
  expect(r.coverageStatus).toBe('FULL');expect(r.products).toHaveLength(2);expect(r.rawSourceProducts).toBe(2);
  expect(r.progress.categories).toHaveLength(2);expect(calls.at(-1)).toBe(FARFETCH_SHOES_URL);
 });
 it('never treats an exhausted category as complete marketplace coverage',async()=>{
  const http:typeof fetchText=async url=>response(url,html([1,2],url===FARFETCH_SHOES_URL?4:2,url===FARFETCH_SHOES_URL?[mules]:[]));
  const r=await collectFarfetchCategories({directory:await directory(),http});
  expect(r.coverageStatus).toBe('PARTIAL');expect(r.products).toHaveLength(2);expect(r.verifiedScopes).toHaveLength(1);
  expect(r.errors.join()).toContain('2/4');
 });
 it('stops the whole source on access denial without probing another category',async()=>{
  const calls:string[]=[];
  const http:typeof fetchText=async url=>{calls.push(url);return url===FARFETCH_SHOES_URL?response(url,html([1,2],2,[loafers,mules])):{url,text:'access denied',ok:false,status:403};};
  const r=await collectFarfetchCategories({directory:await directory(),http});
  expect(r.blocked).toBe(true);expect(r.products).toEqual([]);expect(calls).toEqual([FARFETCH_SHOES_URL,mules]);
 });
 it('rejects a changed root after successful category checks',async()=>{
  let roots=0;
  const http:typeof fetchText=async url=>response(url,html(url===FARFETCH_SHOES_URL&&++roots===2?[8,9]:[1,2],2,url===FARFETCH_SHOES_URL?[mules]:[]));
  const r=await collectFarfetchCategories({directory:await directory(),http});
  expect(r.products).toHaveLength(2);expect(r.coverageStatus).toBe('PARTIAL');expect(r.errors.join()).toContain('final root check failed');
 });
 it('does not guess category routes when official links are missing',async()=>{
  const r=await collectFarfetchCategories({directory:await directory(),http:async url=>response(url,html([1,2]))});
  expect(r.products).toEqual([]);expect(r.errors.join()).toContain('category links missing');
 });
});
