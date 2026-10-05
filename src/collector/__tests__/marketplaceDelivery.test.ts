import {describe,it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {loadMarketplaceDeliveries, applyMarketplaceDeliveries, writeMarketplaceDelivery, readMarketplaceDelivery, type MarketplaceDelivery} from '../marketplaceDelivery';
import type {ModelFamily} from '../../modelFamily/types';
function family(id:string, urls:string[]):ModelFamily {
 return {modelFamilyId:id,brand:'TEST',canonicalName:'Shoe',representativeProductId:urls[0],representativeImage:'img',representativeImages:['img'],allImages:['img'],sourceProductIds:urls,variantCount:urls.length,
 variants:urls.map(url=>({url,productId:url,images:['img']})),sourceSightings:urls.map(url=>({sourceId:url.includes('24s.com')?'24s':'test',sourceKind:url.includes('24s.com')?'LUXURY_MARKETPLACE':'BRAND_OFFICIAL'}))} as ModelFamily;
}
describe('supplemental marketplace delivery',()=>{
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
