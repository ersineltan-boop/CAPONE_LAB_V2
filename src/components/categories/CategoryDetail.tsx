import { useCallback, useEffect, useMemo, useState } from "react";

import { modelFamilies } from "../../data/modelFamilies";
import { buildCategoryCoverageSummary } from "../../categories/taxonomyCoverage";
import {
  countUnreviewed,
  familiesToSortedGridItems,
  filterFamiliesBySearch,
  filterSavedFamilies,
  filterUnreviewedFamilies,
  findNextUnreviewedId,
  type CategorySortMode,
} from "../../categories/categoryResearch";
import {
  applyTaxonomyFilters,
  buildFacetGroups,
  filterFamiliesByCategory,
  type TaxonomyActiveFilter,
} from "../../categories/taxonomyFilters";
import { queryVerifiedNewArrivals } from "../../newArrivals/verifiedQuery";
import type { NewArrivalsPeriod } from "../../newArrivals/query";
import type { PrimaryFootwearCategory } from "../../taxonomy/types";
import {
  getCategoryLabel,
  getPeriodLabel,
  UI_COPY,
} from "../../presentation/turkishLabels";
import { useResearchStateMap, useResearchStateRepository } from "../../research/useResearchState";
import { useProgressiveBatch } from "../../ui/useProgressiveBatch";
import ModelFamilyDetailDrawer from "../modelFamily/ModelFamilyDetailDrawer";
import ModelFamilyProductGrid from "../modelFamily/ModelFamilyProductGrid";
import CategorySwitcher from "./CategorySwitcher";
import TaxonomyCoverageSummary from "./TaxonomyCoverageSummary";
import TaxonomyFilterPanel from "./TaxonomyFilterPanel";

type CategoryDetailMode = "all" | "verified-new" | "unreviewed" | "saved";

const PERIODS: NewArrivalsPeriod[] = ["24H", "7D", "30D", "90D"];

interface CategoryDetailProps {
  category: PrimaryFootwearCategory;
  onBack: () => void;
  onSelectCategory: (category: PrimaryFootwearCategory) => void;
}

