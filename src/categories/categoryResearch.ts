import type { ModelFamily } from "../modelFamily/types";
import type { ModelFamilyGridItem } from "./modelFamilyGrid";
import { modelFamilyToGridItem } from "./modelFamilyGrid";
import type { ModelFamilyResearchState } from "../research/types";
import { isReviewed } from "../research/researchStateRepository";

export type CategorySortMode = "newest" | "brand-az" | "unreviewed-first";

export function sortModelFamilies(
  families: ModelFamily[],
  mode: CategorySortMode,
  researchStates: Map<string, ModelFamilyResearchState>,
): ModelFamily[] {
  const sorted = [...families];

  if (mode === "brand-az") {
    return sorted.sort(
      (a, b) =>
        a.brand.localeCompare(b.brand, "tr") ||
        a.canonicalName.localeCompare(b.canonicalName, "tr"),
    );
  }

  if (mode === "unreviewed-first") {
    return sorted.sort((a, b) => {
      const aReviewed = isReviewed(researchStates.get(a.modelFamilyId) ?? { modelFamilyId: a.modelFamilyId, reviewedAt: null, savedAt: null, note: null });
      const bReviewed = isReviewed(researchStates.get(b.modelFamilyId) ?? { modelFamilyId: b.modelFamilyId, reviewedAt: null, savedAt: null, note: null });
      if (aReviewed !== bReviewed) return aReviewed ? 1 : -1;
      const aSeen = Date.parse(a.modelFamilyFirstSeenAt ?? "") || 0;
      const bSeen = Date.parse(b.modelFamilyFirstSeenAt ?? "") || 0;
      return bSeen - aSeen;
    });
  }

  return sorted.sort((a, b) => {
    const aSeen = Date.parse(a.modelFamilyFirstSeenAt ?? "") || 0;
    const bSeen = Date.parse(b.modelFamilyFirstSeenAt ?? "") || 0;
    return bSeen - aSeen;
  });
}

export function filterFamiliesBySearch(
  families: ModelFamily[],
  query: string,
): ModelFamily[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return families;
  return families.filter(
    (family) =>
      family.brand.toLowerCase().includes(trimmed) ||
      family.canonicalName.toLowerCase().includes(trimmed),
  );
}

export function filterUnreviewedFamilies(
  families: ModelFamily[],
  researchStates: Map<string, ModelFamilyResearchState>,
): ModelFamily[] {
  return families.filter((family) => {
    const state = researchStates.get(family.modelFamilyId);
    return !state?.reviewedAt;
  });
}

export function filterSavedFamilies(
  families: ModelFamily[],
  researchStates: Map<string, ModelFamilyResearchState>,
): ModelFamily[] {
  return families.filter((family) => {
    const state = researchStates.get(family.modelFamilyId);
    return Boolean(state?.savedAt);
  });
}

export function countUnreviewed(
  families: ModelFamily[],
  researchStates: Map<string, ModelFamilyResearchState>,
): number {
  return filterUnreviewedFamilies(families, researchStates).length;
}

export function familiesToSortedGridItems(
  families: ModelFamily[],
  mode: CategorySortMode,
  researchStates: Map<string, ModelFamilyResearchState>,
): ModelFamilyGridItem[] {
  return sortModelFamilies(families, mode, researchStates).map(modelFamilyToGridItem);
}

export function findNextUnreviewedId(
  orderedIds: string[],
  currentId: string,
  researchStates: Map<string, ModelFamilyResearchState>,
): string | null {
  const startIndex = orderedIds.indexOf(currentId);
  const searchOrder =
    startIndex >= 0
      ? [...orderedIds.slice(startIndex + 1), ...orderedIds.slice(0, startIndex)]
      : orderedIds;

  for (const id of searchOrder) {
    const state = researchStates.get(id);
    if (!state?.reviewedAt) return id;
  }
  return null;
}
