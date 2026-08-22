import type { ModelFamily } from "../modelFamily/types";
import type { PrimaryFootwearCategory } from "../taxonomy/types";
import { countVerifiedNewInCategory } from "../newArrivals/verifiedQuery";
import { filterFamiliesByCategory } from "./taxonomyFilters";
import { selectCategoryHeroImage } from "./categoryHeroImage";

export interface CategorySummary {
  category: PrimaryFootwearCategory;
  modelCount: number;
  heroImage: string | null;
  verifiedNewCount: number;
}

export function buildCategorySummaries(
  families: ModelFamily[],
  categories: PrimaryFootwearCategory[],
  referenceDate?: string,
): CategorySummary[] {
  return categories.map((category) => {
    const inCategory = filterFamiliesByCategory(families, category);
    const verifiedNewCount = countVerifiedNewInCategory(
      families,
      category,
      "90D",
      referenceDate,
    );

    return {
      category,
      modelCount: inCategory.length,
      heroImage: selectCategoryHeroImage(inCategory),
      verifiedNewCount,
    };
  });
}
