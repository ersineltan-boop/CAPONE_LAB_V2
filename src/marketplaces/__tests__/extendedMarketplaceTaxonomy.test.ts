import {describe,expect,it} from 'vitest';
import type {PilotProduct} from '../../collector/types';
import {analyzeProducts} from '../../analysis/analyzeProduct';
import {buildModelFamilies} from '../../modelFamily/buildFamilies';
import {evaluateMarketplaceCandidate} from '../automation';

const product=(name:string):PilotProduct=>({source:'24s',brand:'Test',productName:name,productUrl:'https://www.24s.com/'+name.replaceAll(' ','-'),
  imageUrl:'https://www.24s.com/shoe.jpg',images:['https://www.24s.com/shoe.jpg'],category:'OTHER_FOOTWEAR',color:null,material:null,
  toeShape:null,heelType:null,heelHeight:null,details:null,discoveredAt:'2026-10-13T17:00:00Z',variants:[]});
const decide=(p:PilotProduct)=>evaluateMarketplaceCandidate({candidate:{sourceId:'24s',products:[p],coverageStatus:'FULL',
  sourceTotal:1,rawCollected:1,eligibleTotal:1,paginationExhausted:true,errors:[]},previousLastGood:[]});
describe('supported marketplace primary taxonomy',()=>{
  it.each([['Leather espadrilles','ESPADRILLE'],['Leather derby shoes','OXFORD_DERBY'],['Wooden clogs','CLOG']])(
    'admits explicit %s evidence and delivers the same known category', (name,primary)=>{
      const p=product(name!);const d=decide(p);expect(d.report.accepted).toBe(true);expect(d.quarantined).toEqual([]);
      expect(buildModelFamilies(analyzeProducts(d.eligibleProducts)).families[0]?.primaryCategory).toBe(primary);
      expect(d.eligibleProducts[0]?.category).toBe('OTHER_FOOTWEAR'); // Preserve the source/legacy value.
    });
  it.each(['Tyler lace up','Unnamed leather shoes','Espadrille tote bag','Oxford shoe socks'])('keeps %s out without adequate footwear/category proof',name=>{
    expect(decide(product(name)).eligibleProducts).toEqual([]);
  });
  it('still rejects missing galleries and incomplete source coverage',()=>{
    const p=product('Leather espadrilles');expect(decide({...p,imageUrl:null,images:[]}).report.accepted).toBe(false);
    const d=evaluateMarketplaceCandidate({candidate:{sourceId:'24s',products:[p],coverageStatus:'PARTIAL',sourceTotal:2,rawCollected:1,
      eligibleTotal:2,paginationExhausted:false,errors:[]},previousLastGood:[]});expect(d.report.accepted).toBe(false);
  });
  it('admits opaque Farfetch names only with an exact supported source category',()=>{
    const p={...product('Opaque model name'),source:'farfetch',productUrl:'https://www.farfetch.com/uk/shopping/women/test-item-1.aspx',
      sourceCategoryPath:'/uk/shopping/women/espadrilles-1/items.aspx',sourceCategoryUrl:'https://www.farfetch.com/uk/shopping/women/espadrilles-1/items.aspx'};
    const d=evaluateMarketplaceCandidate({candidate:{sourceId:'farfetch',products:[p],coverageStatus:'FULL',sourceTotal:1,rawCollected:1,
      eligibleTotal:1,paginationExhausted:true,errors:[]},previousLastGood:[]});
    expect(d.report.accepted).toBe(true);expect(d.quarantined).toEqual([]);
    expect(buildModelFamilies(analyzeProducts(d.eligibleProducts)).families[0]?.primaryCategory).toBe('ESPADRILLE');
  });
});
