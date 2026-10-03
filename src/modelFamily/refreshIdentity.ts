import type { ModelFamily, ModelFamilyVariant, RawAnalyzedProduct } from "./types";
import { enrichFamilyWithSightings } from "../newArrivals/sourceSightings";
import { createNotVerifiedNewness } from "../newArrivals/newness";
import { mergeSourceNewness } from "../newArrivals/detectNewness";

/** Only an identical source product URL can anchor a changed collector group. */
export function refreshUrlKey(value: string): string {
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

export function withFamilyVariants(family: ModelFamily, variants: ModelFamilyVariant[]): ModelFamily {
  const images = [...new Set(variants.flatMap((variant) => variant.images).filter(Boolean))];
  return { ...family, variants, variantCount: variants.length,
    sourceProductIds: variants.map((variant) => variant.productId),
    representativeProductId: variants[0]?.productId ?? family.modelFamilyId,
    representativeImage: images[0] ?? null, representativeImages: images, allImages: images };
}

/**
 * A collector may join or split old groups. Partition its variants back onto
 * every pre-existing identity instead of merging those cards or dropping IDs.
 * Pre-existing URL overlaps are retained; they never create another new card.
 */
export function anchorRefreshFamilies(previous: readonly ModelFamily[], incoming: readonly ModelFamily[]): ModelFamily[] {
  const byUrl = new Map<string, ModelFamily[]>();
  const previousIds = new Set(previous.map((family) => family.modelFamilyId));
  for (const family of previous) {
    for (const variant of family.variants ?? []) {
      const key = `${family.brand.trim().toUpperCase()}|${refreshUrlKey(variant.url)}`;
      const matches = byUrl.get(key) ?? [];
      if (!matches.some((match) => match.modelFamilyId === family.modelFamilyId)) matches.push(family);
      byUrl.set(key, matches);
    }
  }
  return incoming.flatMap((fresh) => {
    const buckets = new Map<string, { old: ModelFamily; variants: ModelFamilyVariant[] }>();
    const unmatched: ModelFamilyVariant[] = [];
    for (const variant of fresh.variants ?? []) {
      const matches = byUrl.get(`${fresh.brand.trim().toUpperCase()}|${refreshUrlKey(variant.url)}`) ?? [];
      if (!matches.length) unmatched.push(variant);
      for (const old of matches) {
        const bucket = buckets.get(old.modelFamilyId) ?? { old, variants: [] };
        bucket.variants.push(variant);
        buckets.set(old.modelFamilyId, bucket);
      }
    }
    if (!buckets.size) return [fresh];
    if (buckets.size === 1) {
      const bucket = [...buckets.values()][0]!;
      bucket.variants.push(...unmatched);
      unmatched.length = 0;
    }
    const result: ModelFamily[] = [...buckets.entries()].map(([id, bucket]) => ({
      ...withFamilyVariants(fresh, bucket.variants), modelFamilyId: id,
      canonicalName: bucket.old.canonicalName,
      // Group-level classification must not overwrite a different old silhouette.
      primaryCategory: bucket.old.primaryCategory && bucket.old.primaryCategory !== "UNCLASSIFIED"
        ? bucket.old.primaryCategory : fresh.primaryCategory,
      category: bucket.old.primaryCategory && bucket.old.primaryCategory !== "UNCLASSIFIED"
        ? bucket.old.category : fresh.category,
      taxonomy: bucket.old.primaryCategory && bucket.old.primaryCategory !== "UNCLASSIFIED"
        ? bucket.old.taxonomy : fresh.taxonomy,
    }));
    if (unmatched.length) {
      let id = fresh.modelFamilyId;
      while (previousIds.has(id)) id += "--fresh";
      result.push({ ...withFamilyVariants(fresh, unmatched), modelFamilyId: id });
    }
    return result;
  });
}

/** Rebuilds refresh observations; absent records remain in the research archive. */
export function retainModelFamilyArchive(rebuilt: readonly ModelFamily[], previous: readonly ModelFamily[], products: readonly RawAnalyzedProduct[] = []): ModelFamily[] {
  const productLookup = new Map(products.map(product => [`${product.brand.trim().toUpperCase()}|${refreshUrlKey(product.productUrl)}`, product]));
  const byId = new Map<string, ModelFamily>();
  const oldById = new Map(previous.map((family) => [family.modelFamilyId, family]));
  for (const anchored of anchorRefreshFamilies(previous, rebuilt)) {
    const observed = anchored.variants.flatMap(variant => {
      const product = productLookup.get(`${anchored.brand.trim().toUpperCase()}|${refreshUrlKey(variant.url)}`);
      return product ? [product] : [];
    });
    const fresh = observed.length ? { ...anchored, ...enrichFamilyWithSightings(anchored, observed) } : anchored;
    const old = byId.get(fresh.modelFamilyId) ?? oldById.get(fresh.modelFamilyId);
    if (!old) { byId.set(fresh.modelFamilyId, fresh); continue; }
    const variants = new Map<string, ModelFamilyVariant>();
    for (const variant of [...(fresh.variants ?? []), ...(old.variants ?? [])]) {
      const key = refreshUrlKey(variant.url);
      const prior = variants.get(key);
      variants.set(key, prior ? { ...prior, images: [...new Set([...prior.images, ...variant.images])] } : variant);
    }
    const sightings = new Map((old.sourceSightings ?? []).map((sighting) => [`${sighting.sourceKind}:${sighting.sourceId}`, sighting]));
    for (const sighting of fresh.sourceSightings ?? []) {
      const key = `${sighting.sourceKind}:${sighting.sourceId}`;
      const prior = sightings.get(key);
      sightings.set(key, { ...sighting, firstSeenAt: prior?.firstSeenAt ?? sighting.firstSeenAt,
        newness: mergeSourceNewness(prior?.newness, sighting.newness ?? createNotVerifiedNewness(), sighting.lastSeenAt) });
    }
    const refs = [...(fresh.sourceCategoryRefs ?? []), ...(old.sourceCategoryRefs ?? [])];
    byId.set(fresh.modelFamilyId, { ...withFamilyVariants(fresh, [...variants.values()]),
      modelFamilyFirstSeenAt: old.modelFamilyFirstSeenAt ?? fresh.modelFamilyFirstSeenAt,
      sourceSightings: [...sightings.values()],
      sourceCategoryRefs: refs.filter((ref, index) => refs.findIndex((other) => other.sourceId === ref.sourceId && other.categoryId === ref.categoryId) === index) });
  }
  for (const old of previous) if (!byId.has(old.modelFamilyId)) byId.set(old.modelFamilyId, old);
  return [...byId.values()];
}
