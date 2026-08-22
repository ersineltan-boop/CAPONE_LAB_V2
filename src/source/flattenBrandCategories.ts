import { isNewArrivalsCollectionPath } from "../newArrivals/detectNewness";
import { dedupeDisplayCategories } from "./dedupeDisplayCategories";
import { isGenericFootwearRootCategory } from "./genericSourceCategory";
import { translateSourceCategoryLabel } from "./sourceCategoryLabels";
import type { SourceNativeCategory } from "./types";

function lastPathSegment(value: string): string {
  const parts = value
    .split(">")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts[parts.length - 1] ?? value.trim();
}

/** One-level label for Brand UI. Full source path stays on the stored record. */
export function flatCategoryLabel(category: SourceNativeCategory): string {
  const name = category.categoryName.trim();
  if (name.includes(">")) return lastPathSegment(name);
  return name;
}

export function isGenericAllCategory(category: SourceNativeCategory): boolean {
  return isGenericFootwearRootCategory(category);
}

export function isNewArrivalsDisplayCategory(category: SourceNativeCategory): boolean {
  return (
    isNewArrivalsCollectionPath(category.categoryPath) ||
    isNewArrivalsCollectionPath(category.categoryId) ||
    isNewArrivalsCollectionPath(category.categoryName)
  );
}

/**
 * Flat Brand-detail chips: one clickable level, identity-deduped,
 * no nested trees, no semantic merges.
 * Generic roots (Shoes / Women's Shoes / All Shoes) are hidden when
 * more specific source categories exist.
 */
export function flattenBrandDisplayCategories(
  categories: SourceNativeCategory[],
): SourceNativeCategory[] {
  const deduped = dedupeDisplayCategories(categories).filter(
    (category) => !isNewArrivalsDisplayCategory(category),
  );
  const specific = deduped.filter((category) => !isGenericFootwearRootCategory(category));
  const usable = specific.length > 0 ? specific : deduped;
  return usable.map((category) => ({
    ...category,
    categoryName: translateSourceCategoryLabel(flatCategoryLabel(category)),
  }));
}
