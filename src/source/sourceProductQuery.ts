import type { ModelFamily } from "../modelFamily/types";
import { queryVerifiedNewArrivals } from "../newArrivals/verifiedQuery";
import type { NewArrivalsPeriod } from "../newArrivals/query";
import { isVerifiedNew } from "../newArrivals/newness";
import type { SourceNativeCategory } from "./types";
import { slugifyCategoryId } from "./sourceCategories";
import { dedupeDisplayCategories } from "./dedupeDisplayCategories";

function normalizeBrand(value: string): string {
  return value.trim().toUpperCase();
}

export function slugifyBrandId(brand: string): string {
  return slugifyCategoryId(brand);
}

export function filterFamiliesForBrandOfficial(
  families: ModelFamily[],
  brand: string,
): ModelFamily[] {
  const key = normalizeBrand(brand);
  return families.filter((family) => normalizeBrand(family.brand) === key);
}

export function filterFamiliesForMarketplaceSource(
  families: ModelFamily[],
  marketplaceId: string,
  brandFilter?: string | null,
): ModelFamily[] {
  return families.filter((family) => {
    const hasMarketplaceSighting = family.sourceSightings?.some(
      (s) => s.sourceId === marketplaceId,
    );
    if (!hasMarketplaceSighting) return false;
    if (brandFilter && normalizeBrand(family.brand) !== normalizeBrand(brandFilter)) {
      return false;
    }
    return true;
  });
}

export function filterFamiliesBySourceCategory(
  families: ModelFamily[],
  sourceId: string,
  categoryId: string,
): ModelFamily[] {
  return families.filter((family) =>
    family.sourceCategoryRefs?.some(
      (ref) => ref.sourceId === sourceId && ref.categoryId === categoryId,
    ),
  );
}

export function extractSourceCategories(
  families: ModelFamily[],
  sourceId: string,
): SourceNativeCategory[] {
  const map = new Map<string, SourceNativeCategory>();
  for (const family of families) {
    for (const ref of family.sourceCategoryRefs ?? []) {
      if (ref.sourceId !== sourceId) continue;
      map.set(ref.categoryId, {
        categoryId: ref.categoryId,
        categoryName: ref.categoryName,
        categoryPath: ref.categoryPath,
        categoryUrl: ref.categoryUrl,
      });
    }
    const sighting = family.sourceSightings?.find((s) => s.sourceId === sourceId);
    for (const category of sighting?.sourceCategories ?? []) {
      map.set(category.categoryId, category);
    }
  }
  return dedupeDisplayCategories(
    [...map.values()].sort((a, b) => a.categoryName.localeCompare(b.categoryName, "tr")),
  );
}

export function countFamiliesInCategory(
  families: ModelFamily[],
  sourceId: string,
  categoryId: string,
): number {
  return filterFamiliesBySourceCategory(families, sourceId, categoryId).length;
}

export function extractMarketplaceBrands(
  families: ModelFamily[],
  marketplaceId: string,
): Array<{ brand: string; count: number }> {
  const counts = new Map<string, number>();
  for (const family of filterFamiliesForMarketplaceSource(families, marketplaceId)) {
    counts.set(family.brand, (counts.get(family.brand) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([brand, count]) => ({ brand, count }))
    .sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand, "tr"));
}

export function filterVerifiedNewForSource(
  families: ModelFamily[],
  sourceId: string,
  period: NewArrivalsPeriod = "90D",
  brandFilter?: string | null,
): ModelFamily[] {
  const brandFamily = families.find((family) => slugifyBrandId(family.brand) === sourceId);
  const scope = brandFamily
    ? ({ type: "BRAND" as const, brand: brandFamily.brand })
    : ({ type: "SOURCE" as const, sourceId });

  const verifiedIds = new Set(
    queryVerifiedNewArrivals(families, { scope, period }).map((item) => item.modelFamilyId),
  );

  return families.filter((family) => {
    if (!verifiedIds.has(family.modelFamilyId)) return false;
    if (brandFilter && normalizeBrand(family.brand) !== normalizeBrand(brandFilter)) {
      return false;
    }
    if (brandFamily) {
      return normalizeBrand(family.brand) === normalizeBrand(brandFamily.brand);
    }
    return family.sourceSightings?.some((s) => s.sourceId === sourceId) ?? false;
  });
}

export function brandHasVerifiedNewSupport(
  families: ModelFamily[],
  brand: string,
): boolean {
  const brandId = slugifyBrandId(brand);
  return filterVerifiedNewForSource(families, brandId, "90D").length > 0;
}

export function countVerifiedNewForSource(
  families: ModelFamily[],
  sourceId: string,
  period: NewArrivalsPeriod = "90D",
): number {
  return filterVerifiedNewForSource(families, sourceId, period).length;
}

export function getSourceCategoryLabelForFamily(
  family: ModelFamily,
  sourceId: string,
): string | null {
  const ref = family.sourceCategoryRefs?.find((item) => item.sourceId === sourceId);
  if (ref) return ref.categoryName;
  const sighting = family.sourceSightings?.find((s) => s.sourceId === sourceId);
  return sighting?.sourceCategories?.[0]?.categoryName ?? null;
}

export function anyVerifiedNewOnSource(
  families: ModelFamily[],
  sourceId: string,
): boolean {
  return families.some((family) =>
    family.sourceSightings?.some(
      (s) => s.sourceId === sourceId && isVerifiedNew(s.newness),
    ),
  );
}
