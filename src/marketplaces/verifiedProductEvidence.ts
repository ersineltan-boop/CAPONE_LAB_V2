import {farfetchProductId,FARFETCH_MULES_URL,type VerifiedFarfetchProduct} from '../collector/farfetchProductIdentity';
import type {PilotProduct} from '../collector/types';
export function validateVerifiedProducts(input:{sourceId:string;products:readonly PilotProduct[];evidence:readonly VerifiedFarfetchProduct[];preserveMissing:boolean;rawCollected:number;now?:number}) {
 const errors:string[]=[];
 if(input.sourceId!=='farfetch'||!input.preserveMissing)errors.push('product verification requires Farfetch archive preservation');
 if(!input.evidence.length)errors.push('verified product evidence is missing');
 const records=new Map(input.products.map(p=>[p.productUrl,p]));
 const seen=new Set<string>(),now=input.now??Date.now();
 for(const row of input.evidence) {
  const record=records.get(row.url),age=now-Date.parse(row.checkedAt);
  if(seen.has(row.url)||!farfetchProductId(row.url)||row.productId!==farfetchProductId(row.url)||row.listingUrl!==FARFETCH_MULES_URL||
   !/^[a-f0-9]{64}$/.test(row.documentSha256)||!Number.isFinite(age)||age<0||age>24*60*60_000||
   !record||record.sourceVerifiedAt!==row.checkedAt||record.sourceCategoryUrl!==row.listingUrl)errors.push('invalid, stale or unmatched verified product evidence');
  seen.add(row.url);
 }
 if(seen.size!==input.rawCollected||seen.size!==input.products.length||[...records.keys()].some(url=>!seen.has(url)))errors.push('verified product union does not match the candidate');
 return [...new Set(errors)];
}
