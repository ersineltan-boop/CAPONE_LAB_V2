import {describe,it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {loadMarketplaceDeliveries, applyMarketplaceDeliveries, type MarketplaceDelivery} from '../marketplaceDelivery';
import type {ModelFamily} from '../../modelFamily/types';
function family(id:string, urls:string[]):ModelFamily {
 return {modelFamilyId:id,brand:'TEST',canonicalName:'Shoe',representativeProductId:urls[0],representativeImage:'img',representativeImages:['img'],allImages:['img'],sourceProductIds:urls,variantCount:urls.length,
 variants:urls.map(url=>({url,productId:url,images:['img']})),sourceSightings:urls.map(url=>({sourceId:url.includes('24s.com')?'24s':'test',sourceKind:url.includes('24s.com')?'LUXURY_MARKETPLACE':'BRAND_OFFICIAL'}))} as ModelFamily;
}
describe('supplemental marketplace delivery',()=>{
 it('replaces this marketplace while keeping official and other-source variants',()=>{
  const before=family('shared',['https://brand.test/shoe','https://www.24s.com/old']);
  const incoming=family('shared',['https://www.24s.com/new']);
  const d={sourceId:'24s',origin:'https://www.24s.com',families:[incoming]} as MarketplaceDelivery;
  const result=applyMarketplaceDeliveries([before,family('other',['https://else.test/shoe'])],[d]);
  expect(result).toHaveLength(2);expect(result[0].variants.map(v=>v.url)).toEqual(['https://brand.test/shoe','https://www.24s.com/new']);
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
