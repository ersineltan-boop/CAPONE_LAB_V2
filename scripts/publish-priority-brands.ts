import {readFile,writeFile} from 'node:fs/promises';
import {analyzeProducts} from '../src/analysis/analyzeProduct';
import {buildModelFamilies} from '../src/modelFamily/buildFamilies';
import {mergeCoreFamilyIntoBrandShard} from '../src/modelFamily/dataset';
import {auditFootwearLeakage,evaluateQualityGate} from '../src/onboarding/validate';
import {buildBrandRegistryFromUniverseData} from '../src/registry/build/buildBrandRegistry';
import {emptyProbeCache} from '../src/registry/build/probeCache';
import {BRANDS_TS_PATH,UNIVERSE_PATH,UNIVERSE_REPORT_PATH} from '../src/onboarding/policy';
const read = async (p:string)=>JSON.parse(await readFile(p,'utf8'));
const write = async(p:string,x:unknown)=>writeFile(p,JSON.stringify(x,null,2)+'\n');
const universe=await read(UNIVERSE_PATH);
const manifestPath='data/multibrand/model-families/manifest.json';
const manifest=await read(manifestPath);
const coverage:Record<string,unknown>=await read('data/registry/priority-brand-coverage.json').catch((error)=>{if(error.code==='ENOENT')return {};throw error;});
const requested=process.argv.slice(2);
if(requested.some(id=>!universe.brands.some((b:any)=>b.id===id)))throw new Error('Unknown brand');
const priorityFiles:Record<string,string>={'massimo-dutti':'massimo-dutti','ala-a':'luxury-ala-a','maison-margiela':'luxury-maison-margiela'};
const targets=requested.length?requested.map(id=>[id,priorityFiles[id]??`expansion-${id}`]):Object.entries(priorityFiles);
for(const [id,file] of targets){
 const snapshot=await read(`data/onboarding/validated/${file}.json`);
 const rejected=new Set(auditFootwearLeakage(snapshot.products));
 const products=snapshot.products.filter((p:any)=>!rejected.has(p.productUrl)&&p.imageUrl).map((p:any)=>({...p,isNewArrivalsCollection:false,hasNewBadge:false}));
 const quality=evaluateQualityGate(products);
 if(!quality.ok)throw new Error(`${id}: ${quality.reasons.join('; ')}`);
 const relative=`brands/${id}.json`, path=`data/multibrand/model-families/${relative}`;
 let prior=[];try{prior=await read(path);}catch(e:any){if(e.code!=='ENOENT')throw e;}
 const {families}=buildModelFamilies(analyzeProducts(products as never) as never,{priorFamilies:prior});
 const byId=new Map(prior.map((f:any)=>[f.modelFamilyId,f]));
 for(const family of families){const old=byId.get(family.modelFamilyId);byId.set(family.modelFamilyId,old?mergeCoreFamilyIntoBrandShard(old as never,family):family);}
 const delivered=[...byId.values()];
 if(!delivered.length)throw new Error(`${id}: empty delivery`);
 const body=JSON.stringify(delivered);await writeFile(path,body);
 manifest.shards=manifest.shards.filter((s:any)=>s.file!==relative);
 manifest.shards.push({file:relative,familyCount:delivered.length,bytes:Buffer.byteLength(body)});
 const entry=universe.brands.find((b:any)=>b.id===id);if(!entry)throw new Error(`Missing brand ${id}`);
 entry.isActive=true;entry.collectorType='CUSTOM_ADAPTER';entry.collectionStatus='NEEDS_PROBE';
 entry.notes=`Verified PARTIAL official catalog: ${products.length} products. Dedicated priority-source collector; full coverage not confirmed.`;
 coverage[id]={status:'PARTIAL',ready:products.length,pending:Math.max(0,(snapshot.sourceReportedProductCount??products.length)-products.length),totalKnown:typeof snapshot.sourceReportedProductCount==='number',quarantined:rejected.size,updatedAt:new Date().toISOString()};
 console.log(id,products.length,'products',delivered.length,'models',rejected.size,'quarantined');
}
manifest.shardCount=manifest.shards.length;manifest.totalFamilies=manifest.shards.reduce((n:number,s:any)=>n+s.familyCount,0);manifest.generatedAt=new Date().toISOString();
const built=buildBrandRegistryFromUniverseData({universeFile:universe,probeCache:emptyProbeCache()});
if(!built.ok||!built.brandsTsContent)throw new Error('Registry build failed');
await write(manifestPath,manifest);await write(UNIVERSE_PATH,universe);await writeFile(BRANDS_TS_PATH,built.brandsTsContent);await write(UNIVERSE_REPORT_PATH,built.report);
await write('data/registry/priority-brand-coverage.json',coverage);
