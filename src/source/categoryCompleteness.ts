import type { ModelFamily } from "../modelFamily/types";
import type { PilotProduct } from "../collector/types";
import type { SourceNativeCategory } from "./types";
import { isGenericFootwearRootCategory } from "./genericSourceCategory";
import { isNewArrivalsCollectionPath } from "../newArrivals/detectNewness";
import { allCategoriesFromProduct } from "./sourceCategories";

export interface SourceCategoryCoverageCategory {
  categoryId: string;
  categoryName: string;
  categoryPath: string | null;
  productCount: number;
  generic: boolean;
}

export interface BrandCategoryCoverageEntry {
  brandId: string;
  brandName: string;
  modelFamilyCount: number;
  sourceProductCount: number;
  sourceFootwearCategoryCount: number;
  categories: SourceCategoryCoverageCategory[];
  productsWithMeaningfulCategory: number;
  productsWithNoMeaningfulCategory: number;
  categoryCoveragePercent: number;
  productsOnlyGenericCategory: number;
  collectionUrlsCrawled: string[];
  collectionUrlsDiscoveredNotCrawled: string[];
}

function categoriesForProduct(product: PilotProduct): SourceNativeCategory[] {
  return allCategoriesFromProduct(product);
}

function isMeaningful(category: SourceNativeCategory): boolean {
  if (isGenericFootwearRootCategory(category)) return false;
  if (isNewArrivalsCollectionPath(category.categoryPath) && isGenericFootwearRootCategory(category)) {
    return false;
  }
  if (isNewArrivalsCollectionPath(category.categoryName) && isGenericFootwearRootCategory(category)) {
    return false;
  }
  return !isGenericFootwearRootCategory(category);
}

export function buildBrandCategoryCoverage(input: {
  brandId: string;
  brandName: string;
  products: PilotProduct[];
  families: ModelFamily[];
  crawledCollectionUrls?: string[];
  discoveredCollectionUrls?: string[];
}): BrandCategoryCoverageEntry {
  const categoryCounts = new Map<string, SourceCategoryCoverageCategory>();
  let withMeaningful = 0;
  let withoutMeaningful = 0;
  let onlyGeneric = 0;

  for (const product of input.products) {
    const cats = categoriesForProduct(product);
    const meaningful = cats.filter(isMeaningful);
    const generic = cats.filter(isGenericFootwearRootCategory);
    if (meaningful.length > 0) withMeaningful += 1;
    else withoutMeaningful += 1;
    if (meaningful.length === 0 && generic.length > 0) onlyGeneric += 1;

    for (const category of cats) {
      const current = categoryCounts.get(category.categoryId) ?? {
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        categoryPath: category.categoryPath ?? null,
        productCount: 0,
        generic: isGenericFootwearRootCategory(category),
      };
      current.productCount += 1;
      categoryCounts.set(category.categoryId, current);
    }
  }

  const crawled = [...new Set(input.crawledCollectionUrls ?? [])];
  const discovered = [...new Set(input.discoveredCollectionUrls ?? [])];
  const crawledSet = new Set(crawled.map((url) => url.replace(/\/$/, "").toLowerCase()));
  const notCrawled = discovered.filter(
    (url) => !crawledSet.has(url.replace(/\/$/, "").toLowerCase()),
  );

  const sourceProductCount = input.products.length;
  return {
    brandId: input.brandId,
    brandName: input.brandName,
    modelFamilyCount: input.families.length,
    sourceProductCount,
    sourceFootwearCategoryCount: categoryCounts.size,
    categories: [...categoryCounts.values()].sort(
      (a, b) => b.productCount - a.productCount || a.categoryName.localeCompare(b.categoryName, "tr"),
    ),
    productsWithMeaningfulCategory: withMeaningful,
    productsWithNoMeaningfulCategory: withoutMeaningful,
    categoryCoveragePercent:
      sourceProductCount === 0 ? 0 : Math.round((withMeaningful / sourceProductCount) * 1000) / 10,
    productsOnlyGenericCategory: onlyGeneric,
    collectionUrlsCrawled: crawled,
    collectionUrlsDiscoveredNotCrawled: notCrawled,
  };
}

export function brandNeedsCategoryRecrawl(entry: BrandCategoryCoverageEntry): boolean {
  if (entry.sourceProductCount === 0) return false;
  if (entry.brandId === "jeffrey-campbell") return true;
  if (entry.categoryCoveragePercent < 40) return true;
  const specific = entry.categories.filter((category) => !category.generic);
  if (specific.length <= 2 && entry.sourceProductCount >= 80) return true;
  return false;
}
