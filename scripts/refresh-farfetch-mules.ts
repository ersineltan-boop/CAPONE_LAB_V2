import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {collectFarfetchMuleCandidate} from '../src/collector/farfetchMuleRefresh';
import {publishMarketplaceDelivery,loadMarketplaceDeliveries} from '../src/collector/marketplaceDelivery';
import {sourceRetryPause,recordSourceRetry} from '../src/collector/sourceRetry';
const ROOT=dirname(dirname(fileURLToPath(import.meta.url)));
const PROGRESS=join(ROOT,'logs/marketplace-progress');
async function main(){
 const pause=await sourceRetryPause(PROGRESS,'farfetch');if(pause)throw new Error(`SOURCE_ACCESS_PAUSED until ${pause.retryAt}`);
 const maxArg=process.argv.find(a=>a.startsWith('--max-products='));
 const concurrencyArg=process.argv.find(a=>a.startsWith('--concurrency='));
 let candidate;
 try {candidate=await collectFarfetchMuleCandidate({directory:join(PROGRESS,'farfetch-mule-products'),previousProducts:(await loadMarketplaceDeliveries(ROOT)).find(d=>d.sourceId==='farfetch')?.products,maxProducts:maxArg?Number(maxArg.split('=')[1]):2500,concurrency:concurrencyArg?Number(concurrencyArg.split('=')[1]):1});}
 catch(error){await recordSourceRetry(PROGRESS,'farfetch',[String(error)]);throw error;}
 await recordSourceRetry(PROGRESS,'farfetch',candidate.errors);
 console.log(JSON.stringify({progress:candidate.collectionProgress,errors:candidate.errors.slice(0,5)}));
 if(process.argv.includes('--collect-only'))return;
 const decision=await publishMarketplaceDelivery(ROOT,candidate,'https://www.farfetch.com');
 console.log(JSON.stringify(decision.report));if(!decision.report.accepted)throw new Error('Mule update rejected; previous archive preserved');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
