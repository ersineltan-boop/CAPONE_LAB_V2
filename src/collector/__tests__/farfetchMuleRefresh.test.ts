import {afterEach,describe,expect,it} from 'vitest';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {collectFarfetchMuleCandidate} from '../farfetchMuleRefresh';
import {FARFETCH_SHOES_URL} from '../farfetch';
const dirs:string[]=[];
const url='https://www.farfetch.com/uk/shopping/women/leather-mule-item-11.aspx';
const rootHtml=`<script>window.__HYDRATION_STATE__=${JSON.stringify(JSON.stringify({apolloInitialState:{ROOT_QUERY:{'productCatalog:{"first":2}':{totalCount:10,pageInfo:{startCursor:'MQ==',hasNextPage:true}}}}}))};</script>`;
const productHtml=`<script type="application/ld+json">${JSON.stringify({'@type':'ProductGroup',productGroupID:'11',name:'Leather mules',brand:{name:'Aeyde'},image:'https://cdn-images.farfetch-contents.com/11_1000.jpg',hasVariant:[{sku:'11-38',size:'38',offers:{url,availability:'https://schema.org/InStock'}}]})}</script>`;
async function directory(){const dir=await mkdtemp(join(tmpdir(),'ff-mule-candidate-'));dirs.push(dir);
 const queue={urls:[url],discoveredAt:new Date().toISOString()};await writeFile(join(dir,'queue.json'),JSON.stringify({...queue,checksum:createHash('sha256').update(JSON.stringify(queue)).digest('hex')}));return dir;}
afterEach(async()=>{await Promise.all(dirs.splice(0).map(dir=>rm(dir,{recursive:true,force:true})));});
describe('Farfetch Mule candidate recovery',()=>{
 it('recovers a transient root failure once before verifying queued products',async()=>{
  const calls:string[]=[];
  const candidate=await collectFarfetchMuleCandidate({directory:await directory(),http:async u=>{
   calls.push(u);return calls.length===1?{ok:false,status:0,url:u,text:'',error:'connection timeout'}:{ok:true,status:200,url:u,text:u===FARFETCH_SHOES_URL?rootHtml:productHtml};
  }});
  expect(calls).toEqual([FARFETCH_SHOES_URL,FARFETCH_SHOES_URL,url]);expect(candidate.products).toHaveLength(1);expect(candidate.verifiedProducts).toHaveLength(1);
  expect(candidate.sourceTotal).toBe(10);expect(candidate.coverageStatus).toBe('PARTIAL');
 });
 it('does not retry a 5xx root response with a visible access challenge',async()=>{
  const calls:string[]=[];
  await expect(collectFarfetchMuleCandidate({directory:await directory(),http:async u=>{calls.push(u);return {ok:false,status:503,url:u,text:'<h1>Checking your browser</h1>'};}})).rejects.toThrow('access blocked');
  expect(calls).toEqual([FARFETCH_SHOES_URL]);
 });
});
