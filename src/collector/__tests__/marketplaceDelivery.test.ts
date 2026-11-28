import {describe,it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {loadMarketplaceDeliveries, applyMarketplaceDeliveries, writeMarketplaceDelivery, readMarketplaceDelivery, archiveMarketplaceQuarantine, publishMarketplaceDelivery, type MarketplaceDelivery} from '../marketplaceDelivery';
import {analyzeProducts} from '../../analysis/analyzeProduct';
import {buildModelFamilies} from '../../modelFamily/buildFamilies';
import {isVerifiedNew} from '../../newArrivals/newness';
import type {MarketplaceRefreshCandidate} from '../../marketplaces/automation';
import type {PilotProduct} from '../types';
import type {ModelFamily} from '../../modelFamily/types';
function family(id:string, urls:string[]):ModelFamily {
 return {modelFamilyId:id,brand:'TEST',canonicalName:'Shoe',representativeProductId:urls[0],representativeImage:'img',representativeImages:['img'],allImages:['img'],sourceProductIds:urls,variantCount:urls.length,
 variants:urls.map(url=>({url,productId:url,images:['img']})),sourceSightings:urls.map(url=>({sourceId:url.includes('24s.com')?'24s':'test',sourceKind:url.includes('24s.com')?'LUXURY_MARKETPLACE':'BRAND_OFFICIAL'}))} as ModelFamily;
}
describe('supplemental marketplace delivery',()=>{
 it('promotes an individually verified pending product while preserving its raw gallery and quarantine history',async()=>{
  const root=await mkdtemp(join(tmpdir(),'product-delivery-'));
  try {
   const listing='https://www.farfetch.com/uk/shopping/women/mules-1/items.aspx',checkedAt=new Date().toISOString();
   const row={source:'farfetch',brand:'Aeyde',productName:'Leather mule',productUrl:'https://www.farfetch.com/uk/shopping/women/leather-mule-item-11.aspx',category:'MULE',
    imageUrl:'https://img.test/new.jpg',images:['https://img.test/new.jpg'],sourceCategoryUrl:listing,sourceVerifiedAt:checkedAt,discoveredAt:checkedAt,
    hasNewBadge:false,isNewArrivalsCollection:false,variants:[],color:null,material:null,toeShape:null,heelType:null,heelHeight:null,details:null} as PilotProduct;
   const pending={product:{...row,category:null,images:['https://img.test/raw-old.jpg'],imageUrl:'https://img.test/raw-old.jpg'},reasons:['unresolved category']};
   await mkdir(join(root,'data/multibrand'),{recursive:true});await writeFile(join(root,'data/multibrand/products.json'),'[]');
   await writeMarketplaceDelivery(root,{sourceId:'farfetch',origin:'https://www.farfetch.com',updatedAt:'2026-01-01',products:[],families:[],report:{} as never,quarantined:[pending]});
   const decision=await publishMarketplaceDelivery(root,{sourceId:'farfetch',products:[row],publicationMode:'verified-products',coverageStatus:'PARTIAL',sourceTotal:100,
    rawCollected:1,eligibleTotal:1,paginationExhausted:false,errors:[],verifiedProducts:[{url:row.productUrl,productId:'11',listingUrl:listing,checkedAt,documentSha256:'a'.repeat(64)}]},'https://www.farfetch.com');
   expect(decision.report.accepted).toBe(true);
   const stored=(await loadMarketplaceDeliveries(root))[0];
   expect(stored.products[0].images).toEqual(expect.arrayContaining(['https://img.test/raw-old.jpg','https://img.test/new.jpg']));
   expect(stored.quarantined).toEqual([]);expect(stored.quarantineArchive).toContainEqual(pending);expect(stored.report.verifiedProductCount).toBe(1);
  }finally{await rm(root,{recursive:true,force:true});}
 });
 it('publishes a verified category without changing untouched records, IDs, galleries or other-category quarantine',async()=>{
  const root=await mkdtemp(join(tmpdir(),'scoped-delivery-'));
  try {
   const url='https://www.farfetch.com/uk/shopping/women/espadrilles-1/items.aspx';
   const other='https://www.farfetch.com/uk/shopping/women/boots-1/items.aspx';
   const row=(id:number,scope=url)=>({source:'farfetch',brand:'Aeyde',productName:`Leather mule ${id}`,
    productUrl:`https://www.farfetch.com/uk/shopping/women/leather-mule-item-${id}.aspx`,category:'MULE',imageUrl:`https://img.test/${id}.jpg`,images:[`https://img.test/${id}.jpg`],
    sourceCategoryUrl:scope,discoveredAt:'2026-01-01T00:00:00Z',hasNewBadge:true,isNewArrivalsCollection:false,variants:[],color:null,material:null,toeShape:null,heelType:null,heelHeight:null,details:null} as PilotProduct);
   const before=[row(1),row(2,other)];before[0].images.push('https://img.test/old-gallery.jpg');
   const families=buildModelFamilies(analyzeProducts(before as never) as never).families;
   const pending={product:{...row(3,other),category:null},reasons:['unresolved category']};
   await mkdir(join(root,'data/multibrand'),{recursive:true});await writeFile(join(root,'data/multibrand/products.json'),JSON.stringify(before));
   await writeMarketplaceDelivery(root,{sourceId:'farfetch',origin:'https://www.farfetch.com',updatedAt:'2026-01-01',products:before,families,report:{} as never,quarantined:[pending]});
   const incoming={...row(1),hasNewBadge:false,images:['https://img.test/new-gallery.jpg'],imageUrl:'https://img.test/new-gallery.jpg'};
   const decision=await publishMarketplaceDelivery(root,{sourceId:'farfetch',products:[incoming],publicationMode:'verified-categories',coverageStatus:'PARTIAL',sourceTotal:100,
    rawCollected:1,eligibleTotal:1,paginationExhausted:false,errors:[],verifiedScopes:[{url,sourceTotal:1,rawCollected:1,productUrls:[incoming.productUrl],checkedAt:new Date().toISOString(),coverageStatus:'FULL',paginationExhausted:true}]},'https://www.farfetch.com');
   expect(decision.report.accepted).toBe(true);expect(decision.report.publicationCoverage).toBe('PARTIAL');
   const stored=(await loadMarketplaceDeliveries(root))[0];
   expect(stored.products.find(p=>p.productUrl===before[1].productUrl)).toEqual(before[1]);
   const refreshed=stored.products.find(p=>p.productUrl===incoming.productUrl)!;
   expect(refreshed.images).toEqual(expect.arrayContaining([...before[0].images,...incoming.images]));expect(refreshed.hasNewBadge).toBe(true);
   expect(stored.quarantined).toContainEqual(pending);expect(stored.report.quarantinedProducts).toBe(1);
   expect(stored.families.map(f=>f.modelFamilyId)).toEqual(expect.arrayContaining(families.map(f=>f.modelFamilyId)));
  } finally {await rm(root,{recursive:true,force:true});}
 });
 it('keeps the Webster archive intact when an exhaustive scan has unresolved products', async () => {
  const root = await mkdtemp(join(tmpdir(), 'webster-subset-'));
  try {
   const origin = 'https://thewebster.com';
   const observedAt = new Date().toISOString();
   const row = (slug: string, brand: string, image: string): PilotProduct => ({
    source: 'the-webster',
    brand,
    productName: `Leather ${slug} mule`,
    productUrl: `${origin}/products/${slug}`,
    imageUrl: image,
    images: [image],
    category: 'MULE',
    color: null,
    material: null,
    toeShape: null,
    heelType: null,
    heelHeight: null,
    details: null,
    discoveredAt: observedAt,
    hasNewBadge: false,
    isNewArrivalsCollection: false,
    variants: [],
   });
   const old = {
    ...row('known-style', 'Aeyde', 'https://cdn.example.com/known-old.jpg'),
    discoveredAt: new Date(Date.now() - 60 * 60_000).toISOString(),
    hasNewBadge: true,
   };
   const archived = {
    ...row('archive-only', 'Lemaire', 'https://cdn.example.com/archived.jpg'),
    hasNewBadge: true,
   };
   const previousProducts = [old, archived];
   const previousFamilies = buildModelFamilies(analyzeProducts(previousProducts as never) as never).families;
   const observed = row('known-style', 'Aeyde', 'https://cdn.example.com/known-updated.jpg');
   const newcomer = row('fresh-style', 'Khaite', 'https://cdn.example.com/fresh.jpg');
   const unresolved = { ...row('unresolved-style', 'Toteme', 'https://cdn.example.com/unresolved.jpg'), category: null };
   const candidate: MarketplaceRefreshCandidate = {
    sourceId: 'the-webster',
    products: [observed, newcomer, unresolved],
    publicationMode: 'the-webster-verified-subset',
    coverageStatus: 'PARTIAL',
    sourceTotal: 4,
    rawCollected: 4,
    eligibleTotal: 4,
    unmappedProductUrls: [`${origin}/products/unmapped-style`],
    paginationExhausted: true,
    errors: [],
    newnessVerified: false,
   };
   await mkdir(join(root, 'data/multibrand'), { recursive: true });
   await writeFile(join(root, 'data/multibrand/products.json'), JSON.stringify(previousProducts));
   await writeMarketplaceDelivery(root, {
    sourceId: 'the-webster', origin, updatedAt: observedAt, products: previousProducts,
    families: previousFamilies, report: {} as never, quarantined: [],
   });
   const archivePath = join(root, 'data/multibrand/model-families/marketplaces/the-webster.json');
   const before = await readFile(archivePath, 'utf8');
   for (const invalid of [
    { ...candidate, sourceTotal: 5, eligibleTotal: 5 },
    { ...candidate, errors: ['The Webster listing returned HTTP 403'] },
    { ...candidate, products: [observed, { ...newcomer, hasNewBadge: true }, unresolved] },
    { ...candidate, products: [observed, { ...newcomer, sourceCategoryPath: '/collections/new-in' }, unresolved] },
   ]) {
    const rejected = await publishMarketplaceDelivery(root, invalid, origin);
    expect(rejected.report.accepted).toBe(false);
    expect(await readFile(archivePath, 'utf8')).toBe(before);
   }

   const decision = await publishMarketplaceDelivery(root, candidate, origin);
   expect(decision.report).toMatchObject({ accepted: true, publicationCoverage: 'PARTIAL', lastGoodPreserved: true });
   expect(decision.quarantined.map((entry) => entry.product.productUrl)).toContain(unresolved.productUrl);
   const stored = (await loadMarketplaceDeliveries(root))[0];
   const byUrl = new Map(stored.products.map((product) => [product.productUrl, product]));
   expect(byUrl.get(archived.productUrl)).toEqual(archived);
   expect(byUrl.get(old.productUrl)?.images).toEqual(expect.arrayContaining([old.imageUrl, observed.imageUrl]));
   expect(byUrl.get(unresolved.productUrl)).toBeUndefined();
   expect(byUrl.get(newcomer.productUrl)).toMatchObject({ hasNewBadge: false, isNewArrivalsCollection: false });
   const storedIds = stored.families.map((family) => family.modelFamilyId);
   expect(storedIds).toEqual(expect.arrayContaining(previousFamilies.map((family) => family.modelFamilyId)));
   const previousObservedFamily = previousFamilies.find((family) =>
    family.variants.some((variant) => variant.url === old.productUrl),
   );
   const previousNewness = previousObservedFamily?.sourceSightings?.find((sighting) => sighting.sourceId === 'the-webster')?.newness;
   expect(isVerifiedNew(previousNewness)).toBe(true);
   const refreshedFamily = stored.families.find((family) => family.modelFamilyId === previousObservedFamily?.modelFamilyId);
   expect(refreshedFamily?.sourceSightings?.find((sighting) => sighting.sourceId === 'the-webster')?.newness).toEqual(previousNewness);
   const newFamily = stored.families.find((family) => family.variants.some((variant) => variant.url === newcomer.productUrl));
   expect(newFamily).toBeDefined();
   expect(newFamily?.sourceSightings?.some((sighting) => isVerifiedNew(sighting.newness))).toBe(false);
  } finally {
   await rm(root, { recursive: true, force: true });
  }
 });
 it('retains withdrawn quarantine evidence and old gallery images separately from current pending rows',()=>{
  const oldImage = 'https://cdn.example.com/old.jpg', newImage = 'https://cdn.example.com/new.jpg';
  const product = {source:'24s',brand:'TEST',productName:'Shoe',productUrl:'https://www.24s.com/withdrawn',imageUrl:oldImage,images:[oldImage]} as PilotProduct;
  const previous = {quarantineArchive:[{product,reasons:['missing taxonomy']}],quarantined:[{product:{...product,imageUrl:newImage,images:[newImage]},reasons:['unresolved category']}]};
  const archive = archiveMarketplaceQuarantine(previous);
  expect(archive).toHaveLength(1);
  expect(archive[0].product.images).toEqual(expect.arrayContaining([oldImage,newImage]));
  expect(archiveMarketplaceQuarantine({quarantined:[],quarantineArchive:archive})).toEqual(archive);
  expect(previous.quarantined).toHaveLength(1);
 });
 it('round-trips a large archive through bounded parts and rejects damaged parts',async()=>{
  const root=await mkdtemp(join(tmpdir(),'delivery-parts-'));
  try {
   const first=family('first',['https://www.24s.com/old']),second=family('second',['https://www.24s.com/current']);
   first.canonicalName='A'.repeat(3*1024*1024);second.canonicalName='B'.repeat(3*1024*1024);
   const delivery={sourceId:'24s',origin:'https://www.24s.com',updatedAt:'2026-10-05',products:[],families:[first,second],report:{},quarantined:[]} as MarketplaceDelivery;
   await writeMarketplaceDelivery(root,delivery);
   const path=join(root,'data/multibrand/model-families/marketplaces/24s.json');
   const manifest=JSON.parse(await readFile(path,'utf8'));
   expect(manifest.schema).toBe('capone.marketplace-delivery.parts.v1');
   expect(await readMarketplaceDelivery(path)).toEqual(delivery);
   await writeFile(join(path,'..',manifest.parts[0].file),'[]');
   await expect(readMarketplaceDelivery(path)).rejects.toThrow('checksum');
  } finally {await rm(root,{recursive:true,force:true});}
 });
 it('refreshes this marketplace while archiving old URLs and keeping other-source variants',()=>{
  const before=family('shared',['https://brand.test/shoe','https://www.24s.com/old']);
  const incoming=family('shared',['https://www.24s.com/new']);
  const d={sourceId:'24s',origin:'https://www.24s.com',families:[incoming]} as MarketplaceDelivery;
  const result=applyMarketplaceDeliveries([before,family('other',['https://else.test/shoe'])],[d]);
  expect(result).toHaveLength(2);expect(result[0].variants.map(v=>v.url)).toEqual(['https://www.24s.com/new','https://brand.test/shoe','https://www.24s.com/old']);
  expect(applyMarketplaceDeliveries(result,[d])).toEqual(result);
 });
 it('fails visibly on a corrupt stored delivery instead of silently hiding it',async()=>{
  const root=await mkdtemp(join(tmpdir(),'delivery-'));
  try {
   expect(await loadMarketplaceDeliveries(root)).toEqual([]);
   const dir=join(root,'data/multibrand/model-families/marketplaces');await mkdir(dir,{recursive:true});await writeFile(join(dir,'24s.json'),'bad json');
   await expect(loadMarketplaceDeliveries(root)).rejects.toThrow();
  } finally {await rm(root,{recursive:true,force:true});}
 });
});
