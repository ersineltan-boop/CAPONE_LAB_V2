import {describe,expect,it} from 'vitest';
import {evaluateMarketplaceCandidate,replaceVerifiedMarketplaceCatalog,type MarketplaceRefreshCandidate} from '../automation';
import type {PilotProduct} from '../../collector/types';
import {marketplaceCoverageText} from '../../presentation/marketplaceCoverage';
const category='https://www.farfetch.com/uk/shopping/women/espadrilles-1/items.aspx';
function product(id:number) {return {source:'farfetch',brand:'Aeyde',productName:`Leather mule ${id}`,
 productUrl:`https://www.farfetch.com/uk/shopping/women/leather-mule-item-${id}.aspx`,imageUrl:`https://images.test/${id}.jpg`,images:[`https://images.test/${id}.jpg`],category:'MULE',sourceCategoryUrl:category,
 discoveredAt:'2026-01-01T00:00:00Z',isNewArrivalsCollection:false,hasNewBadge:false,variants:[],
 color:null,material:null,toeShape:null,heelType:null,heelHeight:null,details:null} as PilotProduct;}
function candidate():MarketplaceRefreshCandidate {
 const rows=[product(1),product(2)];
 return {sourceId:'farfetch',publicationMode:'verified-categories',products:rows,coverageStatus:'PARTIAL',sourceTotal:100,
  rawCollected:2,eligibleTotal:2,paginationExhausted:false,errors:['boots: temporary timeout'],
  verifiedScopes:[{url:category,sourceTotal:2,rawCollected:2,productUrls:rows.map(p=>p.productUrl),checkedAt:new Date().toISOString(),coverageStatus:'FULL',paginationExhausted:true}]};
}
describe('verified category publication',()=>{
 it('allows only matched individual product proofs, always with PARTIAL coverage and archive preservation',()=>{
  const refresh=candidate();refresh.publicationMode='verified-products';refresh.verifiedScopes=undefined;
  const mule=category.replace('espadrilles','mules');
  const checkedAt=new Date().toISOString();
  refresh.products=refresh.products.map(p=>({...p,sourceCategoryUrl:mule,sourceVerifiedAt:checkedAt}));
  refresh.verifiedProducts=refresh.products.map((p,i)=>({url:p.productUrl,productId:String(i+1),listingUrl:mule,checkedAt,documentSha256:'a'.repeat(64)}));
  const decision=evaluateMarketplaceCandidate({candidate:refresh,previousLastGood:[],preserveMissing:true});
  expect(decision.report.accepted).toBe(true);expect(decision.report.publicationCoverage).toBe('PARTIAL');expect(decision.report.verifiedProductCount).toBe(2);
  refresh.verifiedProducts[0].productId='999';
  expect(evaluateMarketplaceCandidate({candidate:refresh,previousLastGood:[],preserveMissing:true}).report.accepted).toBe(false);
 });
 it('rejects stale, future, missing and duplicate individual product proofs',()=>{
  const checkedAt=new Date().toISOString(),mule=category.replace('espadrilles','mules');
  const base=candidate();base.publicationMode='verified-products';base.verifiedScopes=undefined;
  base.products=base.products.map(p=>({...p,sourceCategoryUrl:mule,sourceVerifiedAt:checkedAt}));
  base.verifiedProducts=base.products.map((p,i)=>({url:p.productUrl,productId:String(i+1),listingUrl:mule,checkedAt,documentSha256:'a'.repeat(64)}));
  for(const mutate of [
   (c:MarketplaceRefreshCandidate)=>{c.verifiedProducts![0].checkedAt=new Date(Date.now()-25*3600_000).toISOString();},
   (c:MarketplaceRefreshCandidate)=>{c.verifiedProducts![0].checkedAt=new Date(Date.now()+3600_000).toISOString();},
   (c:MarketplaceRefreshCandidate)=>{c.verifiedProducts!.pop();},
   (c:MarketplaceRefreshCandidate)=>{c.verifiedProducts![1]=c.verifiedProducts![0];},
   (c:MarketplaceRefreshCandidate)=>{c.errors=['Farfetch access blocked (HTTP 200)'];},
  ]) {const refresh=structuredClone(base);mutate(refresh);expect(evaluateMarketplaceCandidate({candidate:refresh,previousLastGood:[],preserveMissing:true}).report.accepted).toBe(false);}
 });
 it('appends a small complete category while retaining every old product/gallery and PARTIAL coverage',()=>{
  const prior=Array.from({length:10},(_,index)=>product(index+1));prior[0].images!.push('https://images.test/old-gallery.jpg');
  const decision=evaluateMarketplaceCandidate({candidate:candidate(),previousLastGood:prior,preserveMissing:true});
  expect(decision.report.accepted).toBe(true);expect(decision.report.publicationCoverage).toBe('PARTIAL');
  expect(decision.report.refreshedCategories?.[0].products).toBe(2);
  const merged=replaceVerifiedMarketplaceCatalog({existing:prior,sourceId:'farfetch',verified:decision.eligibleProducts,preserveMissing:true});
  expect(merged).toHaveLength(10);expect(merged[0].images).toContain('https://images.test/old-gallery.jpg');
  expect(merged.slice(2)).toEqual(prior.slice(2));
 });
 it('requires archive preservation and independently complete fresh scope evidence',()=>{
  const variants:MarketplaceRefreshCandidate[]=[];
  const missing=candidate();missing.verifiedScopes=[];variants.push(missing);
  const stale=candidate();stale.verifiedScopes![0].checkedAt=new Date(Date.now()-61*60_000).toISOString();variants.push(stale);
  for(const epochStartedAt of [new Date(Date.now()-61*60_000).toISOString(),new Date(Date.now()+60_000).toISOString(),'invalid']) {
   const oldEpoch=candidate();oldEpoch.verifiedScopes![0].epochStartedAt=epochStartedAt;variants.push(oldEpoch);
  }
  const interrupted=candidate();interrupted.verifiedScopes![0].paginationExhausted=false as never;variants.push(interrupted);
  const wrongTotal=candidate();wrongTotal.verifiedScopes![0].sourceTotal=3;variants.push(wrongTotal);
  const unmatched=candidate();unmatched.products[0].sourceCategoryUrl=category.replace('espadrilles','boots');variants.push(unmatched);
  const extra=candidate();extra.products.push(product(3));variants.push(extra);
  const full=candidate();full.coverageStatus='FULL';variants.push(full);
  for(const refresh of variants)expect(evaluateMarketplaceCandidate({candidate:refresh,previousLastGood:[],preserveMissing:true}).report.accepted).toBe(false);
  expect(evaluateMarketplaceCandidate({candidate:candidate(),previousLastGood:[]}).report.accepted).toBe(false);
 });
 it('does not enable category mode on another source or after access denial',()=>{
  for(const errors of [['HTTP 403 access denied'],['HTTP 429 rate limit']]) {
   const refresh=candidate();refresh.errors=errors;
   expect(evaluateMarketplaceCandidate({candidate:refresh,previousLastGood:[],preserveMissing:true}).report.accepted).toBe(false);
  }
  const refresh=candidate();refresh.sourceId='24s';refresh.products=refresh.products.map(p=>({...p,source:'24s'}));
  expect(evaluateMarketplaceCandidate({candidate:refresh,previousLastGood:[],preserveMissing:true}).report.accepted).toBe(false);
 });
 it('quarantines missing quality without inventing a category or a new-arrival claim',()=>{
  const refresh=candidate();refresh.products[1].category=null;
  const decision=evaluateMarketplaceCandidate({candidate:refresh,previousLastGood:[],preserveMissing:true});
  expect(decision.report.accepted).toBe(true);expect(decision.quarantined).toHaveLength(1);expect(decision.eligibleProducts).toHaveLength(1);
  expect(decision.eligibleProducts[0].hasNewBadge).toBe(false);
  refresh.newnessVerified=true;
  expect(evaluateMarketplaceCandidate({candidate:refresh,previousLastGood:[],preserveMissing:true}).report.accepted).toBe(false);
 });
 it('describes category refresh without claiming the whole catalog is ready',()=>{
  const text=marketplaceCoverageText({status:'PARTIAL',ready:100,pending:0,refreshedCategories:[{url:category,products:2,checkedAt:new Date().toISOString()}]});
  expect(text).toContain('Kısmen güncellendi');expect(text).toContain('Espadril');expect(text).toContain('Önceki kayıtlar korunuyor');
  expect(text).not.toContain('0 ürün incelemede');
 });
});
