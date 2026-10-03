import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {collectExpansionNewMembership,mergeExpansionRefreshProducts} from '../src/onboarding/expansionNewness';
import {shopifyProductToPilot} from '../src/collector/shopify';
import {auditFootwearLeakage,evaluateQualityGate} from '../src/onboarding/validate';
const universe=JSON.parse(await readFile('data/registry/brand-universe.json','utf8'));
const ids=process.argv.slice(2);if(!ids.length)throw Error('Provide source IDs');
await mkdir('data/onboarding/validated',{recursive:true});
let cursor=0;
await Promise.all(Array.from({length:3},async()=>{while(cursor<ids.length){
 const id=ids[cursor++], brand=universe.brands.find((b:any)=>b.id===id);if(!brand)throw Error(id);
 try{
 const rows=new Map();let exhausted=false;const errors:string[]=[];
 for(let page=1;page<=20;page++){
  const response=await fetch(`${brand.officialUrl}/products.json?limit=250&page=${page}`,{signal:AbortSignal.timeout(30000)});
  if(!response.ok){errors.push(`HTTP ${response.status} page ${page}`);break;}
  const data=await response.json();if(!Array.isArray(data.products))throw Error('Missing products array');
  if(!data.products.length){exhausted=true;break;}
  let added=0;for(const row of data.products){if(!rows.has(row.id))added++;rows.set(row.id,row);}
  if(!added){errors.push('Pagination repeated');break;}
 }
 const config={id,brand:brand.brand,baseUrl:brand.officialUrl} as any;
 const mapped=[...rows.values()].filter(row=>!/(?:\bkids?\b|\bchildren\b|\btoddlers?\b|\bbaby\b|\bgirls?\b|\bboys?\b)/i.test([row.title,row.product_type,...(Array.isArray(row.tags)?row.tags:[row.tags??''])].join(' '))).map(row=>shopifyProductToPilot(row,config,new Date().toISOString())).filter(Boolean);
 const rejected=new Set(auditFootwearLeakage(mapped as any));
 let products=mapped.filter((p:any)=>!rejected.has(p.productUrl)&&p.imageUrl);
 let prior=[];try{prior=JSON.parse(await readFile(`data/onboarding/validated/expansion-${id}.json`,'utf8')).products??[];}catch(error:any){if(error.code!=='ENOENT')throw error;}
 const incoming=products;
 const newness=await collectExpansionNewMembership(brand.officialUrl,async url=>{
  const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
  let data=null;try{data=await response.json();}catch{}
  return {ok:response.ok,status:response.status,data};
 });
 errors.push(...newness.errors);
 products=mergeExpansionRefreshProducts(prior,incoming as any,newness.memberships);
 // Keep size/SKU rows: the general catalog merge groups variants by color.
 const variantRows=new Map<string,Map<string,any>>();
 for(const p of [...prior,...incoming] as any[]){
  const key=p.productUrl.replace(/\/$/,'').toLowerCase();
  const variants=variantRows.get(key)??new Map<string,any>();
  for(const v of p.variants??[]){const k=JSON.stringify([v.sku??'',v.title??'',v.color??'']);variants.set(k,{...variants.get(k),...v});}
  variantRows.set(key,variants);
 }
 products=products.map((p:any)=>({...p,variants:[...(variantRows.get(p.productUrl.replace(/\/$/,'').toLowerCase())?.values()??[])]}));
 const quality=evaluateQualityGate(products as any);
 if(!quality.ok)throw Error(quality.reasons.join(';'));
 const snapshot={source:id,generatedAt:new Date().toISOString(),status:'PARTIAL',products,coverage:{rawRecords:rows.size,freshProducts:incoming.length,paginationExhausted:exhausted,errors,excluded:rows.size-incoming.length,note:'All-source feed filtered to footwear. Official women footwear total not independently confirmed.'}};
 await writeFile(`data/onboarding/validated/expansion-${id}.json`,JSON.stringify(snapshot,null,2)+'\n');
 console.log(JSON.stringify({id,products:products.length,models:quality.families,raw:rows.size,exhausted,errors}));
 }catch(error){console.log(JSON.stringify({id,error:String(error)}));}
}}));
