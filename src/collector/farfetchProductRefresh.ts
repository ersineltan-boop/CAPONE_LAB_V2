import {createHash} from 'node:crypto';
import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fetchText} from './http';
import {farfetchProductId,parseFarfetchProductDetails,type VerifiedFarfetchProduct} from './farfetchProductDetails';
import type {PilotProduct} from './types';
import {farfetchAccessBlocked} from './farfetchAccess';
interface Row {url:string; checkedAt:string; status:number; product?:PilotProduct; evidence?:VerifiedFarfetchProduct; error?:string;}
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export async function collectFarfetchProductRefresh(options:{directory:string;urls:string[];previousProducts?:readonly PilotProduct[];budgetMs?:number;maxProducts?:number;http?:typeof fetchText;now?:()=>number}) {
 const http=options.http??fetchText,now=options.now??Date.now;
 const budget=Math.min(options.budgetMs??20*60_000,20*60_000),maximum=options.maxProducts??2500;
 if(!Number.isFinite(budget)||budget<=0||!Number.isInteger(maximum)||maximum<1||maximum>2500)throw new Error('Invalid Farfetch product budget');
 const deadline=now()+budget;
 const urls=[...new Set(options.urls)];
 if(urls.some(url=>!farfetchProductId(url)||new URL(url).search||new URL(url).hash))throw new Error('Invalid Farfetch product refresh queue');
 await mkdir(options.directory,{recursive:true});
 const errors:string[]=[],products:PilotProduct[]=[],verifiedProducts:VerifiedFarfetchProduct[]=[];
 let checked=0,requests=0,blocked=false,pending=0;
 // New/unverified URLs precede previously attempted rows. Across scheduled
 // runs, expired early rows cannot repeatedly starve the untouched tail.
 const attempted=new Map<string,number>();
 // Published timestamps only order work when a cache is absent. They never
 // substitute for a fresh product page and its matching document proof.
 for(const product of options.previousProducts??[]) {
  const checkedAt=Date.parse(product.sourceVerifiedAt??'');
  if(product.source==='farfetch'&&Number.isFinite(checkedAt)&&checkedAt<=now())attempted.set(product.productUrl,checkedAt);
 }
 for(const url of urls) {
  try {const saved=JSON.parse(await readFile(join(options.directory,hash(url)+'.json'),'utf8'));const {checksum,...body}=saved;
   if(hash(JSON.stringify(body))===checksum&&body.url===url)attempted.set(url,Date.parse(body.checkedAt)||0);
  }catch { /* Never-attempted or damaged records are checked first. */ }
 }
 urls.sort((a,b)=>(attempted.get(a)??0)-(attempted.get(b)??0));
 for(const url of urls) {
  const path=join(options.directory,hash(url)+'.json');
  let row:Row|undefined;
  try {
   const saved=JSON.parse(await readFile(path,'utf8'));
   const {checksum,...body}=saved;
   if(hash(JSON.stringify(body))!==checksum||body.url!==url)throw new Error('Invalid product checkpoint');
   if((body.product&&body.evidence||[404,410].includes(body.status))&&now()-Date.parse(body.checkedAt)>=0&&now()-Date.parse(body.checkedAt)<24*60*60_000)row=body;
  }catch(error) {if((error as NodeJS.ErrnoException).code!=='ENOENT')errors.push(`Product checkpoint ignored: ${url}`);}
  if(!row) {
   if(now()+32_000>deadline||checked>=maximum){pending++;continue;}
   let response=await http(url,{delayMs:900});requests++;
   if(!farfetchAccessBlocked(response)&&(response.status===0||response.status>=500)&&now()+17_000<=deadline){response=await http(url,{delayMs:900});requests++;}
   checked++;
   const checkedAt=new Date(now()).toISOString();
   if(farfetchAccessBlocked(response)) {
    blocked=true;errors.push(`Farfetch product access blocked (HTTP ${response.status}): ${url}`);break;
   }
   const detail=response.ok&&farfetchProductId(response.url)===farfetchProductId(url)?parseFarfetchProductDetails(response.text,url,checkedAt):null;
   row={url,checkedAt,status:response.status,...(detail?detail:{error:response.error??`Product identity/metadata unavailable (HTTP ${response.status})`})};
   // Failed attempts also retain ordering evidence, but are never reused as
   // verified products. They remain retryable after the unvisited tail.
   {
    await writeFile(path+'.tmp',JSON.stringify({...row,checksum:hash(JSON.stringify(row))}));await rename(path+'.tmp',path);
   }
  }
  if(row.product&&row.evidence){products.push(row.product);verifiedProducts.push(row.evidence);}else errors.push(`${url}: ${row.error}`);
 }
 if(pending)errors.push(`FARFETCH_PRODUCT_BUDGET_REACHED: ${pending} products pending`);
 return {products:blocked?[]:products,verifiedProducts:blocked?[]:verifiedProducts,errors,blocked,
  progress:{strategy:'product-pages',queued:urls.length,verified:products.length,unverified:urls.length-products.length,checkedThisRun:checked,requests,pending,checkedAt:new Date(now()).toISOString()}};
}
