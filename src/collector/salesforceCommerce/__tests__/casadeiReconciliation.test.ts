import { describe, expect, it } from 'vitest';
import { collectOfficialSalesforce, collectVerifiedSalesforceCatalog, salesforceCatalogToAttempt } from '../integration';
import { CASADEI_SCOPE, collectCasadeiWomensShoes } from '../casadei';
import { reconciledCasadeiTotal } from '../casadeiReconciliation';

const config = {id:'casadei',brand:'CASADEI',baseUrl:CASADEI_SCOPE.officialUrl,collectionPaths:[],maxProducts:1000};
const hit = (id: string) => ({productId:id, productName:'Leather Sandal', c_url:`https://www.casadei.com/en/shoes/sandal-${id}.html`,
  currency:'USD',representedProduct:{c_model:id,c_gender:'FEMALE',c_categoryId:'shoes-sandals',c_categoryName:'Sandals'},
  imageGroups:[{viewType:'zoom',images:[{link:`https://www.casadei.com/${id}.jpg`}]}],variants:[{productId:`${id}-35`,variationValues:{size:'35'}}]});
const listing = (offset: number, ids: string[], total=4) => `<script id="mobify-data">${JSON.stringify({search:{offset,total,limit:2,pages:{1:ids.map(hit)}}})}</script>`;
const result = (url: string, text: string, status=200) => ({ok:status===200,status,url,text});

describe('Casadei duplicate reconciliation', () => {
  it('accounts for all slots and retains the published total, merging duplicate galleries', async () => {
    const requests: string[]=[];
    const c=await collectVerifiedSalesforceCatalog(config,{fetchText:async url=>{
      requests.push(url);return result(url,url.includes('page=2')?listing(2,['B','C']):listing(0,['A','B']));
    }});
    expect(requests).toHaveLength(5); // Two full traversals plus the final source check.
    expect(c).toMatchObject({status:'FULL',sourceReportedTotal:4,casadeiReconciliation:{uniqueProductCount:3,duplicateOccurrences:1}});
    expect(c.accepted).toHaveLength(3);
    expect(salesforceCatalogToAttempt(c)).toMatchObject({sourceReportedProductCount:3,rawProductUrlsDiscovered:3,duplicateCount:1,errors:[]});
    const evidence=structuredClone(c.casadeiReconciliation!);
    evidence.replayIdentitySha256[1]='0'.repeat(64);
    expect(reconciledCasadeiTotal(4,c.scopeProductUrls,evidence)).toBeNull();
    expect(salesforceCatalogToAttempt({...c,casadeiReconciliation:evidence}).errors).toContain('SALESFORCE_DUPLICATE_EVIDENCE_INVALID');
  });
  it('rejects changing identities even when the same total and unique count remain',async()=>{
    let calls=0;
    const c=await collectOfficialSalesforce(config,{fetchText:async url=>{
      calls++;return result(url,url.includes('page=2')?listing(2,['B','C']):listing(0,calls>2?['A','D']:['A','B']));
    }});
    expect(c.errors.join(' ')).toContain('duplicate reconciliation changed');
    expect(c.errors.join(' ')).toContain('SALESFORCE_PARTIAL');
  });
  it('rejects skipped offsets without trying to reconcile the missing product',async()=>{
    let calls=0;
    const c=await collectCasadeiWomensShoes({fetchText:async url=>{
      calls++;return result(url,url.includes('page=2')?listing(3,['B','C']):listing(0,['A','B']));
    }});
    expect(c.status).toBe('PARTIAL');expect(c.casadeiReconciliation).toBeUndefined();expect(calls).toBe(2);
  });
  it('rejects malformed raw records that were dropped by the product parser',async()=>{
    const text=listing(0,['A','B'],3).replace('"pages":{"1":[','"pages":{"1":[{"productId":"BROKEN"},');
    const c=await collectCasadeiWomensShoes({fetchText:async url=>result(url,text)},{maxPages:1});
    expect(c.status).toBe('PARTIAL');expect(c.casadeiReconciliation).toBeUndefined();
  });
  it('rejects a final page-one identity change after a successful replay',async()=>{
    let calls=0;
    const c=await collectOfficialSalesforce(config,{fetchText:async url=>{
      calls++;return result(url,url.includes('page=2')?listing(2,['B','C']):listing(0,calls===5?['A','D']:['A','B']));
    }});
    expect(c.errors).toContain('SALESFORCE_FINAL_SOURCE_IDENTITY_CHANGED');
  });
  it.each([401,403,429])('stops all source requests after HTTP %s during replay',async status=>{
    let calls=0;
    const c=await collectOfficialSalesforce(config,{fetchText:async url=>{
      calls++;return result(url,url.includes('page=2')?listing(2,['B','C']):listing(0,['A','B']),calls===3?status:200);
    }});
    expect(calls).toBe(3);expect(c.errors.join(' ')).toContain('SALESFORCE_ACCESS_BLOCKED');
  });
  it('stops on a visible human verification page returned with HTTP 200',async()=>{
    let calls=0;
    const c=await collectOfficialSalesforce(config,{fetchText:async url=>{
      calls++;return result(url,'Verify that you are human');
    }});
    expect(calls).toBe(1);expect(c.errors.join(' ')).toContain('SALESFORCE_ACCESS_BLOCKED');
  });
});
