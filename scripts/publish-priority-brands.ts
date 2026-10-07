import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { loadModelFamilies } from '../src/modelFamily/dataset';
import { mergePriorityBrandDelivery } from '../src/refresh/priorityDelivery';
import { replaceAutomationBrandDeliveries } from '../src/brands/automation/delivery';
import { transactionalRefreshLane } from '../src/refresh/transactionalLane';
import { auditFootwearLeakage, evaluateQualityGate } from '../src/onboarding/validate';
import { buildBrandRegistryFromUniverseData } from '../src/registry/build/buildBrandRegistry';
import { emptyProbeCache } from '../src/registry/build/probeCache';
import { BRANDS_TS_PATH, UNIVERSE_PATH, UNIVERSE_REPORT_PATH } from '../src/onboarding/policy';

const read = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const write = async (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
const requested = process.argv.slice(2);
const priorityFiles: Record<string, string> = { 'massimo-dutti': 'massimo-dutti', 'ala-a': 'luxury-ala-a', 'maison-margiela': 'luxury-maison-margiela' };
const targets = requested.length ? requested : Object.keys(priorityFiles);
const approved = await read(UNIVERSE_PATH);
if (targets.some(id => !approved.brands.some((brand: any) => brand.id === id))) throw new Error('Unknown brand');
const protectedPaths = ['data/multibrand/model-families', UNIVERSE_PATH, UNIVERSE_REPORT_PATH, BRANDS_TS_PATH, 'data/registry/priority-brand-coverage.json'];
const accepted: string[] = [];
const preserved: Array<{ id: string; reason: string }> = [];
for (const id of targets) {
  let reason = 'Publication failed';
  const succeeded = await transactionalRefreshLane(process.cwd(), protectedPaths, async () => {
    try {
      const universe = await read(UNIVERSE_PATH);
      const entry = universe.brands.find((brand: any) => brand.id === id);
      const snapshot = await read(`data/onboarding/validated/${priorityFiles[id] ?? `expansion-${id}`}.json`);
      const rejected = new Set(auditFootwearLeakage(snapshot.products));
      const products = snapshot.products.filter((product: any) => !rejected.has(product.productUrl) && product.imageUrl);
      const quality = evaluateQualityGate(products);
      if (!quality.ok) throw new Error(quality.reasons.join('; '));
      const all = await loadModelFamilies({ rootDir: 'data/multibrand', allowMonolithFallback: false });
      if (!all.length) throw new Error('Complete preceding model catalog is required');
      const prior = all.filter(family => family.brand.trim().toUpperCase() === entry.brand.trim().toUpperCase());
      const collectedAt = snapshot.generatedAt ?? snapshot.collectedAt;
      if (!collectedAt || !Number.isFinite(Date.parse(collectedAt))) throw new Error('Fresh snapshot timestamp required');
      const delivered = mergePriorityBrandDelivery(prior, products, { id, brand: entry.brand, officialUrl: entry.officialUrl ?? '', collectedAt });
      if (!delivered.length) throw new Error('Empty delivery');
      if (delivered.some(family => !family.primaryCategory || family.primaryCategory === 'UNCLASSIFIED')) throw new Error('Unresolved model category');
      await replaceAutomationBrandDeliveries({ root: process.cwd(), generatedAt: collectedAt,
        deliveries: [{ slug: id, brand: entry.brand, officialUrl: entry.officialUrl ?? '', collectedAt, families: delivered }] });
      const full = id === 'massimo-dutti' && snapshot.paginationExhausted === true &&
        Array.isArray(snapshot.errors) && snapshot.errors.length === 0 &&
        snapshot.collectedThisRun > 0 && snapshot.collectedThisRun === snapshot.sourceReportedProductCount && rejected.size === 0;
      const status = full ? 'FULL' : 'PARTIAL';
      entry.isActive = true; entry.collectorType = 'CUSTOM_ADAPTER'; entry.collectionStatus = 'NEEDS_PROBE';
      entry.notes = full
        ? `Verified FULL official catalog: ${snapshot.collectedThisRun} fresh products; preceding archive retained.`
        : `Verified PARTIAL official catalog: ${products.length} products. Dedicated priority-source collector; full coverage not confirmed.`;
      const coverage: Record<string, unknown> = await read('data/registry/priority-brand-coverage.json').catch((error) => {
        if (error.code === 'ENOENT') return {}; throw error;
      });
      coverage[id] = { status, ready: full ? snapshot.collectedThisRun : products.length, pending: Math.max(0, (snapshot.sourceReportedProductCount ?? products.length) - products.length),
        totalKnown: typeof snapshot.sourceReportedProductCount === 'number', quarantined: rejected.size, updatedAt: collectedAt };
      const built = buildBrandRegistryFromUniverseData({ universeFile: universe, probeCache: emptyProbeCache() });
      if (!built.ok || !built.brandsTsContent) throw new Error('Registry build failed');
      await write(UNIVERSE_PATH, universe); await writeFile(BRANDS_TS_PATH, built.brandsTsContent); await write(UNIVERSE_REPORT_PATH, built.report);
      await write('data/registry/priority-brand-coverage.json', coverage);
      console.log(id, products.length, 'products', delivered.length, 'models', rejected.size, 'quarantined');
      return true;
    } catch (error) { reason = error instanceof Error ? error.message : String(error); return false; }
  });
  if (succeeded) accepted.push(id); else preserved.push({ id, reason });
}
await mkdir('data/onboarding/staging/priority-publication', { recursive: true });
await write('data/onboarding/staging/priority-publication/report.json', { generatedAt: new Date().toISOString(), accepted, preserved });
if (!accepted.length) throw new Error('NO_UPDATE: all source deliveries preserved');
