import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const sources = new Set(['coperni', 'moon-boot', 'pazzion']);

/** Replay the approved additive delivery without overwriting later source refreshes. */
export function mergeApprovedDelivery(existing, delivery) {
  const byUrl = new Map(existing.map(record => [record.productUrl, record]));
  const result = existing.map(record => ({ ...record }));
  const patchByUrl = new Map(delivery.palomaCategories.map(patch => [patch.productUrl, patch]));
  for (const record of result) {
    const patch = patchByUrl.get(record.productUrl);
    if (record.source !== 'paloma-wool' || !patch || record.category !== patch.previousCategory) continue;
    record.category = patch.category;
    if (patch.normalized) record.normalized = patch.normalized;
  }
  // Once a source has been refreshed, its current catalog is authoritative.
  const deliveredSources = new Set(existing.map(record => record.source));
  for (const record of delivery.additions) {
    if (!sources.has(record.source)) throw new Error('Unapproved delivery source');
    if (!deliveredSources.has(record.source) && !byUrl.has(record.productUrl)) {
      result.push(record);
      byUrl.set(record.productUrl, record);
    }
  }
  return result;
}

export async function hydrateExistingBrandDelivery(root) {
  for (const name of ['products', 'analyzed-products']) {
    const path = join(root, 'data/multibrand', `${name}.json`);
    const existing = JSON.parse(await readFile(path, 'utf8'));
    const delivery = JSON.parse(await readFile(join(root, 'data/brands/existing-wave', `${name}.json`), 'utf8'));
    const merged = mergeApprovedDelivery(existing, delivery);
    if (JSON.stringify(existing) === JSON.stringify(merged)) continue;
    await writeFile(path, `[\n${merged.map(record => JSON.stringify(record)).join(',\n')}\n]\n`);
    console.log(`Approved brand delivery: ${name} ${existing.length} -> ${merged.length}`);
  }
  const patches = JSON.parse(await readFile(join(root, 'data/brands/existing-wave/model-categories.json'), 'utf8'));
  const byId = new Map(patches.map(patch => [patch.modelFamilyId, patch]));
  const dir = join(root, 'data/multibrand/model-families');
  const manifestPath = join(dir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  let manifestChanged = false;
  for (const shard of manifest.shards) {
    const path = join(dir, shard.file);
    const families = JSON.parse(await readFile(path, 'utf8'));
    let changed = false;
    for (const family of families) {
      const patch = byId.get(family.modelFamilyId);
      if (family.brand !== 'PALOMA WOOL' || !patch || family.category !== patch.previousCategory) continue;
      for (const key of ['category', 'primaryCategory', 'taxonomy']) family[key] = patch[key];
      changed = true;
    }
    if (changed) {
      const text = JSON.stringify(families);
      await writeFile(path, text);
      shard.bytes = Buffer.byteLength(text);
      manifestChanged = true;
    }
  }
  if (manifestChanged) await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await hydrateExistingBrandDelivery(fileURLToPath(new URL('../', import.meta.url)));
}
