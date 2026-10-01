import { describe, expect, it } from 'vitest';
import { collectOfficialSalesforce, sameSalesforceRequestScope, salesforceCatalogToAttempt } from '../integration';
import { CASADEI_SCOPE } from '../casadei';
import type { SalesforceCatalog } from '../types';
import { extractStyleIdentity } from '../../../modelFamily/styleCode';

const catalog = (): SalesforceCatalog => ({scope: {...CASADEI_SCOPE, storefrontCurrency:'USD'}, collectedAt:'2026-10-01T00:00:00Z', status:'FULL',blocker:null,sourceReportedTotal:2,
  scopeProductUrls:['https://www.casadei.com/en/shoes/one.html','https://www.casadei.com/en/bag.html'],
  accepted:[{productId:'ONE',productName:'Blade Pump',productUrl:'https://www.casadei.com/en/shoes/one.html',color:'Black',material:'Suede',sku:null,
    category:'PUMP',images:['https://www.casadei.com/one.jpg','https://www.casadei.com/two.jpg'],sizes:[{size:'35',displaySize:'35',sku:'REAL35',selectable:true}],modelCode:'MODEL',gender:'FEMALE',sourceCategoryId:'shoes-pumps',sourceCategoryName:'Pumps',inNewArrivals:false,isNew:false,hasNewBadge:false}],
  quarantined:[{productId:'BAG',productName:'Bag',productUrl:'https://www.casadei.com/en/bag.html',reason:'non-footwear'}],families:[],pagesVisited:[CASADEI_SCOPE.collectionUrl],paginationExhausted:true,errors:[],newProducts:0});

function listing(total: number) {
  return `<script id="mobify-data">${JSON.stringify({ search: { total, offset: 0, limit: 24, pages: {1: [{productId:'ONE', productName:'Blade Pump', c_url:'https://www.casadei.com/en/shoes/one.html', currency:'USD', representedProduct:{c_model:'MODEL',c_gender:'FEMALE',c_categoryId:'shoes-pumps',c_categoryName:'Pumps'}, imageGroups:[{viewType:'zoom',images:[{link:'https://www.casadei.com/one.jpg'}]}],variants:[{productId:'REAL35',variationValues:{size:'35'}}]}]} }})}</script>`;
}

describe('Salesforce production integration',()=>{
  it('preserves real size SKUs and galleries, subtracting only proven exclusions from the source total',()=>{
    const result=salesforceCatalogToAttempt(catalog());
    expect(result.sourceReportedProductCount).toBe(1);
    expect(result.rawProductUrlsDiscovered).toBe(2);
    expect(result.products[0]?.sourceSizes?.[0]?.sku).toBe('REAL35');
    expect(result.products[0]?.variants[0]?.sku).toBeNull();
    expect(result.products[0]?.images).toHaveLength(2);
    expect(result.products[0]?.hasNewBadge).toBe(false);
    expect(result.errors).toEqual([]);
    expect(extractStyleIdentity(result.products[0] as never)).toEqual({code:'MODEL',verified:true});
  });
  it('rejects URL substitution even when all counts still match',()=>{
    const c=catalog();c.accepted[0]!.productUrl='https://www.casadei.com/en/shoes/unrelated.html';
    expect(salesforceCatalogToAttempt(c).errors).toContain('SALESFORCE_URL_IDENTITY_MISMATCH');
  });
  it('keeps partial sources rejected with their coverage evidence',()=>{
    const c=catalog();c.status='PARTIAL';c.blocker='missing-sku';
    expect(salesforceCatalogToAttempt(c).errors).toContain('SALESFORCE_PARTIAL:missing-sku');
  });
  it('does not trust a different market, host, endpoint or pagination query',()=>{
    const u=CASADEI_SCOPE.collectionUrl+'?page=2';
    expect(sameSalesforceRequestScope(u,u)).toBe(true);
    for(const wrong of [u.replace('en-us','en-gb'),u.replace('www.casadei.com','other.example'),u.replace('page=2','page=1'),u.replace('shoes','bags')]) expect(sameSalesforceRequestScope(u,wrong)).toBe(false);
  });
  it('rejects a source total that changes during collection',async()=>{
    let calls=0;
    const attempt=await collectOfficialSalesforce({id:'casadei',brand:'CASADEI',baseUrl:CASADEI_SCOPE.officialUrl,collectionPaths:[],maxProducts:200},{fetchText:async url=>({ok:true,status:200,url,text:listing(++calls===1?1:2)})});
    expect(attempt.errors).toContain('SALESFORCE_SOURCE_TOTAL_CHANGED');
    expect(attempt.errors).toContain('SALESFORCE_FINAL_SOURCE_COUNT_UNVERIFIED');
  });
  it('rejects a locale redirect even if the redirected response has a complete catalog',async()=>{
    const attempt=await collectOfficialSalesforce({id:'casadei',brand:'CASADEI',baseUrl:CASADEI_SCOPE.officialUrl,collectionPaths:[],maxProducts:200},{fetchText:async url=>({ok:true,status:200,url:url.replace('en-us','en-gb'),text:listing(1)})});
    expect(attempt.errors).toContain('SALESFORCE_STOREFRONT_SCOPE_CHANGED');
    expect(attempt.products).toHaveLength(0);
  });
  it('refuses unregistered source hosts before making requests',async()=>{
    await expect(collectOfficialSalesforce({id:'casadei',brand:'CASADEI',baseUrl:'https://other.example',collectionPaths:[],maxProducts:200},{fetchText:async()=>{throw new Error('should not fetch');}})).rejects.toThrow('registered official');
  });
});
