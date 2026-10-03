import { describe, expect, it } from 'vitest';
import type { ModelFamily, ModelFamilyVariant } from '../../modelFamily/types';
import { anchorRefreshFamilies, retainModelFamilyArchive } from '../../modelFamily/refreshIdentity';
import { applySourceAwareBrandReplacement, waveProductNewness } from '../../brands/automation/delivery';
import { createNotVerifiedNewness } from '../../newArrivals/newness';

const now = '2026-10-03T12:00:00Z';
const variant = (handle: string, image = handle): ModelFamilyVariant => ({ productId: handle, title: handle,
  url: `https://brand.test/products/${handle}`, color: null, material: null, images: [`https://cdn.test/${image}.jpg`] });
const family = (id: string, variants: ModelFamilyVariant[], primaryCategory: ModelFamily['primaryCategory'] = 'LOAFER'): ModelFamily => ({
  modelFamilyId: id, brand: 'BRAND', canonicalName: id, category: primaryCategory === 'MULE' ? 'MULE' : 'LOAFER', primaryCategory,
  variants, variantCount: variants.length, sourceProductIds: variants.map(v => v.productId), representativeProductId: variants[0]?.productId ?? id,
  representativeImage: variants[0]?.images[0] ?? null, representativeImages: variants.flatMap(v => v.images), allImages: variants.flatMap(v => v.images),
  groupingConfidence: 'HIGH', groupingReason: 'test', sourceSightings: [{ sourceId: 'brand', sourceKind: 'BRAND_OFFICIAL', sourceLabel: 'BRAND',
    firstSeenAt: now, lastSeenAt: now, newness: createNotVerifiedNewness() }],
});

describe('stable refresh archive identities', () => {
  it('partitions a newly joined collector group back to distinct old models and silhouettes', () => {
    const loafer = family('old-loafer', [variant('loafer')]);
    const mule = family('old-mule', [variant('mule')], 'MULE');
    const fresh = family('fresh-group', [variant('loafer', 'loafer-new'), variant('mule', 'mule-new')]);
    const result = applySourceAwareBrandReplacement([loafer, mule], { slug: 'brand', brand: 'BRAND', officialUrl: 'https://brand.test', families: [fresh] });
    expect(result.core).toHaveLength(0);
    expect(result.brandShard.map(f => f.modelFamilyId)).toEqual(['old-loafer', 'old-mule']);
    expect(result.brandShard.map(f => f.primaryCategory)).toEqual(['LOAFER', 'MULE']);
    expect(result.brandShard[0].variants.map(v => v.url)).toEqual([loafer.variants[0].url]);
    expect(result.brandShard[1].allImages).toEqual(expect.arrayContaining(['https://cdn.test/mule.jpg', 'https://cdn.test/mule-new.jpg']));
    expect(applySourceAwareBrandReplacement(result.brandShard, { slug: 'brand', brand: 'BRAND', officialUrl: 'https://brand.test', families: [fresh] }).brandShard).toEqual(result.brandShard);
  });
  it('preserves pre-existing overlapping archive IDs without creating another card', () => {
    const single = family('single', [variant('black')]);
    const colorGroup = family('colors', [variant('black'), variant('gold')]);
    const result = anchorRefreshFamilies([single, colorGroup], [family('new-group', [variant('black'), variant('gold')])]);
    expect(result.map(f => f.modelFamilyId)).toEqual(['single', 'colors']);
    expect(result[0].variants).toHaveLength(1);
    expect(result[1].variants).toHaveLength(2);
  });
  it('updates NEW independently for old cards joined by the new collector', () => {
    const old = [family('black', [variant('black')]), family('white', [variant('white')])];
    const fresh = family('joined', [variant('black'), variant('white')]);
    const verified = { status: 'VERIFIED_NEW' as const, evidenceType: 'NEW_ARRIVALS_COLLECTION' as const, firstVerifiedAt: now, lastVerifiedAt: now, effectiveNewAt: now };
    fresh.sourceSightings![0].newness = verified;
    const result = applySourceAwareBrandReplacement(old, { slug: 'brand', brand: 'BRAND', officialUrl: 'https://brand.test', families: [fresh],
      productNewness: new Map<string, import('../../newArrivals/newness').SourceNewness>([[old[0].variants[0].url, verified], [old[1].variants[0].url, createNotVerifiedNewness()]]) });
    expect(result.brandShard.map(f => f.sourceSightings![0].newness.status)).toEqual(['VERIFIED_NEW', 'NOT_VERIFIED']);
  });
  it('normalizes source badges and excludes catalog-diff evidence from NEW', () => {
    const catalog = { collectedAt: now, families: [{ variants: [
      { productUrl: 'https://brand.test/products/badge', isNew: true, newnessEvidence: 'SOURCE_BADGE' },
      { productUrl: 'https://brand.test/products/diff', isNew: true, newnessEvidence: 'CATALOG_DIFF' },
    ] }] } as unknown as import('../../brands/wave50/types').WaveCatalog;
    const newness = waveProductNewness(catalog);
    expect(newness.get('https://brand.test/products/badge')!.evidenceType).toBe('NEW_BADGE');
    expect(newness.get('https://brand.test/products/diff')!.status).toBe('NOT_VERIFIED');
  });
  it('retains absent archived models and images while anchoring a regrouped rebuild', () => {
    const old = [family('paloma-anastasia', [variant('anastasia')]), family('paloma-tall-jacinta', [variant('jacinta')]), family('proenza-crochet-mule', [variant('crochet')], 'MULE')];
    const rebuilt = [family('changed-anastasia-id', [variant('anastasia', 'new-photo')])];
    const result = retainModelFamilyArchive(rebuilt, old);
    expect(result.map(f => f.modelFamilyId)).toEqual(old.map(f => f.modelFamilyId));
    expect(result[0].allImages).toEqual(expect.arrayContaining(['https://cdn.test/new-photo.jpg', 'https://cdn.test/anastasia.jpg']));
    expect(result[1]).toEqual(old[1]);
    expect(result[2]).toEqual(old[2]);
  });
  it('does not anchor another brand or match only by model name', () => {
    const old = family('archive', [variant('old')]);
    const other = { ...family('other-brand', [variant('old')]), brand: 'OTHER' };
    const renamed = family('new-name', [variant('different')]);
    expect(anchorRefreshFamilies([old], [other, renamed])).toEqual([other, renamed]);
  });
});
