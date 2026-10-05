import {afterEach, describe, expect, it} from 'vitest';
import {mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {collectFarfetchProgress} from '../farfetchProgress';
import {FARFETCH_SHOES_URL} from '../farfetch';
import {recordSourceRetry, sourceRetryPause} from '../sourceRetry';
import type {fetchText} from '../http';
const directories: string[] = [];
async function directory() {const dir=await mkdtemp(join(tmpdir(),'farfetch-progress-'));directories.push(dir);return dir;}
afterEach(async()=>{await Promise.all(directories.splice(0).map(dir=>rm(dir,{recursive:true,force:true})));});
function page(number: number, ids = number === 1 ? [1,2] : [3,4], total=4) {
 const state={apolloInitialState:{ROOT_QUERY:{'productCatalog:{"first":2}':{totalCount:total,pageInfo:{startCursor:btoa(String((number-1)*2+1)),hasNextPage:number<Math.ceil(total/2)}}}}};
 const items=ids.map(id=>({'@type':'Product',name:`Leather mule ${id}`,brand:{name:'Test'},image:`https://cdn-images.farfetch-contents.com/${id}_480.jpg`,offers:{url:`/uk/shopping/women/test-mule-item-${id}.aspx`}}));
 return `<script>window.__HYDRATION_STATE__=${JSON.stringify(JSON.stringify(state))};</script><script type="application/ld+json">${JSON.stringify({'@type':'ItemList',itemListElement:items})}</script>`;
}
const http: typeof fetchText=async url=>({ok:true,status:200,url,text:page(url.includes('page=2')?2:1)});
describe('bounded Farfetch progress',()=>{
 it('resumes persisted pages and publishes only a reconciled complete source',async()=>{
  const dir=await directory(); const first=await collectFarfetchProgress({directory:dir,maxPages:1,http});
  expect(first.coverageStatus).toBe('PARTIAL');expect(first.products).toEqual([]);expect(first.progress.nextPage).toBe(2);
  const calls:string[]=[];const next=await collectFarfetchProgress({directory:dir,maxPages:1,http:async(url,opts)=>{calls.push(url);return http(url,opts);}});
  expect(next.coverageStatus).toBe('FULL');expect(next.products).toHaveLength(4);expect(next.rawSourceProducts).toBe(4);
  expect(calls).toEqual([FARFETCH_SHOES_URL,FARFETCH_SHOES_URL+'?page=2',FARFETCH_SHOES_URL]);
 });
 it('starts a new epoch when the first-page identity changes',async()=>{
  const dir=await directory();await collectFarfetchProgress({directory:dir,maxPages:1,http});
  const r=await collectFarfetchProgress({directory:dir,maxPages:1,http:async url=>({ok:true,status:200,url,text:page(1,[8,9])})});
  expect(r.progress.resetReason).toBe('SOURCE_CHANGED_OR_CHECKPOINT_STALE');expect(r.progress.nextPage).toBe(2);expect(r.products).toEqual([]);
 });
 it('does not join stale saved pages to a new source observation',async()=>{
  const dir=await directory(); const start=Date.parse('2026-10-05T13:00:00Z');
  await collectFarfetchProgress({directory:dir,maxPages:1,http,now:()=>start});
  const r=await collectFarfetchProgress({directory:dir,maxPages:1,http,now:()=>start+61*60_000});
  expect(r.coverageStatus).toBe('PARTIAL');expect(r.progress.resetReason).toBe('SOURCE_CHANGED_OR_CHECKPOINT_STALE');
 });
 it('stops before launching a request which exceeds the remaining time budget',async()=>{
  const dir=await directory();let clock=0,calls=0;
  const r=await collectFarfetchProgress({directory:dir,budgetMs:20_000,now:()=>clock,http:async(url,opts)=>{calls++;clock+=10_000;return http(url,opts);}});
  expect(calls).toBe(1);expect(r.coverageStatus).toBe('PARTIAL');expect(r.errors).toContain('FARFETCH_TIME_BUDGET_REACHED_PROGRESS_SAVED');
 });
 it('does not advance the cursor on HTTP403 and never publishes cached partial products',async()=>{
  const dir=await directory();await collectFarfetchProgress({directory:dir,maxPages:1,http});
  const r=await collectFarfetchProgress({directory:dir,http:async(url,opts)=>url.includes('?')?{ok:false,status:403,url,text:'blocked'}:http(url,opts)});
  expect(r.blocked).toBe(true);expect(r.progress.nextPage).toBe(2);expect(r.products).toEqual([]);
 });
 it('rejects a damaged checkpoint page instead of completing with it',async()=>{
  const dir=await directory();await collectFarfetchProgress({directory:dir,maxPages:1,http});
  const state=JSON.parse(await readFile(join(dir,'progress.json'),'utf8'));await writeFile(join(dir,state.parts[0]+'.json'),'{}');
  const r=await collectFarfetchProgress({directory:dir,http});expect(r.products).toEqual([]);expect(r.coverageStatus).toBe('PARTIAL');expect(r.errors.join()).toContain('checksum mismatch');
  await expect(readdir(dir)).rejects.toThrow();
 });
 it('rejects overlapping pages even when totals and cursors look correct',async()=>{
  const r=await collectFarfetchProgress({directory:await directory(),http:async(url,opts)=>url.includes('?')?{ok:true,status:200,url,text:page(2,[2,3])}:http(url,opts)});
  expect(r.products).toEqual([]);expect(r.errors.join()).toContain('overlapping pages');
 });
 it('rejects a changing source at the final verification',async()=>{
  let rootCalls=0;const r=await collectFarfetchProgress({directory:await directory(),http:async(url,opts)=>{if(url===FARFETCH_SHOES_URL&&++rootCalls===2)return {ok:true,status:200,url,text:page(1,[7,8])};return http(url,opts);}});
  expect(r.products).toEqual([]);expect(r.errors.join()).toContain('final source check failed');
 });
});
describe('source retry windows',()=>{
 it('pauses403 for a week and allows another automatic probe after expiry',async()=>{
  const dir=await directory(),now=Date.parse('2026-10-05T13:00:00Z');await recordSourceRetry(dir,'level-shoes',['API HTTP 403'],now);
  expect(await sourceRetryPause(dir,'level-shoes',now+86400_000)).not.toBeNull();expect(await sourceRetryPause(dir,'level-shoes',now+7*86400_000)).toBeNull();
 });
 it('distinguishes temporary429 from access403 and does not pause ordinary schema failures',async()=>{
  const dir=await directory(),now=Date.now();await recordSourceRetry(dir,'farfetch',['HTTP 429'],now);
  expect(await sourceRetryPause(dir,'farfetch',now+30*60_000)).not.toBeNull();expect(await sourceRetryPause(dir,'farfetch',now+3600_000)).toBeNull();
  await recordSourceRetry(dir,'farfetch',['pagination metadata changed'],now);expect(await sourceRetryPause(dir,'farfetch',now)).toBeNull();
 });
});
