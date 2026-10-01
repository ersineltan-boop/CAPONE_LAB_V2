import {describe,expect,it} from 'vitest';
import {selectQueueCandidates} from '../selection';
import type {BrandOnboardingQueueEntry,BrandOnboardingQueueFile} from '../types';
const entry=(slug:string,sourceUrl:string):BrandOnboardingQueueEntry=>({slug,brand:slug,sourceUrl,priority:1,status:'CUSTOM_ADAPTER_REQUIRED',attempts:1,lastAttemptAt:null,nextRetryAt:null,detectedPlatform:'SALESFORCE COMMERCE',collectorStrategy:'salesforce-public',blocker:'old generic adapter limitation',productsFound:0,activatedAt:null,notes:null});
const queue=(entries:BrandOnboardingQueueEntry[]):BrandOnboardingQueueFile=>({version:1,updatedAt:'2026-10-01T00:00:00Z',policy:{maxAttemptsPerRun:25,maxActivationsPerRun:3,retryDays:7},entries});
describe('delivered Salesforce adapter queue selection',()=>{
  it('retries only the two newly wired official sources, retaining unsupported brands as terminal',()=>{
    const q=queue([entry('casadei','https://www.casadei.com'),entry('jil-sander','https://www.jilsander.com'),entry('jacquemus','https://www.jacquemus.com')]);
    expect(selectQueueCandidates(q).map(e=>e.slug)).toEqual(['casadei','jil-sander']);
  });
  it('preserves active-source exclusion and retry delays',()=>{
    const a=entry('casadei','https://www.casadei.com'),b=entry('jil-sander','https://www.jilsander.com');b.nextRetryAt='2026-10-07T00:00:00Z';
    expect(selectQueueCandidates(queue([a,b]),{now:new Date('2026-10-01T00:00:00Z'),skipSlugs:new Set(['casadei'])})).toEqual([]);
  });
  it('does not authorize a substituted source for a known brand slug',()=>{
    expect(selectQueueCandidates(queue([entry('casadei','https://other.example')]))).toEqual([]);
  });
  it('selects delivered wave adapters, excludes active brands and leaves unsupported adapters terminal',()=>{
    const q=queue([entry('coperni','https://coperni.com'),entry('moon-boot','https://www.moonboot.com'),entry('wandler','https://wandler.com'),entry('coperni','https://other.example')]);
    expect(selectQueueCandidates(q,{skipSlugs:new Set(['moon-boot'])}).map(e=>e.slug)).toEqual(['coperni']);
  });
});
