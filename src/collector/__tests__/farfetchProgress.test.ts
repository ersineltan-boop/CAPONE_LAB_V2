import {afterEach, describe, expect, it} from 'vitest';
import {mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {collectFarfetchProgress} from '../farfetchProgress';
import {FARFETCH_SHOES_URL} from '../farfetch';
import {recordSourceRetry, sourceRetryPause} from '../sourceRetry';
import type {fetchText} from '../http';
import {evaluateMarketplaceCandidate} from '../../marketplaces/automation';
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
 it('resumes a fresh unchanged first page across count changes without discarding its validated prefix',async()=>{
  for(const maxPages of [1,2]){
   const dir=await directory();await collectFarfetchProgress({directory:dir,maxPages,http,reconcileCountChanges:true});
   const calls:string[]=[];
   const r=await collectFarfetchProgress({directory:dir,reconcileCountChanges:true,http:async url=>{
    calls.push(url);const n=Number(new URL(url).searchParams.get('page')??1);
    return {ok:true,status:200,url,text:page(n,n===1?[1,2]:n===2?[3,4]:[5],5)};
   }});
   expect(r.coverageStatus).toBe('FULL');expect(r.products).toHaveLength(5);
   expect(r.progress.resetReason).toBeNull();expect(r.progress.countChanges).toContainEqual({page:1,previous:4,observed:5});
   expect(calls).toEqual([FARFETCH_SHOES_URL,FARFETCH_SHOES_URL+'?page=2',FARFETCH_SHOES_URL+'?page=3',FARFETCH_SHOES_URL]);
  }
 });
 it('rechecks the final page once when a moving final count can be reconciled to actual new cards',async()=>{
  let roots=0,seconds=0;const calls:string[]=[];
  const r=await collectFarfetchProgress({directory:await directory(),reconcileCountChanges:true,http:async url=>{
   calls.push(url);
   if(url.includes('page=3'))return {ok:true,status:200,url,text:page(3,[5],5)};
   if(url.includes('page=2'))return {ok:true,status:200,url,text:page(2,[3,4],++seconds===1?4:5)};
   return {ok:true,status:200,url,text:page(1,[1,2],++roots===1?4:5)};
  }});
  expect(r.coverageStatus).toBe('FULL');expect(r.products).toHaveLength(5);expect(r.pagesTraversed).toBe(7);
  expect(calls.filter(url=>url.includes('page=2'))).toHaveLength(2);
 });
 it('counts every source card but quarantines unresolved product types instead of inventing footwear',async()=>{
  const r=await collectFarfetchProgress({directory:await directory(),http:async(url,opts)=>{
   const response=await http(url,opts);return {...response,text:response.text.replace('Leather mule 4','leather tote bag')};
  }});
  expect(r.coverageStatus).toBe('FULL');expect(r.rawSourceProducts).toBe(4);expect(r.products).toHaveLength(4);
  expect(r.products.find(p=>p.productName==='leather tote bag')?.category).toBeNull();
  const decision=evaluateMarketplaceCandidate({candidate:{sourceId:'farfetch',products:r.products,coverageStatus:'FULL',
   sourceTotal:4,rawCollected:4,eligibleTotal:4,paginationExhausted:true,errors:[],newnessVerified:false},previousLastGood:[],preserveMissing:true});
  expect(decision.report.accepted).toBe(true);expect(decision.report.publicationCoverage).toBe('PARTIAL');
  expect(decision.eligibleProducts).toHaveLength(3);expect(decision.quarantined).toHaveLength(1);
 });
 it('reclassifies saved source items instead of trusting an older converted cache',async()=>{
  const dir=await directory();await collectFarfetchProgress({directory:dir,maxPages:1,http});
  const state=JSON.parse(await readFile(join(dir,'progress.json'),'utf8'));
  const saved=JSON.parse(await readFile(join(dir,state.parts[0]+'.json'),'utf8'));
  expect(saved.sourceItems).toHaveLength(2);
  saved.products=[];
  const body=JSON.stringify(saved),hash=createHash('sha256').update(body).digest('hex');
  await writeFile(join(dir,hash+'.json'),body);state.parts[0]=hash;
  await writeFile(join(dir,'progress.json'),JSON.stringify(state));
  const calls:string[]=[];
  const r=await collectFarfetchProgress({directory:dir,http:async(url,opts)=>{calls.push(url);return http(url,opts);}});
  expect(r.coverageStatus).toBe('FULL');expect(r.products).toHaveLength(4);
  expect(calls).toEqual([FARFETCH_SHOES_URL,FARFETCH_SHOES_URL+'?page=2',FARFETCH_SHOES_URL]);
 });
 it('retains an unconverted source epoch without publishing it and still rejects stale reuse',async()=>{
  const dir=await directory(),start=Date.parse('2026-10-19T13:00:00Z');
  const missingIdentity:typeof fetchText=async(url,opts)=>{const r=await http(url,opts);return {...r,text:r.text.replace('"name":"Leather mule 4","brand":{"name":"Test"}','"name":"Leather mule 4"')};};
  const r=await collectFarfetchProgress({directory:dir,http:missingIdentity,now:()=>start});
  expect(r.products).toEqual([]);expect(r.errors.join()).toContain('product conversion does not reconcile: 3/4');
  expect(JSON.parse(await readFile(join(dir,'progress.json'),'utf8')).nextPage).toBe(3);
  const next=await collectFarfetchProgress({directory:dir,http:missingIdentity,maxPages:1,now:()=>start+61*60_000});
  expect(next.coverageStatus).toBe('PARTIAL');expect(next.progress.resetReason).toBe('SOURCE_CHANGED_OR_CHECKPOINT_STALE');
 });
 it('stops a visible HTTP 200 access challenge before collecting another listing page',async()=>{
  const calls:string[]=[];
  const r=await collectFarfetchProgress({directory:await directory(),http:async url=>{calls.push(url);return {ok:true,status:200,url,text:'<h1>Verify you are human</h1>'};}});
  expect(r.blocked).toBe(true);expect(r.products).toEqual([]);expect(calls).toEqual([FARFETCH_SHOES_URL]);
 });
 it('exposes discovery observations from an interrupted snapshot without certifying them for publication',async()=>{
  let roots=0;
  const r=await collectFarfetchProgress({directory:await directory(),captureObservations:true,http:async url=>({ok:true,status:200,url,
   text:url.includes('?')?page(2):page(1,++roots===1?[1,2]:[7,8])})});
  expect(r.coverageStatus).toBe('PARTIAL');expect(r.products).toEqual([]);expect(r.observations).toHaveLength(4);
 });
 it('keeps the default strict count mode and isolates checkpoints when the mode changes',async()=>{
  const moving:typeof fetchText=async url=>({ok:true,status:200,url,text:url.includes('?')?page(2,[3,4],4):page(1,[1,2],5)});
  const dir=await directory();const first=await collectFarfetchProgress({directory:dir,http:moving});
  expect(first.products).toEqual([]);expect(first.errors.join()).toContain('pagination changed');
  const next=await collectFarfetchProgress({directory:dir,http:moving,maxPages:1,reconcileCountChanges:true});
  expect(next.progress.resetReason).toBe('SOURCE_CHANGED_OR_CHECKPOINT_STALE');expect(next.progress.nextPage).toBe(2);
 });
 it('reconciles a changing count only against complete unique cards and the final source count',async()=>{
  let roots=0;
  const moving:typeof fetchText=async url=>({ok:true,status:200,url,text:url.includes('?')?page(2,[3,4],4):page(1,[1,2],++roots===1?5:4)});
  const r=await collectFarfetchProgress({directory:await directory(),http:moving,reconcileCountChanges:true});
  expect(r.coverageStatus).toBe('FULL');expect(r.products).toHaveLength(4);expect(r.sourceReportedProductCount).toBe(4);
 });
 it('still rejects overlapping pages while reconciling moving counts',async()=>{
  let roots=0;
  const r=await collectFarfetchProgress({directory:await directory(),reconcileCountChanges:true,http:async url=>({ok:true,status:200,url,text:url.includes('?')?page(2,[2,3],4):page(1,[1,2],++roots===1?5:4)})});
  expect(r.products).toEqual([]);expect(r.errors.join()).toContain('overlapping pages');
 });
 it('does not certify moving counts when the final source disagrees',async()=>{
  let calls=0;
  const r=await collectFarfetchProgress({directory:await directory(),reconcileCountChanges:true,http:async url=>{calls++;return {ok:true,status:200,url,text:url.includes('?')?page(2,[3,4],4):page(1,[1,2],5)};}});
  expect(r.products).toEqual([]);expect(r.errors.join()).toContain('final source check failed');
  expect(calls).toBeLessThanOrEqual(7);
 });
 it('retries a temporary connection failure once and completes without losing saved pages',async()=>{
  let attempts=0;
  const r=await collectFarfetchProgress({directory:await directory(),http:async(url,opts)=>{
   if(url.includes('page=2')&&++attempts===1)return {ok:false,status:0,url,text:'',error:'timeout'};
   return http(url,opts);
  }});
  expect(attempts).toBe(2);expect(r.coverageStatus).toBe('FULL');expect(r.products).toHaveLength(4);
 });
 it('isolates checkpoints by category even when the first cards match',async()=>{
  const dir=await directory(); await collectFarfetchProgress({directory:dir,maxPages:1,http});
  const listingUrl='https://www.farfetch.com/uk/shopping/women/mules-1/items.aspx';
  const r=await collectFarfetchProgress({directory:dir,maxPages:1,http,listingUrl});
  expect(r.progress.resetReason).toBe('SOURCE_CHANGED_OR_CHECKPOINT_STALE');
  expect(r.progress.nextPage).toBe(2);
  expect(JSON.parse(await readFile(join(dir,'progress.json'),'utf8')).listing).toBe(listingUrl);
 });
 it('rejects non-source and query-bearing category URLs before fetching',async()=>{
  for(const listingUrl of ['https://example.com/uk/shopping/women/mules-1/items.aspx', FARFETCH_SHOES_URL+'?page=2']) {
   await expect(collectFarfetchProgress({directory:await directory(),listingUrl,http})).rejects.toThrow('Invalid Farfetch');
  }
 });
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
 it('pauses further collection after a human-verification page with HTTP 200',async()=>{
  const dir=await directory(),now=Date.now();await recordSourceRetry(dir,'farfetch',['Farfetch product access blocked (HTTP 200)'],now);
  expect(await sourceRetryPause(dir,'farfetch',now+86400_000)).not.toBeNull();
 });
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
