import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { analyzeProducts } from '../../analysis/analyzeProduct';
import { buildModelFamilies } from '../../modelFamily/buildFamilies';
import { loadModelFamilies } from '../../modelFamily/dataset';
import type { PilotProduct } from '../../collector/types';

const now = '2026-10-03T12:00:00Z';
const product: PilotProduct = { source: 'tkees', brand: 'TKEES', productName: 'Lily Sandal', productUrl: 'https://tkees.test/products/lily',
  imageUrl: 'https://cdn.test/lily.jpg', images: ['https://cdn.test/lily.jpg'], category: 'SANDAL', color: 'black', material: 'leather',
  toeShape: null, heelType: null, heelHeight: null, details: null, discoveredAt: now, isNewArrivalsCollection: false, hasNewBadge: false,
  collectionPath: '/collections/sandals', collectionLabel: 'Sandals' };

describe('independent expansion source delivery', () => {
  it('publishes the valid source after another source fails, retaining every old ID and gallery', async () => {
    const root = await mkdtemp(join(tmpdir(), 'capone-source-isolation-'));
    try {
      for (const dir of ['data/registry', 'src/registry/data', 'data/onboarding/validated', 'data/multibrand/model-families']) await mkdir(join(root, dir), { recursive: true });
      await writeFile(join(root, 'data/registry/brand-universe.json'), await readFile('data/registry/brand-universe.json'));
      const { families } = buildModelFamilies(analyzeProducts([product]));
      const archived = { ...families[0], modelFamilyId: 'tkees-old-archive', variants: [{ ...families[0].variants[0], url: 'https://tkees.test/products/archived', images: ['https://cdn.test/archive.jpg'] }] };
      const old = [families[0], archived];
      const manifest = JSON.parse(await readFile('data/multibrand/model-families/manifest.json', 'utf8'));
      const body = JSON.stringify(old);
      await writeFile(join(root, 'data/multibrand/model-families/part-000.json'), body);
      await writeFile(join(root, 'data/multibrand/model-families/manifest.json'), JSON.stringify({ ...manifest, totalFamilies: 2, shardCount: 1,
        shards: [{ file: 'part-000.json', familyCount: 2, bytes: Buffer.byteLength(body) }] }));
      await writeFile(join(root, 'data/onboarding/validated/expansion-nine-west.json'), JSON.stringify({ generatedAt: now, products: [] }));
      await writeFile(join(root, 'data/onboarding/validated/expansion-tkees.json'), JSON.stringify({ generatedAt: now, products: [{ ...product, images: ['https://cdn.test/new.jpg'] }] }));
      const result = spawnSync(process.execPath, ['--import', resolve('node_modules/tsx/dist/loader.mjs'), resolve('scripts/publish-priority-brands.ts'), 'nine-west', 'tkees'], { cwd: root, encoding: 'utf8', timeout: 30000 });
      expect(result.status, result.stdout + result.stderr).toBe(0);
      const report = JSON.parse(await readFile(join(root, 'data/onboarding/staging/priority-publication/report.json'), 'utf8'));
      expect(report.accepted).toEqual(['tkees']);
      expect(report.preserved[0].id).toBe('nine-west');
      const delivered = await loadModelFamilies({ rootDir: join(root, 'data/multibrand'), allowMonolithFallback: false });
      expect(delivered.map(f => f.modelFamilyId).sort()).toEqual(old.map(f => f.modelFamilyId).sort());
      expect(delivered.find(f => f.modelFamilyId === families[0].modelFamilyId)!.allImages).toEqual(expect.arrayContaining(['https://cdn.test/lily.jpg', 'https://cdn.test/new.jpg']));
      expect(delivered.find(f => f.modelFamilyId === archived.modelFamilyId)!.variants).toEqual(archived.variants);
    } finally { await rm(root, { recursive: true, force: true }); }
  }, 35000);
});
