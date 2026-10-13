import {createHash} from 'node:crypto';
import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fetchText} from './http';
import {farfetchAccessBlocked} from './farfetchAccess';
import {FARFETCH_SHOES_URL,parseFarfetchCatalogPagination} from './farfetch';
import {FARFETCH_MULES_URL,farfetchProductId} from './farfetchProductIdentity';
import {collectFarfetchProgress} from './farfetchProgress';
import {collectFarfetchProductRefresh} from './farfetchProductRefresh';
import {isExcludedMarketplaceBrand} from '../marketplaces/marketplacePolicy';
import type {MarketplaceRefreshCandidate} from '../marketplaces/automation';
import type {PilotProduct} from './types';

const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
/** Listing observations discover URLs; only independent product-page proof can publish. */
export async function collectFarfetchMuleCandidate(options:{directory:string;previousProducts?:readonly PilotProduct[];maxProducts?:number;budgetMs?:number;concurrency?:number}):Promise<MarketplaceRefreshCandidate> {
 await mkdir(options.directory,{recursive:true});
 const root=await fetchText(FARFETCH_SHOES_URL,{delayMs:500});
 if(farfetchAccessBlocked(root))throw new Error(`Farfetch access blocked (HTTP ${root.status})`);
 const source=root.ok?parseFarfetchCatalogPagination(root.text):null;
 if(!source||source.page!==1||source.total<1)throw new Error(`Farfetch authoritative root unavailable: HTTP ${root.status}`);
 let queue:{urls:string[];discoveredAt:string}|undefined;
 try {
  const {checksum,...body}=JSON.parse(await readFile(join(options.directory,'queue.json'),'utf8'));
  const age=Date.now()-Date.parse(body.discoveredAt);
  if(digest(JSON.stringify(body))===checksum&&age>=0&&age<24*60*60_000&&Array.isArray(body.urls)&&body.urls.length&&
   body.urls.every((url:unknown)=>typeof url==='string'&&farfetchProductId(url)&&!new URL(url).search&&!new URL(url).hash))queue=body;
 }catch { /* Recollect absent, damaged or expired discovery evidence. */ }
 if(!queue){
  const listing=await collectFarfetchProgress({directory:join(options.directory,'listing'),listingUrl:FARFETCH_MULES_URL,reconcileCountChanges:true,captureObservations:true,budgetMs:3*60_000});
  if(listing.blocked)throw new Error(listing.errors.join('; '));
  const urls=[...new Set((listing.observations??[]).map(p=>p.productUrl))];
  if(!urls.length)throw new Error('No authoritative Mule observations');
  queue={urls,discoveredAt:new Date().toISOString()};
  await writeFile(join(options.directory,'queue.json.tmp'),JSON.stringify({...queue,checksum:digest(JSON.stringify(queue))}));
  await rename(join(options.directory,'queue.json.tmp'),join(options.directory,'queue.json'));
 }
 console.log(`Farfetch Mule queue: ${queue.urls.length} product URLs`);
 const result=await collectFarfetchProductRefresh({directory:join(options.directory,'products'),urls:queue.urls,previousProducts:options.previousProducts,maxProducts:options.maxProducts,budgetMs:options.budgetMs,concurrency:options.concurrency});
 await writeFile(join(options.directory,'result.json'),JSON.stringify(result));
 return {sourceId:'farfetch',publicationMode:'verified-products',verifiedProducts:result.verifiedProducts,
  products:result.products,coverageStatus:'PARTIAL',sourceTotal:source.total,rawCollected:result.products.length,
  eligibleTotal:result.products.filter(p=>!isExcludedMarketplaceBrand(p.brand)).length,paginationExhausted:false,
  errors:result.errors,collectionProgress:result.progress};
}
