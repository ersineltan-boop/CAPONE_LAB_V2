import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ModelFamily } from '../modelFamily/types';
import type { PilotProduct } from '../collector/types';
import { mergeCoreFamilyIntoBrandShard } from '../modelFamily/dataset';
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
export async function loadMarketplaceDeliveries(root: string): Promise<MarketplaceDelivery[]> {
  const names = await readdir(directory(root)).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  return Promise.all(names.filter(name => /^[a-z0-9-]+\.json$/.test(name)).sort().map(async name =>
    JSON.parse(await readFile(join(directory(root), name), 'utf8')) as MarketplaceDelivery));
}
export function applyMarketplaceDeliveries(base: ModelFamily[], deliveries: MarketplaceDelivery[]): ModelFamily[] {
  let result = base;
  for (const delivery of deliveries) {
    const origin = new URL(delivery.origin).hostname.replace(/^www\./, '');
    const belongs = (url: string) => {try{return new URL(url).hostname.replace(/^www\./, '') === origin;}catch{return false;}};
    // Remove only this source's older evidence, retaining every other source.
    const retained = result.flatMap(family => {
      const variants = family.variants.filter(v => !belongs(v.url));
      if (!variants.length) return [];
      if (variants.length === family.variants.length) return [family];
      const images = [...new Set(variants.flatMap(v => v.images))];
      return [{...family, variants, variantCount: variants.length, sourceProductIds: variants.map(v => v.productId),
        representativeProductId: variants[0].productId, representativeImage: images[0] ?? null,
        representativeImages: images, allImages: images,
        sourceSightings: family.sourceSightings?.filter(s => s.sourceId !== delivery.sourceId),
        sourceCategoryRefs: family.sourceCategoryRefs?.filter(s => s.sourceId !== delivery.sourceId)}];
    });
    const byId = new Map(retained.map(f => [f.modelFamilyId, f]));
    for (const family of delivery.families) {
      const prior = byId.get(family.modelFamilyId);
      byId.set(family.modelFamilyId, prior ? mergeCoreFamilyIntoBrandShard(prior, family) : family);
    }
    result = [...byId.values()];
  }
  return result;
}
export async function publishMarketplaceDelivery(root: string, candidate: MarketplaceRefreshCandidate, origin: string) {
  const previous = (await loadMarketplaceDeliveries(root)).find(d => d.sourceId === candidate.sourceId);
  const decision = evaluateMarketplaceCandidate({candidate, previousLastGood: previous?.products ?? []});
  if (!decision.report.accepted) return decision;
  const products = replaceVerifiedMarketplaceCatalog({existing: previous?.products ?? [], sourceId: candidate.sourceId,
    verified: decision.eligibleProducts, preserveMissing: decision.report.publicationCoverage === 'PARTIAL'});
  const {families} = buildModelFamilies(analyzeProducts(products as never) as never, {priorFamilies: previous?.families ?? []});
  if (!families.length || families.some(f => !f.primaryCategory || f.primaryCategory === 'UNCLASSIFIED')) {
    throw new Error('Marketplace delivery contains unresolved model families; previous delivery preserved');
  }
  const delivery: MarketplaceDelivery = {sourceId:candidate.sourceId, origin, updatedAt:new Date().toISOString(), products,
    families, report:decision.report, quarantined:decision.quarantined};
  await mkdir(directory(root), {recursive:true});
  const path=join(directory(root),`${candidate.sourceId}.json`);
  await writeFile(path+'.tmp',JSON.stringify(delivery));await rename(path+'.tmp',path);
  return decision;
}
