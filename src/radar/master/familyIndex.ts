import type { AnalyzedProduct } from "../../types/marketAnalysis";
import type { ModelFamily } from "../../modelFamily/types";
import type { FootwearCategory } from "../../types/pilotProduct";

export interface IndexedModelFamily {
  family: ModelFamily;
  category: FootwearCategory;
  representativeProduct: AnalyzedProduct;
}

export function buildFamilyIndex(
  families: ModelFamily[],
  productByUrl: Map<string, AnalyzedProduct>,
): IndexedModelFamily[] {
  const indexed: IndexedModelFamily[] = [];

  for (const family of families) {
    const representativeProduct = productByUrl.get(family.representativeProductId);
    const category =
      family.category ??
      representativeProduct?.normalized.category ??
      representativeProduct?.category;

    if (!category || category === "OTHER_FOOTWEAR") continue;
    if (!representativeProduct) continue;

    indexed.push({
      family,
      category,
      representativeProduct,
    });
  }

  return indexed;
}

export function groupFamiliesByCategory(
  indexedFamilies: IndexedModelFamily[],
): Map<FootwearCategory, IndexedModelFamily[]> {
  const groups = new Map<FootwearCategory, IndexedModelFamily[]>();

  for (const entry of indexedFamilies) {
    const list = groups.get(entry.category) ?? [];
    list.push(entry);
    groups.set(entry.category, list);
  }

  return groups;
}
