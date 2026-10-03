import { readdir, readFile } from 'node:fs/promises';
import { applyMarketplaceDeliveries, loadMarketplaceDeliveries } from '../src/collector/marketplaceDelivery';
import { loadModelFamilies } from '../src/modelFamily/dataset';
import { applySourceAwareBrandReplacement, prepareBrandDelivery, waveProductNewness } from '../src/brands/automation/delivery';
import type { WaveCatalog, WaveHttp } from '../src/brands/wave50/types';

// Offline replay of previously validated catalogs, without changing source data.
const original = applyMarketplaceDeliveries(await loadModelFamilies({ rootDir: 'data/multibrand', allowMonolithFallback: false }), await loadMarketplaceDeliveries(process.cwd()));
if (!original.length) throw new Error('Complete model archive required');
let current = original;
const http: WaveHttp = { async fetch(url) { return { ok: false, status: 503, url, data: null, text: '', error: 'Offline verification' }; } };
let replayed = 0;
const blocked: Array<{ source: string; unresolved: number }> = [];
for (const file of (await readdir('data/brands/wave50/last-good')).filter(file => file.endsWith('.json')).sort()) {
  const catalog: WaveCatalog = JSON.parse(await readFile(`data/brands/wave50/last-good/${file}`, 'utf8'));
  const prepared = await prepareBrandDelivery({ catalog, http, previousFamilies: current });
  if (prepared.unresolved.length) { blocked.push({ source: catalog.slug, unresolved: prepared.unresolved.length }); continue; }
  const delivery = { slug: catalog.slug, brand: catalog.brand, officialUrl: catalog.officialUrl, collectedAt: catalog.collectedAt,
    families: prepared.families, productNewness: waveProductNewness(catalog) };
  const replacement = applySourceAwareBrandReplacement(current, delivery);
  current = [...replacement.core, ...replacement.brandShard];
  const repeated = applySourceAwareBrandReplacement(current, delivery);
  if (JSON.stringify(repeated.brandShard) !== JSON.stringify(replacement.brandShard)) throw new Error(`${catalog.slug}: non-idempotent refresh`);
  replayed++;
}
const byId = new Map(current.map(family => [family.modelFamilyId, family]));
if (byId.size !== current.length) throw new Error('Duplicate final model IDs');
for (const old of original) {
  const fresh = byId.get(old.modelFamilyId);
  if (!fresh) throw new Error(`Archived identity missing: ${old.modelFamilyId}`);
  const urls = new Set(fresh.variants.map(variant => variant.url));
  const images = new Set(fresh.allImages);
  if (old.variants.some(variant => !urls.has(variant.url))) throw new Error(`Archived URL missing: ${old.modelFamilyId}`);
  if (old.allImages.some(image => !images.has(image))) throw new Error(`Archived gallery missing: ${old.modelFamilyId}`);
}
console.log(JSON.stringify({ replayed, blocked, before: original.length, after: current.length, missingIds: 0, missingUrls: 0, missingImages: 0, duplicateIds: 0 }, null, 2));
