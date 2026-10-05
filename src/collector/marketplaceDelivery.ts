import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { ModelFamily } from '../modelFamily/types';
import type { PilotProduct } from '../collector/types';
import { loadModelFamilies } from '../modelFamily/dataset';
import { retainModelFamilyArchive, withFamilyVariants } from '../modelFamily/refreshIdentity';
import { analyzeProducts } from '../analysis/analyzeProduct';
import { buildModelFamilies } from '../modelFamily/buildFamilies';
import { evaluateMarketplaceCandidate, replaceVerifiedMarketplaceCatalog, type MarketplaceRefreshCandidate, type MarketplaceGateReport } from '../marketplaces/automation';

export interface MarketplaceDelivery {
  sourceId: string;
  origin: string;
  updatedAt: string;
  products: PilotProduct[];
  families: ModelFamily[];
  report: MarketplaceGateReport;
  quarantined: Array<{product: PilotProduct; reasons: string[]}>;
}
const directory = (root: string) => join(root, 'data/multibrand/model-families/marketplaces');
const MAX_DELIVERY_PART_BYTES = 6 * 1024 * 1024;
export async function readMarketplaceDelivery(path: string): Promise<MarketplaceDelivery> {
  const stored = JSON.parse(await readFile(path, 'utf8'));
  if (stored.schema !== 'capone.marketplace-delivery.parts.v1') return stored;
  const products: PilotProduct[] = [];
  const families: ModelFamily[] = [];
  for (const part of stored.parts) {
    if (!/^[a-z0-9-]+\/(?:products|families)-\d+-[a-f0-9]{12}\.json$/.test(part.file) ||
      !['products', 'families'].includes(part.field)) throw new Error('Invalid marketplace delivery part');
    const body = await readFile(join(path, '..', part.file), 'utf8');
    if (!part.file.includes(createHash('sha256').update(body).digest('hex').slice(0, 12))) throw new Error('Marketplace delivery part checksum mismatch');
    const rows = JSON.parse(body);
    if (!Array.isArray(rows) || rows.length !== part.count) throw new Error('Marketplace delivery part count mismatch');
    if (part.field === 'products') products.push(...rows); else families.push(...rows);
  }
  const {schema, parts, ...metadata} = stored;
  return {...metadata, products, families};
}
export async function writeMarketplaceDelivery(root: string, delivery: MarketplaceDelivery): Promise<void> {
  const dir = directory(root);
  await mkdir(dir, {recursive: true});
  const path = join(dir, `${delivery.sourceId}.json`);
  let body = JSON.stringify(delivery);
  if (Buffer.byteLength(body) > MAX_DELIVERY_PART_BYTES) {
    await mkdir(join(dir, delivery.sourceId), {recursive: true});
    const parts: Array<{field: string; file: string; count: number}> = [];
    for (const field of ['products', 'families'] as const) {
      let rows: string[] = [], bytes = 2, index = 0;
      const flush = async () => {
        if (!rows.length) return;
        const text = `[${rows.join(',')}]`;
        const hash = createHash('sha256').update(text).digest('hex').slice(0, 12);
        const file = `${delivery.sourceId}/${field}-${index++}-${hash}.json`;
        // Content-addressed parts never overwrite the currently referenced archive.
        await writeFile(join(dir, file), text);
        parts.push({field, file, count: rows.length}); rows = []; bytes = 2;
      };
      for (const row of delivery[field]) {
        const text = JSON.stringify(row), size = Buffer.byteLength(text) + 1;
        if (size + 2 > MAX_DELIVERY_PART_BYTES) throw new Error('Marketplace record exceeds delivery part size');
        if (bytes + size > MAX_DELIVERY_PART_BYTES) await flush();
        rows.push(text); bytes += size;
      }
      await flush();
    }
    const {products, families, ...metadata} = delivery;
    body = JSON.stringify({...metadata, schema: 'capone.marketplace-delivery.parts.v1', parts});
  }
  await writeFile(path + '.tmp', body); await rename(path + '.tmp', path);
}
export async function loadMarketplaceDeliveries(root: string): Promise<MarketplaceDelivery[]> {
  const names = await readdir(directory(root)).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  return Promise.all(names.filter(name => /^[a-z0-9-]+\.json$/.test(name)).sort().map(name =>
    readMarketplaceDelivery(join(directory(root), name))));
}
export function applyMarketplaceDeliveries(base: ModelFamily[], deliveries: MarketplaceDelivery[]): ModelFamily[] {
  let result = base;
  for (const delivery of deliveries) {
    // Identical URLs anchor refreshed groups; removed URLs/models stay archived.
    result = retainModelFamilyArchive(delivery.families, result);
  }
  return result;
}
export async function publishMarketplaceDelivery(root: string, candidate: MarketplaceRefreshCandidate, origin: string) {
  const previous = (await loadMarketplaceDeliveries(root)).find(d => d.sourceId === candidate.sourceId);
  const core = JSON.parse(await readFile(join(root, 'data/multibrand/products.json'), 'utf8')) as PilotProduct[];
  const priorProducts: PilotProduct[] = previous?.products ?? core
    .filter(product => product.source === candidate.sourceId);
  const belongs = (url: string) => {try{return new URL(url).hostname.replace(/^www\./, '') === new URL(origin).hostname.replace(/^www\./, '');}catch{return false;}};
  const decision = evaluateMarketplaceCandidate({candidate, previousLastGood: [
    ...core.filter(product => product.source !== candidate.sourceId), ...priorProducts]});
  if (!decision.report.accepted) return decision;
  const priorFamilies = previous?.families ?? (await loadModelFamilies({rootDir: join(root, 'data/multibrand')}))
    .filter(family => family.variants.some(variant => belongs(variant.url)))
    .map(family => ({...withFamilyVariants(family, family.variants.filter(variant => belongs(variant.url))),
      sourceSightings: family.sourceSightings?.filter(sighting => sighting.sourceId === candidate.sourceId),
      sourceCategoryRefs: family.sourceCategoryRefs?.filter(ref => ref.sourceId === candidate.sourceId)}));
  const current = new Map(decision.eligibleProducts.map(product => [product.productUrl, product]));
  const old = new Map(priorProducts.map(product => [product.productUrl, product]));
  const products = replaceVerifiedMarketplaceCatalog({existing: priorProducts, sourceId: candidate.sourceId,
    verified: decision.eligibleProducts, preserveMissing: true}).map(product => {
      const observed = current.get(product.productUrl);
      if (!candidate.newnessVerified) {
        const before = old.get(product.productUrl);
        return before ? {...product, isNewArrivalsCollection: before.isNewArrivalsCollection, hasNewBadge: before.hasNewBadge} : product;
      }
      return {...product, isNewArrivalsCollection: observed?.isNewArrivalsCollection ?? false,
        hasNewBadge: observed?.hasNewBadge ?? false};
    });
  const updatedAt = new Date().toISOString();
  const analyzed = analyzeProducts(products.map(product => current.has(product.productUrl) ? {...product, discoveredAt: updatedAt} : product) as never);
  const rebuilt = buildModelFamilies(analyzed as never, {priorFamilies}).families;
  const families = retainModelFamilyArchive(rebuilt, priorFamilies, analyzed as never);
  const oldIds = new Set(priorFamilies.map(family => family.modelFamilyId));
  if (!families.length || families.some(f => !oldIds.has(f.modelFamilyId) && (!f.primaryCategory || f.primaryCategory === 'UNCLASSIFIED'))) {
    throw new Error('Marketplace delivery contains unresolved model families; previous delivery preserved');
  }
  decision.report.lastGoodPreserved = true;
  const delivery: MarketplaceDelivery = {sourceId:candidate.sourceId, origin, updatedAt, products,
    families, report:decision.report, quarantined:decision.quarantined};
  await writeMarketplaceDelivery(root, delivery);
  return decision;
}
