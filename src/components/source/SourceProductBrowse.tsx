import { useMemo, useState } from "react";

import type { ModelFamily } from "../../modelFamily/types";
import {
  countFamiliesInCategory,
  extractSourceCategories,
  filterFamiliesBySourceCategory,
  filterVerifiedNewForSource,
  getSourceCategoryLabelForFamily,
} from "../../source/sourceProductQuery";
import { filterFamiliesBySearch } from "../../categories/categoryResearch";
import { modelFamiliesToGridItems } from "../../categories/modelFamilyGrid";
import { useResearchStateMap, useResearchStateRepository } from "../../research/useResearchState";
import { useProgressiveBatch } from "../../ui/useProgressiveBatch";
import { UI_COPY } from "../../presentation/turkishLabels";
import ModelFamilyDetailDrawer from "../modelFamily/ModelFamilyDetailDrawer";
import ModelFamilyProductGrid from "../modelFamily/ModelFamilyProductGrid";

export type SourceBrowseMode = "all" | "verified-new" | "categories" | "brands";

interface SourceProductBrowseProps {
  sourceId: string;
  sourceLabel: string;
  mode: SourceBrowseMode;
  baseFamilies: ModelFamily[];
  selectedCategoryId?: string | null;
  onSelectCategory?: (categoryId: string | null) => void;
  brandFilter?: string | null;
  showCategorySidebar?: boolean;
  emptyNewArrivalsMessage?: string;
  hideBrandName?: boolean;
  hideSourceCategoryLabel?: boolean;
  showPrice?: boolean;
}

export function modelFamilyToSimpleGridItem(family: ModelFamily, sourceId: string) {
  const item = modelFamiliesToGridItems([family])[0]!;
  const sourceCategory = getSourceCategoryLabelForFamily(family, sourceId);
  return {
    ...item,
    sourceCategoryLabel: sourceCategory,
    taxonomyChips: [],
    images: item.images,
  };
}

export default function SourceProductBrowse({
  sourceId,
  sourceLabel,
  mode,
  baseFamilies,
  selectedCategoryId = null,
  onSelectCategory,
  brandFilter = null,
  showCategorySidebar = true,
  emptyNewArrivalsMessage = UI_COPY.noVerifiedNewAtSource,
  hideBrandName = false,
  hideSourceCategoryLabel = false,
  showPrice = true,
}: SourceProductBrowseProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const researchStates = useResearchStateMap();
  const researchRepo = useResearchStateRepository();

  const categories = useMemo(
    () => extractSourceCategories(baseFamilies, sourceId),
    [baseFamilies, sourceId],
  );

  const displayFamilies = useMemo(() => {
    let families = [...baseFamilies];
    if (mode === "verified-new") {
      families = filterVerifiedNewForSource(families, sourceId, "90D", brandFilter);
    }
    if (selectedCategoryId) {
      families = filterFamiliesBySourceCategory(families, sourceId, selectedCategoryId);
    }
    families = filterFamiliesBySearch(families, searchQuery);
    return families;
  }, [baseFamilies, mode, sourceId, brandFilter, selectedCategoryId, searchQuery]);

  const gridItems = useMemo(
    () =>
      displayFamilies.map((family) => {
        const item = modelFamilyToSimpleGridItem(family, sourceId);
        return hideSourceCategoryLabel ? { ...item, sourceCategoryLabel: null } : item;
      }),
    [displayFamilies, sourceId, hideSourceCategoryLabel],
  );
  const { visibleItems, hasMore, loadMore } = useProgressiveBatch(
    gridItems,
    undefined,
    `${mode}|${selectedCategoryId ?? ""}|${searchQuery}|${sourceId}|${displayFamilies.length}`,
  );

  const familyById = useMemo(
    () => new Map(baseFamilies.map((family) => [family.modelFamilyId, family])),
    [baseFamilies],
  );
  const selectedFamily = selectedFamilyId ? familyById.get(selectedFamilyId) ?? null : null;

  const emptyMessage =
    mode === "verified-new" ? emptyNewArrivalsMessage : UI_COPY.emptyFilters;

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={UI_COPY.searchPlaceholder}
            className="min-w-[180px] flex-1 border border-line bg-cream px-2.5 py-1.5 text-[10px] text-ink"
          />
        </div>

        {mode === "categories" && showCategorySidebar && categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSelectCategory?.(null)}
              className={`border px-2 py-1 text-[10px] ${
                !selectedCategoryId ? "border-ink bg-ink text-cream" : "border-line text-ink-muted"
              }`}
            >
              {UI_COPY.allProducts}
            </button>
            {categories.map((category) => (
              <button
                key={category.categoryId}
                type="button"
                onClick={() => onSelectCategory?.(category.categoryId)}
                className={`border px-2 py-1 text-[10px] ${
                  selectedCategoryId === category.categoryId
                    ? "border-ink bg-ink text-cream"
                    : "border-line text-ink-muted"
                }`}
              >
                {category.categoryName} ({countFamiliesInCategory(baseFamilies, sourceId, category.categoryId)})
              </button>
            ))}
          </div>
        )}

        <p className="text-[10px] text-ink-muted">
          {UI_COPY.modelsCount(displayFamilies.length)} · {sourceLabel}
        </p>

        <ModelFamilyProductGrid
          items={visibleItems}
          emptyMessage={emptyMessage}
          density="visual"
          researchStates={researchStates}
          onSelectItem={setSelectedFamilyId}
          onToggleSaved={(id, saved) => researchRepo.setSaved(id, saved)}
          hideBrand={hideBrandName}
          hideTaxonomy
          showPrice={showPrice}
          loadMoreSlot={
            hasMore ? (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={loadMore}
                  className="border border-line px-4 py-2 text-[10px] tracking-widest text-ink-muted hover:border-ink hover:text-ink"
                >
                  {UI_COPY.loadMore}
                </button>
              </div>
            ) : null
          }
        />
      </div>

      <ModelFamilyDetailDrawer
        family={selectedFamily}
        open={Boolean(selectedFamily)}
        onClose={() => setSelectedFamilyId(null)}
        sourceId={sourceId}
      />
    </>
  );
}
