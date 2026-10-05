import {describe,it,expect} from 'vitest';
import {classifyOfficialFootwear} from '../primaryCategory';
import {classifyWomensFootwear} from '../footwearScope';
import {reclassifyWaveFamily} from '../deliveryLink';
import type {ModelFamily} from '../../../modelFamily/types';
describe('refresh source category evidence',()=>{
 it.each([
 ['Derbies cuir velours brandy','','OXFORD_DERBY'],
 ['Stockholm','Environmentally friendly sneaker handcrafted in soft leather','SNEAKER'],
 ['Soft Runner','Inspired by vintage running sneakers','SNEAKER'],
 ['Soft runners','Inspired by vintage running shoes','SNEAKER'],
 ['Jane','La nouvelle basket Jane','SNEAKER'],
 ['Cintre','Unstructured monk shoe with buckle fastening','LOAFER'],
 ['Fireside House Shoe','','LOAFER'],
 ])('classifies %s from explicit source text',(title,description,expected)=>{
 expect(classifyOfficialFootwear({title,description,productType:'Shoes'})).toBe(expected);
 });
 it('reads structured source tags and keeps unknown silhouettes unresolved',()=>{
 expect(classifyOfficialFootwear({title:'Cintre',tags:'type_loafer, WOMEN'})).toBe('LOAFER');
 expect(classifyOfficialFootwear({title:'Freya XX',description:'Minimalist lines and everyday luxury',productType:'Shoes'})).toBeNull();
 });
 it.each([
 {title:'Lusco',productType:'Shoes',tags:['men','Classic']},
 {title:'Comfort Cushion Pads',productType:'Foot Care',tags:['SHOES / VIEW ALL']},
 {title:'Evangeline Mini',productType:'Footwear',handle:'evangeline-infant-white'},
 ])('excludes non-womens-footwear despite mixed official collection',p=>{
 expect(classifyWomensFootwear({...p,fromVerifiedFootwearCollection:true}).decision).toBe('excluded');
 });
 it('keeps a product explicitly tagged for women and men',()=>{
 expect(classifyWomensFootwear({title:'Leather sneaker',productType:'Sneakers',tags:['men','women']}).decision).toBe('footwear');
 });
 it('uses full official product title when canonical model name lost the silhouette',()=>{
 const family={canonicalName:'Azur',category:'OTHER_FOOTWEAR',primaryCategory:'UNCLASSIFIED',variants:[{title:'Azur'}]} as ModelFamily;
 expect(reclassifyWaveFamily(family,{title:'Azur - Derbies cuir',description:'',productType:'Chaussures'}).primaryCategory).toBe('OXFORD_DERBY');
 });
});

import {reviewedOfficialCategory,REVIEWED_OFFICIAL_CATEGORIES} from '../../automation/reviewedCategories';
import {approvedFootwearRoot,planWomensCollections} from '../collections';
import {isWomensFootwearCollection} from '../../../collector/shopifyCollectionFilter';

describe('verified refresh scope and reviewed exceptions',()=>{
 it('recognizes the Spanish footwear root',()=>{
  expect(isWomensFootwearCollection('zapatos','ZAPATOS')).toBe(true);
  expect(classifyOfficialFootwear({description:'Botín de piel'})).toBe('BOOT');
  expect(classifyOfficialFootwear({description:'Alpargata de algodón'})).toBe('ESPADRILLE');
 });
 it('preserves the approved root and includes its footwear sale collection',()=>{
  expect(planWomensCollections([
   {handle:'footwear',title:'Footwear',productsCount:34},
   {handle:'sale-footwear',title:'Sale Footwear',productsCount:88},
   {handle:'sale-ready-to-wear',title:'Sale Ready to Wear',productsCount:199},
  ],{womenCollectionPath:'/collections/footwear'}).catalogPaths).toEqual(['/collections/footwear','/collections/sale-footwear']);
 });
 it('restores the complete scope on the next refresh after publishing root plus sale',()=>{
  const previousPaths=['/collections/footwear','/collections/sale-footwear'];
  const root=approvedFootwearRoot(previousPaths);
  expect(root).toBe('/collections/footwear');
  expect(planWomensCollections([
   {handle:'footwear',title:'Footwear',productsCount:34},
   {handle:'sale-footwear',title:'Sale Footwear',productsCount:88},
  ],{womenCollectionPath:root}).catalogPaths).toEqual(previousPaths);
  expect(approvedFootwearRoot([...previousPaths].reverse())).toBe(root);
  expect(approvedFootwearRoot(['/collections/shoes'])).toBe('/collections/shoes');
  expect(approvedFootwearRoot(['/collections/footwear','/collections/womens-boots'])).toBeUndefined();
  expect(approvedFootwearRoot(['/collections/all'])).toBeUndefined();
 });
 it('limits a visual review to the exact official URL and reviewed image',()=>{
  const review=REVIEWED_OFFICIAL_CATEGORIES[0]!;
  const family={variants:[{url:review.productUrl,images:['https://cdn.shopify.com'+review.imagePath+'?v=1']}]} as ModelFamily;
  expect(reviewedOfficialCategory(family)).toBe('SANDAL');
  expect(reviewedOfficialCategory({...family,variants:[{...family.variants[0]!,url:'https://manuatelier.com/products/freya-new-model'}]})).toBeNull();
  expect(reviewedOfficialCategory({...family,variants:[{...family.variants[0]!,images:['https://cdn.shopify.com/unreviewed.jpg']}]})).toBeNull();
 });
});

import {detectNewBadgeInText} from '../../../newArrivals/detectNewness';
it('accepts the standalone official Novedades label without promoting descriptive text',()=>{
 expect(detectNewBadgeInText('NOVEDADES')).toBe(true);
 expect(detectNewBadgeInText('Descubre nuestras novedades de temporada')).toBe(false);
});
