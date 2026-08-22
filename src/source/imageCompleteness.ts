import type { PilotProduct } from "../collector/types";
import type { ModelFamily } from "../modelFamily/types";
import { collectModelFamilyImages } from "../modelFamily/familyImages";
import { normalizeProductImageUrls } from "../images/resolveImageQuality";
import { slugifyBrandId } from "./sourceProductQuery";

export type ImageCoverageFailureOrigin =
  | "COLLECTOR"
  | "MODEL_FAMILY_MERGE"
  | "FRONTEND_SHARD"
  | "UI_CAROUSEL"
  | "UNKNOWN";

export interface BrandImageCoverageEntry {
  brandId: string;
  brandName: string;
  products: number;
  productsWith1Image: number;
  productsWith2PlusImages: number;
  productsWith3PlusImages: number;
  averageUniqueImages: number;
  collectorAverage: number;
  familyAverage: number;
  shardAverage: number | null;
  knownFailures: Array<{
    productUrl?: string;
    modelFamilyId?: string;
    origin: ImageCoverageFailureOrigin;
    collectorCount: number;
    familyCount: number;
    shardCount: number | null;
  }>;
}

function uniqueCount(urls: Array<string | null | undefined>): number {
  return normalizeProductImageUrls(urls).length;
}

export function classifyImageGap(input: {
  collectorCount: number;
  familyCount: number;
  shardCount: number | null;
}): ImageCoverageFailureOrigin {
  if (input.collectorCount <= 1 && input.familyCount <= 1) return "COLLECTOR";
  if (input.collectorCount >= 2 && input.familyCount <= 1) return "MODEL_FAMILY_MERGE";
  if (input.familyCount >= 2 && input.shardCount != null && input.shardCount <= 1) {
    return "FRONTEND_SHARD";
  }
  return "UNKNOWN";
}

export function buildBrandImageCoverage(input: {
  brandId: string;
  brandName: string;
  products: PilotProduct[];
  families: ModelFamily[];
  shardFamilies?: ModelFamily[] | null;
}): BrandImageCoverageEntry {
  const byUrl = new Map(
    input.products.map((product) => [product.productUrl.replace(/\/$/, "").toLowerCase(), product]),
  );
  const shardById = new Map(
    (input.shardFamilies ?? []).map((family) => [family.modelFamilyId, family]),
  );

  let productsWith1 = 0;
  let productsWith2 = 0;
  let productsWith3 = 0;
  let collectorSum = 0;
  let familySum = 0;
  let shardSum = 0;
  let shardCounted = 0;
  const knownFailures: BrandImageCoverageEntry["knownFailures"] = [];

  for (const family of input.families) {
    const collectorImages = family.sourceProductIds.flatMap((id) => {
      const product = byUrl.get(id.replace(/\/$/, "").toLowerCase());
      return product ? [product.imageUrl, ...(product.images ?? [])] : [];
    });
    const collectorCount = uniqueCount(collectorImages);
    const familyCount = uniqueCount(collectModelFamilyImages(family));
    const shard = shardById.get(family.modelFamilyId);
    const shardCount = shard ? uniqueCount(collectModelFamilyImages(shard)) : null;
    collectorSum += collectorCount;
    familySum += familyCount;
    if (shardCount != null) {
      shardSum += shardCount;
      shardCounted += 1;
    }
    if (familyCount <= 1) productsWith1 += 1;
    if (familyCount >= 2) productsWith2 += 1;
    if (familyCount >= 3) productsWith3 += 1;
    if (familyCount <= 1) {
      knownFailures.push({
        modelFamilyId: family.modelFamilyId,
        origin: classifyImageGap({ collectorCount, familyCount, shardCount }),
        collectorCount,
        familyCount,
        shardCount,
      });
    }
  }

  const n = input.families.length || 1;
  return {
    brandId: input.brandId,
    brandName: input.brandName,
    products: input.families.length,
    productsWith1Image: productsWith1,
    productsWith2PlusImages: productsWith2,
    productsWith3PlusImages: productsWith3,
    averageUniqueImages: Math.round((familySum / n) * 10) / 10,
    collectorAverage: Math.round((collectorSum / n) * 10) / 10,
    familyAverage: Math.round((familySum / n) * 10) / 10,
    shardAverage: shardCounted > 0 ? Math.round((shardSum / shardCounted) * 10) / 10 : null,
    knownFailures: knownFailures.slice(0, 25),
  };
}

export function brandNeedsImageRecrawl(entry: BrandImageCoverageEntry): boolean {
  if (entry.products === 0) return false;
  if (entry.averageUniqueImages < 2 && entry.productsWith1Image / entry.products > 0.6) return true;
  return false;
}

export function slugForBrandName(brandName: string): string {
  return slugifyBrandId(brandName);
}
