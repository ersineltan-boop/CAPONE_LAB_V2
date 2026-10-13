import {createHash} from 'node:crypto';
import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fetchText,sleep} from './http';
import {farfetchProductId,parseFarfetchProductDetails,type VerifiedFarfetchProduct} from './farfetchProductDetails';
import type {PilotProduct} from './types';
import {farfetchAccessBlocked} from './farfetchAccess';
interface Row {url:string; checkedAt:string; status:number; product?:PilotProduct; evidence?:VerifiedFarfetchProduct; error?:string;}
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export async function collectFarfetchProductRefresh(options:{directory:string;urls:string[];previousProducts?:readonly PilotProduct[];budgetMs?:number;maxProducts?:number;concurrency?:number;http?:typeof fetchText;now?:()=>number}) {
 const http=options.http??fetchText,now=options.now??Date.now;
 const budget=Math.min(options.budgetMs??20*60_000,20*60_000),maximum=options.maxProducts??2500,concurrency=options.concurrency??1;
 if(!Number.isFinite(budget)||budget<=0||!Number.isInteger(maximum)||maximum<1||maximum>2500||!Number.isInteger(concurrency)||concurrency<1||concurrency>2)throw new Error('Invalid Farfetch product budget');
 const deadline=now()+budget;
 const urls=[...new Set(options.urls)];
 if(urls.some(url=>!farfetchProductId(url)||new URL(url).search||new URL(url).hash))throw new Error('Invalid Farfetch product refresh queue');
 await mkdir(options.directory,{recursive:true});
 const errors:string[]=[],products:PilotProduct[]=[],verifiedProducts:VerifiedFarfetchProduct[]=[];
 let checked=0,requests=0,blocked=false;
 const attempted=new Map<string,number>();
 // Published timestamps only order work. They never substitute for fresh proof.
 for(const product of options.previousProducts??[]) {
  const checkedAt=Date.parse(product.sourceVerifiedAt??'');
  if(product.source==='farfetch'&&Number.isFinite(checkedAt)&&checkedAt<=now())attempted.set(product.productUrl,checkedAt);
 }
 const savedRows=new Map<string,Row>();
 for(const url of urls) {
  try {
   const {checksum,...body}=JSON.parse(await readFile(join(options.directory,hash(url)+'.json'),'utf8'));
   if(hash(JSON.stringify(body))!==checksum||body.url!==url)throw new Error('Invalid product checkpoint');
   attempted.set(url,Date.parse(body.checkedAt)||0);
   const age=now()-Date.parse(body.checkedAt);
   if((body.product&&body.evidence||[404,410].includes(body.status))&&age>=0&&age<24*60*60_000)savedRows.set(url,body as Row);
  }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')errors.push(`Product checkpoint ignored: ${url}`);}
 }
 urls.sort((a,b)=>(attempted.get(a)??0)-(attempted.get(b)??0));
 const work:string[]=[];
 const include=(row:Row)=>{
  if(row.product&&row.evidence){products.push(row.product);verifiedProducts.push(row.evidence);}
  else errors.push(`${row.url}: ${row.error}`);
 };
 for(const url of urls){const row=savedRows.get(url);if(row)include(row);else work.push(url);}
 // A single shared start lock enforces >=900ms between actual HTTP starts,
 // including retries. At most two requests are in flight; an access block
 // cancels every queued start. A slow active request cannot block the other.
 let startTurn=Promise.resolve(),lastStart=now(),scheduled=0,index=0;
 async function request(url:string,reserve:number) {
  const previous=startTurn;
  let release!:()=>void;
  startTurn=new Promise<void>(resolve=>{release=resolve;});
  await previous;
  let responsePromise:ReturnType<typeof http>|undefined;
  try {
   const delay=Math.max(0,lastStart+900-now());
   if(blocked||now()+delay+reserve>deadline)return null;
   if(delay)await sleep(delay);
   if(blocked||now()+reserve>deadline)return null;
   requests++;
   responsePromise=http(url,{delayMs:0});
   lastStart=now();
  }finally{release();}
  const response=await responsePromise;
  if(farfetchAccessBlocked(response))blocked=true;
  return response;
 }
 async function worker() {
  while(!blocked&&index<work.length) {
   const url=work[index++];
   if(scheduled>=maximum||now()+32_000>deadline)continue;
   scheduled++;
   let response=await request(url,32_000);
   if(!response)continue;
   checked++;
   if(!blocked&&(response.status===0||response.status>=500)) {
    const retry=await request(url,17_000);if(retry)response=retry;
   }
   const checkedAt=new Date(now()).toISOString();
   if(farfetchAccessBlocked(response)) {
    errors.push(`Farfetch product access blocked (HTTP ${response.status}): ${url}`);break;
   }
   const detail=response.ok&&farfetchProductId(response.url)===farfetchProductId(url)?parseFarfetchProductDetails(response.text,url,checkedAt):null;
   const row:Row={url,checkedAt,status:response.status,...(detail?detail:{error:response.error??`Product identity/metadata unavailable (HTTP ${response.status})`})};
   const path=join(options.directory,hash(url)+'.json');
   await writeFile(path+'.tmp',JSON.stringify({...row,checksum:hash(JSON.stringify(row))}));await rename(path+'.tmp',path);
   include(row);
  }
 }
 const outcomes=await Promise.allSettled(Array.from({length:concurrency},()=>worker().catch(error=>{blocked=true;throw error;})));
 const failed=outcomes.find(result=>result.status==='rejected');if(failed?.status==='rejected')throw failed.reason;
 const pending=work.length-checked;
 if(pending&&!blocked)errors.push(`FARFETCH_PRODUCT_BUDGET_REACHED: ${pending} products pending`);
 return {products:blocked?[]:products,verifiedProducts:blocked?[]:verifiedProducts,errors,blocked,
  progress:{strategy:'product-pages',queued:urls.length,verified:products.length,unverified:urls.length-products.length,checkedThisRun:checked,requests,pending,checkedAt:new Date(now()).toISOString()}};
}
