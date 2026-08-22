import type { ModelFamily } from "../modelFamily/types";
import { getFamilyPrimaryCategory } from "../categories/taxonomyFilters";
import {
  mapPrimaryCategoryToVisual,
  mapSourceCategoryToVisual,
  resolveVisualBasicCategory,
  type VisualMappedCategoryId,
} from "./basicCategories";
import { isGenericFootwearRootCategory } from "../source/genericSourceCategory";

export type DigerReason =
  | "MISSING_SOURCE_CATEGORY"
  | "GENERIC_SOURCE_CATEGORY"
  | "UNMAPPED_SOURCE_CATEGORY"
  | "CONFLICTING_SOURCE_CATEGORIES"
  | "NO_SAFE_FALLBACK";

export interface DigerItemAudit {
  modelFamilyId: string;
  brand: string;
  sourceCategories: string[];
  primaryCategory: string | null;
  reason: DigerReason;
}

export interface UnmappedSourceCategoryRow {
  sourceCategory: string;
  count: number;
  brands: string[];
  proposedMapping: VisualMappedCategoryId | null;
}

export function diagnoseDigerReason(family: ModelFamily): DigerReason | null {
  if (resolveVisualBasicCategory(family) !== "diger") return null;

  const refs = family.sourceCategoryRefs ?? [];
  const mapped = new Set<VisualMappedCategoryId>();
  const specific: string[] = [];
  let genericCount = 0;

  for (const ref of refs) {
    if (isGenericFootwearRootCategory(ref)) {
      genericCount += 1;
      continue;
    }
    const hit = mapSourceCategoryToVisual(ref);
    if (hit) mapped.add(hit);
    else specific.push(ref.categoryName);
  }

  if (mapped.size > 1) return "CONFLICTING_SOURCE_CATEGORIES";
  if (refs.length === 0) return "MISSING_SOURCE_CATEGORY";
  if (genericCount === refs.length) return "GENERIC_SOURCE_CATEGORY";
  if (specific.length > 0) return "UNMAPPED_SOURCE_CATEGORY";

  const primary = getFamilyPrimaryCategory(family);
  if (!primary || mapPrimaryCategoryToVisual(primary) === "diger") {
    return "NO_SAFE_FALLBACK";
  }
  return "NO_SAFE_FALLBACK";
}

export function buildVisualOtherAudit(families: ModelFamily[]): {
  generatedAt: string;
  digerCount: number;
  totalFamilies: number;
  reasonCounts: Record<DigerReason, number>;
  items: DigerItemAudit[];
  topUnmappedSourceCategories: UnmappedSourceCategoryRow[];
} {
  const reasonCounts: Record<DigerReason, number> = {
    MISSING_SOURCE_CATEGORY: 0,
    GENERIC_SOURCE_CATEGORY: 0,
    CONFLICTING_SOURCE_CATEGORIES: 0,
    UNMAPPED_SOURCE_CATEGORY: 0,
    NO_SAFE_FALLBACK: 0,
  };
  const items: DigerItemAudit[] = [];
  const unmapped = new Map<string, { count: number; brands: Set<string> }>();

  for (const family of families) {
    const reason = diagnoseDigerReason(family);
    if (!reason) continue;
    reasonCounts[reason] += 1;
    const sourceCategories = (family.sourceCategoryRefs ?? []).map((ref) => ref.categoryName);
    items.push({
      modelFamilyId: family.modelFamilyId,
      brand: family.brand,
      sourceCategories,
      primaryCategory: family.primaryCategory ?? family.category ?? null,
      reason,
    });
    if (reason === "UNMAPPED_SOURCE_CATEGORY") {
      for (const ref of family.sourceCategoryRefs ?? []) {
        if (isGenericFootwearRootCategory(ref)) continue;
        if (mapSourceCategoryToVisual(ref)) continue;
        const key = ref.categoryName.trim();
        const current = unmapped.get(key) ?? { count: 0, brands: new Set<string>() };
        current.count += 1;
        current.brands.add(family.brand);
        unmapped.set(key, current);
      }
    }
  }

  const topUnmappedSourceCategories = [...unmapped.entries()]
    .map(([sourceCategory, value]) => ({
      sourceCategory,
      count: value.count,
      brands: [...value.brands].sort(),
      proposedMapping: proposeDeterministicMapping(sourceCategory),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 40);

  return {
    generatedAt: new Date().toISOString(),
    digerCount: items.length,
    totalFamilies: families.length,
    reasonCounts,
    items,
    topUnmappedSourceCategories,
  };
}

export function proposeDeterministicMapping(name: string): VisualMappedCategoryId | null {
  const hay = name.toLowerCase();
  if (/\bbooties?\b|\bchelsea\b|\bwellington/.test(hay)) return "bot-cizme";
  if (/\bcourt shoes?\b|\bheels?\b/.test(hay)) return "topuklu";
  if (/\btrainers?\b|\bsneakers?\b/.test(hay)) return "sneaker";
  if (/\bsand[aá]lias?\b/.test(hay)) return "sandal";
  if (/\bballerinas?\b|\bballet flats?\b/.test(hay)) return "babet";
  return null;
}
