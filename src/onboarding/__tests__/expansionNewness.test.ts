import {describe, it, expect} from 'vitest';
import {collectExpansionNewMembership, mergeExpansionRefreshProducts} from '../expansionNewness';
import type {PilotProduct} from '../../collector/types';
const product = (handle: string): PilotProduct => ({source:'tkees',brand:'TKEES',productName:'Leather sandal',productUrl:`https://brand.test/products/${handle}`,
 imageUrl:'https://brand.test/old.jpg',images:['https://brand.test/old.jpg'],category:'SANDAL',color:null,material:null,toeShape:null,heelType:null,heelHeight:null,details:null,discoveredAt:'2026-01-01',variants:[]});
describe('expansion current source NEW',()=>{
 it('reads discovered New In collections, follows pagination, and excludes mens collections',async()=>{
  const calls:string[]=[];
  const result=await collectExpansionNewMembership('https://brand.test',async url=>{
   calls.push(url);
   return {ok:true,status:200,data:url.includes('/collections.json')?{collections:[{handle:'new-in',title:'New In'},{handle:'mens-new-arrivals',title:'Mens New Arrivals'}]}:
    {products:url.includes('page=1')?[{handle:'fresh'}]:[]}};
  });
  expect(result.errors).toEqual([]);
  expect(result.memberships.get('https://brand.test/products/fresh')).toMatchObject({path:'/collections/new-in'});
  expect(calls).toHaveLength(3);
  expect(calls.some(url=>url.includes('mens-new-arrivals/products'))).toBe(false);
 });
 it('reports failed membership pagination so refresh preserves last-good',async()=>{
  const result=await collectExpansionNewMembership('https://brand.test',async url=>url.includes('/collections.json')?
   {ok:true,status:200,data:{collections:[{handle:'new-in',title:'New In'}]}}:{ok:false,status:403,data:null});
  expect(result.errors[0]).toContain('403');
 });
 it('keeps archived products and galleries while removing former NEW evidence',()=>{
  const previous=[{...product('current'),isNewArrivalsCollection:true,collectionPath:'/collections/new-in'},
   {...product('archived'),isNewArrivalsCollection:true,hasNewBadge:true,sourceCategories:[{categoryId:'new',categoryName:'New In',categoryPath:'/collections/new-in'}]}];
  const merged=mergeExpansionRefreshProducts(previous,[{...product('current'),images:['https://brand.test/fresh.jpg'],hasNewBadge:false}],new Map());
  expect(merged).toHaveLength(2);
  expect(merged[0].images).toEqual(expect.arrayContaining(['https://brand.test/old.jpg','https://brand.test/fresh.jpg']));
  expect(merged.every(p=>!p.isNewArrivalsCollection&&!p.hasNewBadge)).toBe(true);
  expect(merged[0].collectionPath).toBeNull();
  expect(merged[1].sourceCategories).toEqual([]);
 });
 it('retains current standalone badge and adds actual membership provenance',()=>{
  const merged=mergeExpansionRefreshProducts([], [{...product('current'),hasNewBadge:true}], new Map([['https://brand.test/products/current',{path:'/collections/new-in',title:'New In'}]]));
  expect(merged[0]).toMatchObject({isNewArrivalsCollection:true,hasNewBadge:true,collectionPath:'/collections/new-in'});
  expect(merged[0].sourceCategories?.[0].categoryUrl).toBe('https://brand.test/collections/new-in');
 });
});
