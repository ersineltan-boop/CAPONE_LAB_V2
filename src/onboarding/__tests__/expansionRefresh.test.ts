import {describe,it,expect} from 'vitest';
import {expansionRefreshDecision} from '../expansionRefresh';
const old = {generatedAt:'old',products:Array.from({length:100},(_,i)=>({productUrl:`url-${i}`}))};
const fresh = () => ({generatedAt:'new',products:old.products,coverage:{paginationExhausted:true,errors:[],freshProducts:100}});
describe('expansion last-good gate',()=>{
 it('rejects stale snapshots after collector failure',()=>expect(expansionRefreshDecision(old,old)).toBeTruthy());
 it('rejects a merged last-good catalog disguising an empty/short collect',()=>{const x=fresh();x.coverage.freshProducts=5;expect(expansionRefreshDecision(old,x)).toBeTruthy();});
 it('rejects truncated pagination and HTTP failures',()=>{const x=fresh();x.coverage.paginationExhausted=false;expect(expansionRefreshDecision(old,x)).toBeTruthy();const y=fresh();(y.coverage.errors as string[]).push('HTTP 403');expect(expansionRefreshDecision(old,y)).toBeTruthy();});
 it('rejects a lost URL even when total count remains equal',()=>{const x=fresh();x.products=[...old.products.slice(1),{productUrl:'replacement'}];expect(expansionRefreshDecision(old,x)).toBeTruthy();});
 it('accepts verified refresh while keeping partial coverage',()=>{expect(expansionRefreshDecision(old,fresh())).toBeNull();});
});
