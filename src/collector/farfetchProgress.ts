import {createHash} from 'node:crypto';
import {mkdir, readFile, rename, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fetchText} from './http';
import {farfetchAccessBlocked} from './farfetchAccess';
import {FARFETCH_BASE, FARFETCH_SHOES_URL, farfetchCategoryKey, farfetchJsonLdToSourceObservation, parseFarfetchCatalogPagination, parseFarfetchItemList} from './farfetch';
import type {PilotProduct} from './types';

interface Page {urls: string[]; products: PilotProduct[]; sourceItems?: ReturnType<typeof parseFarfetchItemList>; collectedAt: string; fingerprint: string;}
interface Progress {version: 1; listing?: string; reconcileCountChanges?: boolean; countChanges?: Array<{page: number; previous: number; observed: number}>; overlapRewinds?:number[]; startedAt: string; total: number; size: number; first: string; nextPage: number; parts: string[];}
interface FarfetchProgressResult {
  products:PilotProduct[]; observations?:PilotProduct[]; coverageStatus:'FULL'|'PARTIAL'|'FAILED';
  errors:string[]; blocked:boolean; paginationExhausted:boolean; pagesTraversed:number;
  sourceReportedProductCount:number|null; rawSourceProducts:number;
  progress:{nextPage:number;expectedPages:number|null;startedAt:string|null;checkedAt:string;resetReason:string|null;
    savedPages:number;countChanges:Array<{page:number;previous:number;observed:number}>;overlapRewinds:number[]};
}
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
async function atomic(path: string, value: unknown) {
  await writeFile(path + '.tmp', JSON.stringify(value)); await rename(path + '.tmp', path);
}

