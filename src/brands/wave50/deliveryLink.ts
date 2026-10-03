import type { ModelFamily, ModelFamilyVariant } from "../../modelFamily/types";
import type { PrimaryFootwearCategory } from "../../taxonomy/types";
import { classifyOfficialFootwear, isNonFootwearCatalogItem, legacyCategoryForPrimary } from "./primaryCategory";

export function productUrlKey(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

export function collectProductUrlKeys(families: readonly ModelFamily[]): Set<string> {
  const seen = new Set<string>();
  for (const family of families) {
    for (const variant of family.variants) {
      if (variant.url) seen.add(productUrlKey(variant.url));
    }
    for (const id of family.sourceProductIds ?? []) seen.add(productUrlKey(id));
  }
  return seen;
}

function imagesOf(variants: readonly ModelFamilyVariant[]): string[] {
  const seen = new Set<string>();
  const images: string[] = [];
  for (const variant of variants) {
    for (const image of variant.images) {
      const trimmed = image.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      images.push(trimmed);
    }
  }
  return images;
}

function withFreshVariants(family: ModelFamily, fresh: ModelFamilyVariant[]): ModelFamily {
  const images = imagesOf(fresh);
  return {
    ...family,
    variants: fresh,
    variantCount: fresh.length,
    sourceProductIds: fresh.map((variant) => variant.productId),
    representativeProductId: fresh[0]?.productId ?? family.modelFamilyId,
    representativeImage: images[0] ?? null,
    representativeImages: images,
    allImages: images,
  };
}

/**
 * Drop variants whose product URL is already stored in an earlier shard.
 * Families with no remaining variants are removed.
 */
export function removeDuplicateVariants(
  delivered: readonly ModelFamily[],
  families: readonly ModelFamily[],
): ModelFamily[] {
  const seen = collectProductUrlKeys(delivered);
  const kept: ModelFamily[] = [];
  for (const family of families) {
    const fresh = family.variants.filter((variant) => variant.url && !seen.has(productUrlKey(variant.url)));
    if (fresh.length === 0) continue;
    kept.push(fresh.length === family.variants.length ? family : withFreshVariants(family, fresh));
  }
  return kept;
}

export function omitNonFootwearFamilies(families: readonly ModelFamily[]): ModelFamily[] {
  const kept: ModelFamily[] = [];
  for (const family of families) {
    const fresh = family.variants.filter((variant) => !isNonFootwearCatalogItem({ title: variant.title }));
    if (fresh.length === 0) continue;
    kept.push(fresh.length === family.variants.length ? family : withFreshVariants(family, fresh));
  }
  return kept;
}

/**
 * Keep official catalog families that are not already on a brand page.
 * Existing product URLs stay in their current shards and are not copied.
 */
export function familiesMissingFromDelivery(
  existing: readonly ModelFamily[],
  incoming: readonly ModelFamily[],
): ModelFamily[] {
  const seen = collectProductUrlKeys(existing);
  const ids = new Set(existing.map((family) => family.modelFamilyId));
  const added: ModelFamily[] = [];

  for (const family of incoming) {
    const fresh = family.variants.filter((variant) => variant.url && !seen.has(productUrlKey(variant.url)));
    if (fresh.length === 0) continue;
    let modelFamilyId = family.modelFamilyId;
    while (ids.has(modelFamilyId)) modelFamilyId = `${modelFamilyId}--wave`;
    ids.add(modelFamilyId);
    for (const variant of fresh) seen.add(productUrlKey(variant.url));
    added.push({
      ...withFreshVariants(family, fresh),
      modelFamilyId,
      representativeProductId: fresh[0]?.productId ?? modelFamilyId,
    });
  }
  return added;
}

export function reclassifyWaveFamily(
  family: ModelFamily,
  descriptionOrOptions?: string | null | { description?: string | null; tags?: string | null; title?: string; productType?: string },
): ModelFamily {
  if ((family.primaryCategory ?? "UNCLASSIFIED") !== "UNCLASSIFIED") return family;
  const options =
    typeof descriptionOrOptions === "object" && descriptionOrOptions !== null
      ? descriptionOrOptions
      : { description: descriptionOrOptions ?? null };
  const sourceName = family.sourceSightings?.[0]?.sourceCategories?.[0]?.categoryName ?? null;
  const title = family.variants[0]?.title ?? family.canonicalName;
  const primary = classifyOfficialFootwear({
    title: options.title ?? title,
    productType: options.productType ?? sourceName,
    description: options.description,
    tags: options.tags,
  });
  if (!primary || primary === "UNCLASSIFIED") return family;
  return {
    ...family,
    primaryCategory: primary,
    category: family.category === "OTHER_FOOTWEAR" || family.category == null
      ? legacyCategoryForPrimary(primary)
      : family.category,
  };
}

export function countClassified(families: readonly ModelFamily[]): Record<PrimaryFootwearCategory, number> {
  const counts = {
    BALLET_FLAT: 0,
    LOAFER: 0,
    PUMP: 0,
    SANDAL: 0,
    MULE: 0,
    BOOT: 0,
    SNEAKER: 0,
    ESPADRILLE: 0,
    OXFORD_DERBY: 0,
    CLOG: 0,
    UNCLASSIFIED: 0,
  } satisfies Record<PrimaryFootwearCategory, number>;
  for (const family of families) {
    const category = family.primaryCategory ?? "UNCLASSIFIED";
    counts[category] += 1;
  }
  return counts;
}
