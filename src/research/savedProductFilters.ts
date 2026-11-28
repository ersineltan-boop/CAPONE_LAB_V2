import type { ModelFamily } from "../modelFamily/types";
import type { ModelFamilyResearchState } from "./types";

interface SavedProductFilters {
  query: string;
  brand: string;
  source: string;
  withNotes: boolean;
}

function searchable(value: string): string {
  return value.toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replaceAll("ı", "i");
}

export function filterSavedProducts(
  families: ModelFamily[],
  states: ReadonlyMap<string, ModelFamilyResearchState>,
  { query, brand, source, withNotes }: SavedProductFilters,
): ModelFamily[] {
  const search = searchable(query.trim());
  const matches = families.filter((family) => {
    if (brand !== "ALL" && family.brand !== brand) return false;
    if (source !== "ALL" && !family.sourceSightings?.some((item) => item.sourceId === source)) {
      return false;
    }
    const note = states.get(family.modelFamilyId)?.note?.trim() ?? "";
    if (withNotes && !note) return false;
    return !search || [family.brand, family.canonicalName, note].some((text) =>
      searchable(text).includes(search),
    );
  });

  return matches.sort((a, b) => {
    const aSaved = Date.parse(states.get(a.modelFamilyId)?.savedAt ?? "") || 0;
    const bSaved = Date.parse(states.get(b.modelFamilyId)?.savedAt ?? "") || 0;
    return bSaved - aSaved;
  });
}
