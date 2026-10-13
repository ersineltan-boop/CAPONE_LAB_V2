import {afterEach,describe,expect,it} from 'vitest';
import {mkdtemp,rm,readdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {collectFarfetchProductRefresh} from '../farfetchProductRefresh';
import {parseFarfetchProductDetails} from '../farfetchProductDetails';
const dirs:string[]=[];
const url=(id:number)=>`https://www.farfetch.com/uk/shopping/women/leather-mule-item-${id}.aspx`;
const image=(id:number)=>`https://cdn-images.farfetch-contents.com/${id}_1000.jpg`;
function page(id:number,offer=url(id)) {
 const group={'@context':'https://schema.org','@type':'ProductGroup',productGroupID:String(id),name:'Leather mules',brand:{name:'Aeyde'},color:'Black',
  image:[{'@type':'ImageObject',contentUrl:image(id)}],hasVariant:[{'@type':'Product',sku:`${id}-38`,size:'38',name:'Leather mules 38',offers:{url:offer,availability:'https://schema.org/InStock'}}]};
 const graph={apolloInitialState:{ROOT_QUERY:{[`variation({"productId":"${id}"})`]:{__ref:'selected'},'variation({"productId":"999"})':{__ref:'recommended'}},
  selected:{internalProductId:String(id),images:[{size1000:{url:image(id+100)}}]},recommended:{internalProductId:'999',images:[{size1000:{url:image(999)}}]}}};
 return `<script nonce="test" type="application/ld+json">${JSON.stringify(group)}</script><script>window.__HYDRATION_STATE__=${JSON.stringify(JSON.stringify(graph))};</script>`;
}
async function directory(){const dir=await mkdtemp(join(tmpdir(),'ff-product-'));dirs.push(dir);return dir;}
afterEach(async()=>{await Promise.all(dirs.splice(0).map(dir=>rm(dir,{recursive:true,force:true})));});
describe('Farfetch model-level verification',()=>{
 it('checks at most two pages together with one global request interval',async()=>{
  let active=0,peak=0;const starts:number[]=[];
  const r=await collectFarfetchProductRefresh({directory:await directory(),urls:[url(11),url(12),url(13)],concurrency:2,http:async u=>{
   starts.push(Date.now());active++;peak=Math.max(peak,active);
   await new Promise(resolve=>setTimeout(resolve,1400));active--;
   return {ok:true,status:200,url:u,text:page(Number(u.match(/item-(\d+)/)![1]))};
  }});
  expect(peak).toBe(2);expect(r.products).toHaveLength(3);expect(r.progress.checkedThisRun).toBe(3);
  for(let i=1;i<starts.length;i++)expect(starts[i]-starts[i-1]).toBeGreaterThanOrEqual(890);
 },10000);
 it('stops queued starts when either active page returns an access denial',async()=>{
  const calls:string[]=[];
  const r=await collectFarfetchProductRefresh({directory:await directory(),urls:[url(11),url(12),url(13)],concurrency:2,http:async u=>{
   calls.push(u);await new Promise(resolve=>setTimeout(resolve,u===url(11)?1100:1900));
   return u===url(11)?{ok:false,status:403,url:u,text:'Access denied'}:{ok:true,status:200,url:u,text:page(12)};
  }});
  expect(calls).toEqual([url(11),url(12)]);expect(r.blocked).toBe(true);expect(r.products).toEqual([]);expect(r.verifiedProducts).toEqual([]);
 },10000);
 it('shares the maximum product limit across workers and retries a transient response only once',async()=>{
  let calls=0;
  const r=await collectFarfetchProductRefresh({directory:await directory(),urls:[url(11),url(12)],maxProducts:1,concurrency:2,http:async u=>{
   calls++;return calls===1?{ok:false,status:500,url:u,text:''}:{ok:true,status:200,url:u,text:page(11)};
  }});
  expect(calls).toBe(2);expect(r.progress.checkedThisRun).toBe(1);expect(r.progress.pending).toBe(1);expect(r.products.map(p=>p.productUrl)).toEqual([url(11)]);
 });
 it('rejects a concurrency above the source limit before making any request',async()=>{
  await expect(collectFarfetchProductRefresh({directory:await directory(),urls:[url(11)],concurrency:3,http:async()=>{throw new Error('No request');}})).rejects.toThrow('Invalid Farfetch product budget');
 });
 it('reads ProductGroup, sizes and only the requested variation gallery',()=>{
  const r=parseFarfetchProductDetails(page(11),url(11),'2026-10-13T00:00:00Z')!;
  expect(r.product.images).toEqual([image(11),image(111)]);expect(r.product.images).not.toContain(image(999));
  expect(r.product.color).toBe('Black');expect(r.product.sourceSizes?.[0].sku).toBe('11-38');
  expect(r.evidence.productId).toBe('11');expect(r.evidence.documentSha256).toMatch(/^[a-f0-9]{64}$/);
 });
 it('rejects another model or a men-only product offer',()=>{
  expect(parseFarfetchProductDetails(page(12),url(11),'2026-10-13')).toBeNull();
  expect(parseFarfetchProductDetails(page(11,url(11).replace('/women/','/men/')),url(11),'2026-10-13')).toBeNull();
 });
 it('keeps size availability unknown when the source makes no stock claim',()=>{
  const html=page(11).replace(',"availability":"https://schema.org/InStock"','');
  expect(parseFarfetchProductDetails(html,url(11),'2026-10-13')!.product.sourceSizes?.[0].selectable).toBeNull();
 });
 it('resumes fresh verified rows without another request',async()=>{
  const dir=await directory(),calls:string[]=[];
  const http=async(u:string)=>{calls.push(u);const id=Number(u.match(/item-(\d+)/)![1]);return {ok:true,status:200,url:u,text:page(id)};};
  const first=await collectFarfetchProductRefresh({directory:dir,urls:[url(11),url(12)],maxProducts:1,http,now:()=>1000});
  expect(first.products).toHaveLength(1);
  const next=await collectFarfetchProductRefresh({directory:dir,urls:[url(11),url(12)],maxProducts:1,http,now:()=>2000});
  expect(next.products).toHaveLength(2);expect(calls).toEqual([url(11),url(12)]);
 });
 it('does not starve unvisited URLs when early cached rows expire',async()=>{
  const dir=await directory(),calls:string[]=[];
  const http=async(u:string)=>{calls.push(u);const id=Number(u.match(/item-(\d+)/)![1]);return {ok:true,status:200,url:u,text:page(id)};};
  await collectFarfetchProductRefresh({directory:dir,urls:[url(11),url(12)],maxProducts:1,http,now:()=>1000});
  const next=await collectFarfetchProductRefresh({directory:dir,urls:[url(11),url(12)],maxProducts:1,http,now:()=>48*60*60_000});
  expect(calls).toEqual([url(11),url(12)]);expect(next.products[0].productUrl).toBe(url(12));
 });
 it('prioritizes unpublished URLs after a cache loss without reusing published timestamps as fresh proof',async()=>{
  const calls:string[]=[];
  const previous=parseFarfetchProductDetails(page(11),url(11),new Date(1000).toISOString())!.product;
  const r=await collectFarfetchProductRefresh({directory:await directory(),urls:[url(11),url(12)],previousProducts:[previous],maxProducts:1,now:()=>2000,
   http:async u=>{calls.push(u);return {ok:true,status:200,url:u,text:page(12)};}});
  expect(calls).toEqual([url(12)]);expect(r.products.map(p=>p.productUrl)).toEqual([url(12)]);expect(r.verifiedProducts).toHaveLength(1);
 });
 it('stops on access denial without requesting another product',async()=>{
  const calls:string[]=[];
  const r=await collectFarfetchProductRefresh({directory:await directory(),urls:[url(11),url(12)],http:async u=>{calls.push(u);return {ok:false,status:403,url:u,text:'Access denied'};}});
  expect(r.blocked).toBe(true);expect(r.products).toEqual([]);expect(calls).toEqual([url(11)]);
 });
 it('stops on a human-verification response even with HTTP 200 and discards publication evidence',async()=>{
  const calls:string[]=[];
  const r=await collectFarfetchProductRefresh({directory:await directory(),urls:[url(11),url(12),url(13)],http:async u=>{
   calls.push(u);return {ok:true,status:200,url:u,text:u===url(11)?page(11):'<h1>Verify you are human</h1>'};
  }});
  expect(r.blocked).toBe(true);expect(r.products).toEqual([]);expect(r.verifiedProducts).toEqual([]);expect(calls).toEqual([url(11),url(12)]);
 });
 it('does not retry a server response that visibly asks for human verification',async()=>{
  let calls=0;
  const r=await collectFarfetchProductRefresh({directory:await directory(),urls:[url(11)],http:async u=>{calls++;return {ok:false,status:503,url:u,text:'<h1>Checking your browser</h1>'};}});
  expect(r.blocked).toBe(true);expect(calls).toBe(1);
 });
 it('remembers confirmed unavailable pages without turning them into publication evidence',async()=>{
  const dir=await directory(),http=async(u:string)=>({ok:false,status:410,url:u,text:'Gone'});
  const r=await collectFarfetchProductRefresh({directory:dir,urls:[url(11)],http,now:()=>1000});
  expect(r.products).toEqual([]);
  const next=await collectFarfetchProductRefresh({directory:dir,urls:[url(11)],http:async()=>{throw new Error('Do not repeat a fresh 410');},now:()=>2000});
  expect(next.progress.requests).toBe(0);expect(next.verifiedProducts).toEqual([]);
 });
 it('checks a damaged checkpoint again instead of publishing its cached product',async()=>{
  const dir=await directory();
  await collectFarfetchProductRefresh({directory:dir,urls:[url(11)],http:async u=>({ok:true,status:200,url:u,text:page(11)}),now:()=>1000});
  const file=(await readdir(dir))[0];await writeFile(join(dir,file),'{}');
  const r=await collectFarfetchProductRefresh({directory:dir,urls:[url(11)],http:async u=>({ok:false,status:404,url:u,text:''}),now:()=>2000});
  expect(r.products).toEqual([]);expect(r.progress.requests).toBe(1);expect(r.errors.join()).toContain('checkpoint ignored');
 });
 it('never treats a redirected different model as verified',async()=>{
  const r=await collectFarfetchProductRefresh({directory:await directory(),urls:[url(11)],http:async()=>({ok:true,status:200,url:url(12),text:page(12)})});
  expect(r.products).toEqual([]);expect(r.progress.unverified).toBe(1);
 });
});