export default function CategoryDetail({
  category,
  onBack,
  onSelectCategory,
}: CategoryDetailProps) {
  const [mode, setMode] = useState<CategoryDetailMode>("all");
  const [period, setPeriod] = useState<NewArrivalsPeriod>("30D");
  const [activeFilters, setActiveFilters] = useState<TaxonomyActiveFilter[]>([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<CategorySortMode>("newest");
  const [density, setDensity] = useState<"visual" | "compact">("visual");

  const researchStates = useResearchStateMap();
  const researchRepo = useResearchStateRepository();

  const categoryLabel = getCategoryLabel(category);

  const familyById = useMemo(
    () => new Map(modelFamilies.map((family) => [family.modelFamilyId, family])),
    [],
  );

  const categoryFamilies = useMemo(
    () => filterFamiliesByCategory(modelFamilies, category),
    [category],
  );

  const coverageStats = useMemo(
    () => buildCategoryCoverageSummary(categoryFamilies, category),
    [categoryFamilies, category],
  );

  const facetGroups = useMemo(
    () => buildFacetGroups(categoryFamilies, category, activeFilters),
    [categoryFamilies, category, activeFilters],
  );

  const filteredFamilies = useMemo(() => {
    let families = applyTaxonomyFilters(categoryFamilies, activeFilters);
    families = filterFamiliesBySearch(families, searchQuery);

    if (mode === "unreviewed") {
      families = filterUnreviewedFamilies(families, researchStates);
    } else if (mode === "saved") {
      families = filterSavedFamilies(families, researchStates);
    } else if (mode === "verified-new") {
      const verifiedIds = new Set(
        queryVerifiedNewArrivals(modelFamilies, {
          scope: { type: "CATEGORY", category },
          period,
        }).map((item) => item.modelFamilyId),
      );
      families = families.filter((family) => verifiedIds.has(family.modelFamilyId));
    }

    return families;
  }, [categoryFamilies, activeFilters, searchQuery, mode, researchStates, period, category]);

  const displayItems = useMemo(
    () => familiesToSortedGridItems(filteredFamilies, sortMode, researchStates),
    [filteredFamilies, sortMode, researchStates],
  );

  const { visibleItems, hasMore, loadMore, reset } = useProgressiveBatch(displayItems);

  useEffect(() => {
    reset();
  }, [mode, category, activeFilters, searchQuery, sortMode, reset]);

  const verifiedNewIds = useMemo(() => {
    return new Set(
      queryVerifiedNewArrivals(modelFamilies, {
        scope: { type: "CATEGORY", category },
        period: "90D",
      }).map((item) => item.modelFamilyId),
    );
  }, [category]);

  const unreviewedCount = useMemo(
    () => countUnreviewed(categoryFamilies, researchStates),
    [categoryFamilies, researchStates],
  );

  const selectedFamily = selectedFamilyId
    ? familyById.get(selectedFamilyId) ?? null
    : null;

  const orderedIds = useMemo(
    () => displayItems.map((item) => item.modelFamilyId),
    [displayItems],
  );

  const nextUnreviewedId = selectedFamilyId
    ? findNextUnreviewedId(orderedIds, selectedFamilyId, researchStates)
    : null;

  const toggleFilter = useCallback((field: string, value: string) => {
    setActiveFilters((current) => {
      const exists = current.some(
        (filter) => filter.field === field && filter.value === value,
      );
      if (exists) {
        return current.filter(
          (filter) => !(filter.field === field && filter.value === value),
        );
      }
      const withoutField = current.filter((filter) => filter.field !== field);
      return [...withoutField, { field, value }];
    });
  }, []);

  const clearFilters = useCallback(() => setActiveFilters([]), []);

  const handleCategoryChange = useCallback(
    (nextCategory: PrimaryFootwearCategory) => {
      setActiveFilters([]);
      setSelectedFamilyId(null);
      setSearchQuery("");
      onSelectCategory(nextCategory);
    },
    [onSelectCategory],
  );

  const emptyMessage =
    categoryFamilies.length === 0
      ? UI_COPY.emptyCategory
      : mode === "verified-new"
        ? UI_COPY.emptyNewArrivals
        : mode === "unreviewed"
          ? UI_COPY.emptyUnreviewed
          : mode === "saved"
            ? UI_COPY.emptySaved
            : UI_COPY.emptyFilters;

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="space-y-4 border border-line bg-white/20 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <button
                type="button"
                onClick={onBack}
                className="text-[10px] tracking-wide text-ink-muted hover:text-ink"
              >
                ← {UI_COPY.backToCategories}
              </button>
              <div>
                <h2 className="font-serif text-lg font-medium uppercase tracking-wide sm:text-xl">
                  {categoryLabel}
                </h2>
                <p className="mt-1 text-[10px] text-ink-muted">
                  {UI_COPY.modelsWithUnreviewed(categoryFamilies.length, unreviewedCount)}
                </p>
              </div>
            </div>
            <CategorySwitcher
              currentCategory={category}
              onSelectCategory={handleCategoryChange}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <TaxonomyCoverageSummary stats={coverageStats} />
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", UI_COPY.allModels],
                ["verified-new", UI_COPY.categoryNewArrivals],
                ["unreviewed", UI_COPY.unreviewedTab],
                ["saved", UI_COPY.savedTab],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`border px-2.5 py-1.5 text-[10px] tracking-widest transition-colors ${
                  mode === value
                    ? "border-ink bg-ink text-cream"
                    : "border-line text-ink-muted hover:border-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "verified-new" && (
            <div className="flex flex-wrap gap-2">
              {PERIODS.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setPeriod(entry)}
                  className={`border px-2.5 py-1.5 text-[10px] tracking-widest transition-colors ${
                    period === entry
                      ? "border-ink bg-ink text-cream"
                      : "border-line text-ink-muted hover:border-ink"
                  }`}
                >
                  <span className="hidden sm:inline">{getPeriodLabel(entry)}</span>
                  <span className="sm:hidden">{getPeriodLabel(entry, { compact: true })}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={UI_COPY.searchPlaceholder}
              className="min-w-[180px] flex-1 border border-line bg-cream px-2.5 py-1.5 text-[10px] text-ink"
            />
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as CategorySortMode)}
              className="border border-line bg-cream px-2 py-1.5 text-[10px] text-ink-muted"
            >
              <option value="newest">{UI_COPY.sortNewest}</option>
              <option value="brand-az">{UI_COPY.sortBrandAz}</option>
              <option value="unreviewed-first">{UI_COPY.sortUnreviewedFirst}</option>
            </select>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setDensity("visual")}
                className={`border px-2 py-1.5 text-[10px] ${
                  density === "visual" ? "border-ink bg-ink text-cream" : "border-line text-ink-muted"
                }`}
              >
                {UI_COPY.viewVisual}
              </button>
              <button
                type="button"
                onClick={() => setDensity("compact")}
                className={`border px-2 py-1.5 text-[10px] ${
                  density === "compact" ? "border-ink bg-ink text-cream" : "border-line text-ink-muted"
                }`}
              >
                {UI_COPY.viewCompact}
              </button>
            </div>
          </div>

          <p className="text-[10px] text-ink-muted">
            {UI_COPY.modelsCount(displayItems.length)}
          </p>

          <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
            {mode === "all" && facetGroups.length > 0 && (
              <TaxonomyFilterPanel
                facetGroups={facetGroups}
                activeFilters={activeFilters}
                onToggleFilter={toggleFilter}
                onClearFilters={clearFilters}
              />
            )}
            <div>
              <ModelFamilyProductGrid
                items={visibleItems}
                emptyMessage={emptyMessage}
                density={density}
                researchStates={researchStates}
                verifiedNewIds={verifiedNewIds}
                onSelectItem={setSelectedFamilyId}
                onToggleReviewed={(id, reviewed) => researchRepo.setReviewed(id, reviewed)}
                onToggleSaved={(id, saved) => researchRepo.setSaved(id, saved)}
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
          </div>
        </div>
      </section>

      <ModelFamilyDetailDrawer
        family={selectedFamily}
        open={Boolean(selectedFamily)}
        onClose={() => setSelectedFamilyId(null)}
        onNextUnreviewed={
          nextUnreviewedId ? () => setSelectedFamilyId(nextUnreviewedId) : undefined
        }
      />
    </>
  );
}