/** Saved pages are collection progress, never a publishable partial catalog. */
export async function collectFarfetchProgress(options: {
  directory: string; maxPages?: number; budgetMs?: number;
  listingUrl?: string;
  reconcileCountChanges?: boolean;
  captureObservations?: boolean;
  /** Internal cap: at most one final-page reconciliation per bounded call. */
  tailReconciliationUsed?: boolean;
  http?: typeof fetchText; now?: () => number;
}):Promise<FarfetchProgressResult> {
  const http = options.http ?? fetchText, now = options.now ?? Date.now;
  const listing = options.listingUrl ?? FARFETCH_SHOES_URL;
  if (!farfetchCategoryKey(listing)) {
    throw new Error('Invalid Farfetch footwear listing');
  }
  const began = now(), deadline = began + Math.min(options.budgetMs ?? 20 * 60_000, 20 * 60_000);
  const pageLimit = Math.min(Math.max(1, options.maxPages ?? 800), 800);
  const directory = options.directory, statePath = join(directory, 'progress.json');
  await mkdir(directory, {recursive: true});
  let progress: Progress | undefined, resetReason: string | null = null;
  let pagesTraversed = 0, rawSourceProducts = 0;
  let sourceValidated = false;
  const errors: string[] = [];
  const observations: PilotProduct[] = [];
  const request = async (url: string, delayMs: number) => {
    let response = await http(url, {delayMs,headers:{'Cache-Control':'no-cache'}}); pagesTraversed++;
    // Retry a temporary transport/server failure once, within the same budget.
    // Access denials and rate limits are never retried or routed around.
    if (!farfetchAccessBlocked(response) && (response.status === 0 || response.status >= 500) && now() + 17_000 <= deadline) {
      response = await http(url, {delayMs:900,headers:{'Cache-Control':'no-cache'}}); pagesTraversed++;
    }
    return response;
  };
  const result = (products: PilotProduct[] = [], full = false, blocked = false) => ({
    products, coverageStatus: full ? 'FULL' as const : sourceValidated ? 'PARTIAL' as const : 'FAILED' as const,
    observations:options.captureObservations ? observations : undefined,
    errors, blocked, paginationExhausted: full, pagesTraversed,
    sourceReportedProductCount: progress?.total ?? null,
    rawSourceProducts: rawSourceProducts || Math.min((progress?.parts.length ?? 0) * (progress?.size ?? 0), progress?.total ?? 0),
    progress: {nextPage: progress?.nextPage ?? 1, expectedPages: progress ? Math.ceil(progress.total / progress.size) : null,
      startedAt: progress?.startedAt ?? null, checkedAt: new Date(now()).toISOString(), resetReason,
      savedPages: progress?.parts.length ?? 0, countChanges:progress?.countChanges ?? [],overlapRewinds:progress?.overlapRewinds??[]},
  });
  if (!Number.isFinite(deadline) || deadline <= began || !Number.isInteger(pageLimit)) throw new Error('Invalid Farfetch collection budget');
  try {
    progress = JSON.parse(await readFile(statePath, 'utf8'));
    if (progress?.version !== 1 || !Number.isInteger(progress.total) || progress.total < 1 ||
      !Number.isInteger(progress.size) || progress.size < 1 || !Array.isArray(progress.parts) ||
      progress.parts.some(part => !/^[a-f0-9]{64}$/.test(part)) || progress.nextPage !== progress.parts.length + 1 ||
      !Number.isFinite(Date.parse(progress.startedAt))) throw new Error('Invalid checkpoint');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') resetReason = 'CHECKPOINT_INVALID';
    progress = undefined;
  }
  const home = await request(listing, 500);
  if(farfetchAccessBlocked(home)){errors.push(`Farfetch access blocked (HTTP ${home.status})`);return result([],false,true);}
  if (!home.ok) {errors.push(`Farfetch HTTP ${home.status}: ${home.error ?? 'source unavailable'}`); return result([], false, [403,429].includes(home.status));}
  const initial = parseFarfetchCatalogPagination(home.text);
  const firstItems = parseFarfetchItemList(home.text);
  if (!initial || initial.page !== 1 || !firstItems.length || initial.total < 1) {
    errors.push('Farfetch authoritative catalog pagination/first page missing'); return result();
  }
  const readPage = (text: string): Page => {
    const items = parseFarfetchItemList(text);
    const urls = items.map(item => new URL(item.offers?.url ?? '', FARFETCH_BASE).href.split('?')[0]!);
    if (!urls.length || urls.some(url => !url.startsWith(FARFETCH_BASE + '/uk/shopping/women/')) || new Set(urls).size !== urls.length) {
      throw new Error('Farfetch malformed or duplicate source URLs');
    }
    const collectedAt = new Date(now()).toISOString();
    return {urls, sourceItems:items, products: items.flatMap(item => {
      const product = farfetchJsonLdToSourceObservation(item, listing, collectedAt); return product ? [product] : [];
    }), collectedAt, fingerprint: digest(JSON.stringify(urls))};
  };
  const productsForPage = (page: Page) => {
    if (page.sourceItems === undefined) return page.products; // Legacy checkpoints.
    if (!Array.isArray(page.sourceItems) || page.sourceItems.length !== page.urls.length ||
        page.sourceItems.some((item,index) => new URL(item.offers?.url ?? '', FARFETCH_BASE).href.split('?')[0] !== page.urls[index])) {
      throw new Error('Farfetch checkpoint source evidence mismatch');
    }
    // Re-run the current classifier against immutable source observations.
    // A fixed vocabulary rule does not require downloading the same pages.
    return page.sourceItems.flatMap(item => {
      const product=farfetchJsonLdToSourceObservation(item,listing,page.collectedAt);
      return product ? [product] : [];
    });
  };
  let first: Page;
  try {first = readPage(home.text);} catch (error) {errors.push(String(error)); return result();}
  sourceValidated = true;
  // A rolling storefront is not an immutable snapshot. Old/different epochs
  // cannot be joined and called a fresh complete collection.
  if (progress && ((progress.listing ?? FARFETCH_SHOES_URL) !== listing || Boolean(progress.reconcileCountChanges) !== Boolean(options.reconcileCountChanges) ||
      (!options.reconcileCountChanges && progress.total !== initial.total) || progress.size !== initial.size || progress.first !== first.fingerprint ||
      began - Date.parse(progress.startedAt) > 60 * 60_000 || began < Date.parse(progress.startedAt))) {
    resetReason = 'SOURCE_CHANGED_OR_CHECKPOINT_STALE'; progress = undefined;
  }
  if (!progress) {
    await rm(directory, {recursive: true, force: true}); await mkdir(directory, {recursive: true});
    progress = {version: 1, listing, reconcileCountChanges:Boolean(options.reconcileCountChanges), startedAt: new Date(began).toISOString(), total: initial.total, size: initial.size,
      first: first.fingerprint, nextPage: 1, parts: []};
  } else if (progress.total !== initial.total) {
    const wasComplete=progress.nextPage>Math.ceil(progress.total/progress.size);
    const keep=Math.max(0,Math.min(progress.parts.length-(wasComplete?1:0),Math.ceil(initial.total/progress.size)-1));
    progress.parts=progress.parts.slice(0,keep);progress.nextPage=keep+1;
    (progress.countChanges??=[]).push({page:1,previous:progress.total,observed:initial.total});
    progress.total=initial.total;await atomic(statePath,progress);
  }
  if(options.reconcileCountChanges&&progress.parts.length){
    // A moving storefront may shift cards across an already captured boundary.
    // Recollect from the earliest repeated card, never deduplicate it into FULL.
    // The unchanged first-page/age checks above still bind this source epoch.
    const seen=new Map<string,number>();let rewind:number|null=null;
    try{
      for(const [index,hash] of progress.parts.entries()){
        const body=await readFile(join(directory,`${hash}.json`),'utf8');
        if(digest(body)!==hash)throw new Error('Farfetch checkpoint checksum mismatch');
        const page=JSON.parse(body) as Page;productsForPage(page);
        for(const url of page.urls){
          const previous=seen.get(url);
          if(previous!==undefined)rewind=Math.min(rewind??previous,previous);
          else seen.set(url,index);
        }
      }
    }catch(error){errors.push(String(error));await rm(directory,{recursive:true,force:true});return result();}
    if(rewind!==null){
      progress.parts=progress.parts.slice(0,rewind);progress.nextPage=rewind+1;
      (progress.overlapRewinds??=[]).push(rewind+1);await atomic(statePath,progress);
    }
  }
  if (options.captureObservations) {
    for (const hash of progress.parts) {
      const body=await readFile(join(directory, `${hash}.json`), 'utf8');
      if (digest(body)!==hash) {errors.push('Farfetch observation checkpoint checksum mismatch');return result();}
      observations.push(...productsForPage(JSON.parse(body) as Page));
    }
  }
  let required = Math.ceil(progress.total / progress.size);
  let savedThisRun = 0;
  while (progress.nextPage <= required && savedThisRun < pageLimit) {
    // Reserve the HTTP helper's timeout plus throttling before starting a page.
    if (now() + 16_000 > deadline) {errors.push('FARFETCH_TIME_BUDGET_REACHED_PROGRESS_SAVED'); break;}
    const pageNumber = progress.nextPage;
    const response = pageNumber === 1 ? home : await request(`${listing}?page=${pageNumber}`, 900);
    if(farfetchAccessBlocked(response)){errors.push(`Farfetch access blocked (HTTP ${response.status})`);return result([],false,true);}
    if (!response.ok) {errors.push(`Farfetch page ${pageNumber} HTTP ${response.status}: ${response.error ?? 'source unavailable'}`); return result([], false, [403,429].includes(response.status));}
    const meta = parseFarfetchCatalogPagination(response.text);
    const pageCount = meta ? Math.ceil(meta.total / progress.size) : required;
    if (options.captureObservations && meta?.page === pageNumber && meta.size === progress.size) {
      try {observations.push(...(pageNumber === 1 ? first : readPage(response.text)).products);} catch { /* No unvalidated observation. */ }
    }
    if (!meta || meta.page !== pageNumber || meta.size !== progress.size || pageNumber > pageCount ||
      (!options.reconcileCountChanges && meta.total !== progress.total) ||
      meta.hasNextPage !== (pageNumber < pageCount)) {errors.push(`Farfetch pagination changed at page ${pageNumber} (expected total ${progress.total}, observed ${meta?.total ?? 'missing'}); incomplete snapshot retained`); break;}
    let page: Page;
    try {page = pageNumber === 1 ? first : readPage(response.text);} catch (error) {errors.push(String(error)); break;}
    const expected = pageNumber < pageCount ? progress.size : meta.total - (pageCount - 1) * progress.size;
    if (page.urls.length !== expected) {errors.push(`Farfetch page ${pageNumber} card count mismatch`); break;}
    const body = JSON.stringify(page), hash = digest(body);
    // Write immutable page first, then the atomic cursor. Cancellation never
    // advances the cursor beyond data which was actually persisted.
    await writeFile(join(directory, `${hash}.json`), body);
    if (meta.total !== progress.total) {
      (progress.countChanges ??= []).push({page:pageNumber, previous:progress.total, observed:meta.total});
    }
    progress.total = meta.total; required = pageCount;
    progress.parts.push(hash); progress.nextPage++; savedThisRun++;
    await atomic(statePath, progress);
  }
  if (progress.nextPage <= required) {
    rawSourceProducts = Math.min(progress.parts.length * progress.size, progress.total);
    if (!errors.length) errors.push('FARFETCH_PAGE_BUDGET_REACHED_PROGRESS_SAVED');
    return result();
  }
  const urls = new Set<string>(), products: PilotProduct[] = [];
  try {
    for (const hash of progress.parts) {
      const body = await readFile(join(directory, `${hash}.json`), 'utf8');
      if (digest(body) !== hash) throw new Error('Farfetch checkpoint checksum mismatch');
      const page = JSON.parse(body) as Page;
      for (const url of page.urls) {if (urls.has(url)) throw new Error('Farfetch repeated/overlapping pages'); urls.add(url);}
      products.push(...productsForPage(page));
    }
  } catch (error) {
    errors.push(String(error));
    // Retain checksummed evidence for the next bounded range recollection.
    // No products are returned until a fresh traversal is completely unique.
    if(!options.reconcileCountChanges||!String(error).includes('Farfetch repeated/overlapping pages'))
      await rm(directory,{recursive:true,force:true});
    return result();
  }
  rawSourceProducts = urls.size;
  if (now() - Date.parse(progress.startedAt) > 60 * 60_000 || urls.size !== progress.total) {
    errors.push('Farfetch complete snapshot is stale or does not reconcile; last-good preserved');
    await rm(directory, {recursive:true,force:true}); return result();
  }
  if (products.length !== progress.total) {
    errors.push(`Farfetch product conversion does not reconcile: ${products.length}/${progress.total}; source checkpoint retained, last-good preserved`);
    return result();
  }
  if (now() + 16_000 > deadline) {errors.push('FARFETCH_FINAL_CHECK_PENDING_PROGRESS_SAVED'); return result();}
  const final = await request(listing, 500);
  if(farfetchAccessBlocked(final)){errors.push(`Farfetch access blocked (HTTP ${final.status})`);return result([],false,true);}
  const finalMeta = final.ok ? parseFarfetchCatalogPagination(final.text) : null;
  let sameFirst = false;
  try {sameFirst = final.ok && readPage(final.text).fingerprint === progress.first;} catch { /* Fail closed. */ }
  if (!finalMeta || finalMeta.page !== 1 || finalMeta.total !== progress.total || finalMeta.size !== progress.size || !sameFirst) {
    const countOnlyChange=finalMeta?.page===1&&finalMeta.size===progress.size&&sameFirst&&finalMeta.total>0&&finalMeta.total!==progress.total;
    if(countOnlyChange&&options.reconcileCountChanges&&!options.tailReconciliationUsed&&
       now()+48_000<=deadline&&pageLimit-savedThisRun>=1){
      const keep=Math.max(0,Math.min(progress.parts.length-1,Math.ceil(finalMeta.total/progress.size)-1));
      (progress.countChanges??=[]).push({page:1,previous:progress.total,observed:finalMeta.total});
      progress.total=finalMeta.total;progress.parts=progress.parts.slice(0,keep);progress.nextPage=keep+1;
      await atomic(statePath,progress);
      const next=await collectFarfetchProgress({...options,budgetMs:deadline-now(),maxPages:pageLimit-savedThisRun,tailReconciliationUsed:true});
      return {...next,pagesTraversed:pagesTraversed+next.pagesTraversed};
    }
    errors.push(`Farfetch final source check failed (HTTP ${final.status}, expected total ${progress.total}, observed ${finalMeta?.total ?? 'missing'}, first page unchanged ${sameFirst}); last-good preserved`);
    if (final.ok&&!countOnlyChange) await rm(directory, {recursive:true,force:true});
    return result([], false, [403,429].includes(final.status));
  }
  // Keep the complete epoch until the caller has published successfully. A
  // later run will recheck freshness and the source before considering reuse.
  return result(products, true);
}
