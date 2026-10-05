import {createHash} from 'node:crypto';
import {mkdir, readFile, rename, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fetchText} from './http';
import {FARFETCH_BASE, FARFETCH_SHOES_URL, farfetchJsonLdToProduct, parseFarfetchCatalogPagination, parseFarfetchItemList} from './farfetch';
import type {PilotProduct} from './types';

interface Page {urls: string[]; products: PilotProduct[]; collectedAt: string; fingerprint: string;}
interface Progress {version: 1; startedAt: string; total: number; size: number; first: string; nextPage: number; parts: string[];}
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
async function atomic(path: string, value: unknown) {
  await writeFile(path + '.tmp', JSON.stringify(value)); await rename(path + '.tmp', path);
}

/** Saved pages are collection progress, never a publishable partial catalog. */
export async function collectFarfetchProgress(options: {
  directory: string; maxPages?: number; budgetMs?: number;
  http?: typeof fetchText; now?: () => number;
}) {
  const http = options.http ?? fetchText, now = options.now ?? Date.now;
  const began = now(), deadline = began + Math.min(options.budgetMs ?? 20 * 60_000, 20 * 60_000);
  const pageLimit = Math.min(Math.max(1, options.maxPages ?? 800), 800);
  const directory = options.directory, statePath = join(directory, 'progress.json');
  await mkdir(directory, {recursive: true});
  let progress: Progress | undefined, resetReason: string | null = null;
  let pagesTraversed = 0, rawSourceProducts = 0;
  let sourceValidated = false;
  const errors: string[] = [];
  const result = (products: PilotProduct[] = [], full = false, blocked = false) => ({
    products, coverageStatus: full ? 'FULL' as const : sourceValidated ? 'PARTIAL' as const : 'FAILED' as const,
    errors, blocked, paginationExhausted: full, pagesTraversed,
    sourceReportedProductCount: progress?.total ?? null, rawSourceProducts,
    progress: {nextPage: progress?.nextPage ?? 1, expectedPages: progress ? Math.ceil(progress.total / progress.size) : null,
      startedAt: progress?.startedAt ?? null, checkedAt: new Date(now()).toISOString(), resetReason,
      savedPages: progress?.parts.length ?? 0},
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
  const home = await http(FARFETCH_SHOES_URL, {delayMs: 500}); pagesTraversed++;
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
    return {urls, products: items.flatMap(item => {
      const product = farfetchJsonLdToProduct(item, FARFETCH_SHOES_URL, collectedAt); return product ? [product] : [];
    }), collectedAt, fingerprint: digest(JSON.stringify(urls))};
  };
  let first: Page;
  try {first = readPage(home.text);} catch (error) {errors.push(String(error)); return result();}
  sourceValidated = true;
  // A rolling storefront is not an immutable snapshot. Old/different epochs
  // cannot be joined and called a fresh complete collection.
  if (progress && (progress.total !== initial.total || progress.size !== initial.size || progress.first !== first.fingerprint ||
      began - Date.parse(progress.startedAt) > 60 * 60_000 || began < Date.parse(progress.startedAt))) {
    resetReason = 'SOURCE_CHANGED_OR_CHECKPOINT_STALE'; progress = undefined;
  }
  if (!progress) {
    await rm(directory, {recursive: true, force: true}); await mkdir(directory, {recursive: true});
    progress = {version: 1, startedAt: new Date(began).toISOString(), total: initial.total, size: initial.size,
      first: first.fingerprint, nextPage: 1, parts: []};
  }
  const required = Math.ceil(progress.total / progress.size);
  let savedThisRun = 0;
  while (progress.nextPage <= required && savedThisRun < pageLimit) {
    // Reserve the HTTP helper's timeout plus throttling before starting a page.
    if (now() + 16_000 > deadline) {errors.push('FARFETCH_TIME_BUDGET_REACHED_PROGRESS_SAVED'); break;}
    const pageNumber = progress.nextPage;
    const response = pageNumber === 1 ? home : await http(`${FARFETCH_SHOES_URL}?page=${pageNumber}`, {delayMs: 900});
    if (pageNumber !== 1) pagesTraversed++;
    if (!response.ok) {errors.push(`Farfetch page ${pageNumber} HTTP ${response.status}: ${response.error ?? 'source unavailable'}`); return result([], false, [403,429].includes(response.status));}
    const meta = parseFarfetchCatalogPagination(response.text);
    if (!meta || meta.page !== pageNumber || meta.total !== progress.total || meta.size !== progress.size ||
      meta.hasNextPage !== (pageNumber < required)) {errors.push(`Farfetch pagination changed at page ${pageNumber}; incomplete snapshot retained`); break;}
    let page: Page;
    try {page = pageNumber === 1 ? first : readPage(response.text);} catch (error) {errors.push(String(error)); break;}
    const expected = pageNumber < required ? progress.size : progress.total - (required - 1) * progress.size;
    if (page.urls.length !== expected) {errors.push(`Farfetch page ${pageNumber} card count mismatch`); break;}
    const body = JSON.stringify(page), hash = digest(body);
    // Write immutable page first, then the atomic cursor. Cancellation never
    // advances the cursor beyond data which was actually persisted.
    await writeFile(join(directory, `${hash}.json`), body);
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
      products.push(...page.products);
    }
  } catch (error) {errors.push(String(error)); await rm(directory, {recursive:true,force:true}); return result();}
  rawSourceProducts = urls.size;
  if (now() - Date.parse(progress.startedAt) > 60 * 60_000 || urls.size !== progress.total || products.length !== progress.total) {
    errors.push('Farfetch complete snapshot is stale or does not reconcile; last-good preserved');
    await rm(directory, {recursive:true,force:true}); return result();
  }
  if (now() + 16_000 > deadline) {errors.push('FARFETCH_FINAL_CHECK_PENDING_PROGRESS_SAVED'); return result();}
  const final = await http(FARFETCH_SHOES_URL, {delayMs:500}); pagesTraversed++;
  const finalMeta = final.ok ? parseFarfetchCatalogPagination(final.text) : null;
  let sameFirst = false;
  try {sameFirst = final.ok && readPage(final.text).fingerprint === progress.first;} catch { /* Fail closed. */ }
  if (!finalMeta || finalMeta.page !== 1 || finalMeta.total !== progress.total || finalMeta.size !== progress.size || !sameFirst) {
    errors.push(`Farfetch final source check failed (HTTP ${final.status}); last-good preserved`);
    if (final.ok) await rm(directory, {recursive:true,force:true});
    return result([], false, [403,429].includes(final.status));
  }
  // Keep the complete epoch until the caller has published successfully. A
  // later run will recheck freshness and the source before considering reuse.
  return result(products, true);
}
