import { useMemo, useState } from "react";

import {
  loadCatalogSummary,
  loadShardsForSavedIds,
} from "../../catalog/catalogClient";
import { CatalogErrorState, CatalogLoadingState } from "../../catalog/CatalogStatus";
import {
  brandCardCountryLabel,
  brandSummariesForIndex,
  countryOptionsFromSummary,
} from "../../catalog/brandIndexFromSummary";
import { useCatalogResource } from "../../catalog/useCatalogResource";
import { ALL_COUNTRIES_ID } from "../../brands/countryGrouping";
import { filterSavedFamilies, filterFamiliesBySearch } from "../../categories/categoryResearch";
import { useResearchStateMap, useResearchStateRepository } from "../../research/useResearchState";
import { useBrandFavorites } from "../../research/useBrandFavorites";
import { useProgressiveBatch } from "../../ui/useProgressiveBatch";
import { UI_COPY } from "../../presentation/turkishLabels";
import { slugifyBrandId } from "../../source/sourceProductQuery";
import type { CatalogSummary } from "../../catalog/types";
import type { ModelFamily } from "../../modelFamily/types";
import ModelFamilyDetailDrawer from "../modelFamily/ModelFamilyDetailDrawer";
import ModelFamilyProductGrid from "../modelFamily/ModelFamilyProductGrid";
import { modelFamilyToSimpleGridItem } from "../source/SourceProductBrowse";

interface SavedProductsProps {
  onSelectBrand?: (brandId: string, brandName: string) => void;
}

export default function SavedProducts({ onSelectBrand }: SavedProductsProps) {
  const [pageTab, setPageTab] = useState<"products" | "brands">("products");
  const [searchQuery, setSearchQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState<string>("ALL");
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");
  const [countryId, setCountryId] = useState(ALL_COUNTRIES_ID);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);

  const researchStates = useResearchStateMap();
  const researchRepo = useResearchStateRepository();
  const { isSaved, setSaved } = useBrandFavorites();
  const savedIds = useMemo(
    () =>
      [...researchStates.values()]
        .filter((state) => state.savedAt)
        .map((state) => state.modelFamilyId),
    [researchStates],
  );
  const savedKey = savedIds.slice().sort().join("|");

  const { state, retry } = useCatalogResource(async () => {
    const summary = await loadCatalogSummary();
    if (pageTab === "brands") {
      return { summary, families: [] as ModelFamily[] };
    }
    const shards = await loadShardsForSavedIds(savedIds);
    const families: ModelFamily[] = [];
    const seen = new Set<string>();
    for (const shard of shards) {
      for (const family of shard.families) {
        if (seen.has(family.modelFamilyId)) continue;
        seen.add(family.modelFamilyId);
        families.push(family);
      }
    }
    return { summary, families };
  }, [savedKey, pageTab]);

  const familyById = useMemo(
    () =>
      new Map(
        (state.status === "ready" ? state.data.families : []).map((family) => [
          family.modelFamilyId,
          family,
        ]),
      ),
    [state],
  );

  const brandOptions = useMemo(() => {
    if (state.status !== "ready") return [];
    return state.data.summary.brands.map((brand) => brand.brandName);
  }, [state]);

  const sourceOptions = useMemo(() => {
    if (state.status !== "ready") return [];
    const sources = new Map<string, string>();
    for (const brand of state.data.summary.brands) {
      sources.set(brand.brandId, brand.brandName);
    }
    for (const marketplace of state.data.summary.marketplaces) {
      sources.set(marketplace.sourceId, marketplace.name);
    }
    return [...sources.entries()].sort((a, b) => a[1].localeCompare(b[1], "tr"));
  }, [state]);

  const savedFamilies = useMemo(() => {
    if (state.status !== "ready") return [];
    let families = filterSavedFamilies(state.data.families, researchStates);
    if (brandFilter !== "ALL") {
      families = families.filter((family) => family.brand === brandFilter);
    }
    if (sourceFilter !== "ALL") {
      families = families.filter((family) =>
        family.sourceSightings?.some((s) => s.sourceId === sourceFilter),
      );
    }
    return filterFamiliesBySearch(families, searchQuery).sort((a, b) => {
      const aSaved = Date.parse(researchStates.get(a.modelFamilyId)?.savedAt ?? "");
      const bSaved = Date.parse(researchStates.get(b.modelFamilyId)?.savedAt ?? "");
      return bSaved - aSaved;
    });
  }, [state, researchStates, brandFilter, sourceFilter, searchQuery]);

  const gridItems = useMemo(
    () =>
      savedFamilies.map((family) =>
        modelFamilyToSimpleGridItem(
          family,
          sourceFilter !== "ALL" ? sourceFilter : slugifyBrandId(family.brand),
        ),
      ),
    [savedFamilies, sourceFilter],
  );
  const { visibleItems, hasMore, loadMore } = useProgressiveBatch(gridItems);

  const selectedFamily = selectedFamilyId
    ? familyById.get(selectedFamilyId) ?? null
    : null;

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="space-y-4 border border-line bg-white/20 p-4 sm:p-5">
          <div>
            <h2 className="font-serif text-lg font-medium tracking-wide sm:text-xl">
              {UI_COPY.savedProductsTitle}
            </h2>
            <p className="mt-1 text-[10px] leading-relaxed text-ink-muted">
              {UI_COPY.savedProductsSubtitle}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPageTab("products")}
              className={`border px-3 py-1.5 text-[10px] tracking-widest ${
                pageTab === "products"
                  ? "border-ink bg-ink text-cream"
                  : "border-line text-ink-muted hover:border-ink"
              }`}
            >
              {UI_COPY.savedPageProducts}
            </button>
            <button
              type="button"
              onClick={() => setPageTab("brands")}
              className={`border px-3 py-1.5 text-[10px] tracking-widest ${
                pageTab === "brands"
                  ? "border-ink bg-ink text-cream"
                  : "border-line text-ink-muted hover:border-ink"
              }`}
            >
              {UI_COPY.savedPageBrands}
            </button>
          </div>

          {state.status === "loading" ? <CatalogLoadingState /> : null}
          {state.status === "error" ? <CatalogErrorState onRetry={retry} /> : null}

          {state.status === "ready" && pageTab === "products" ? (
            <>
              <div className="flex flex-wrap gap-2">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={UI_COPY.searchPlaceholder}
                  className="min-w-[180px] flex-1 border border-line bg-cream px-2.5 py-1.5 text-[10px] text-ink"
                />
                <select
                  value={brandFilter}
                  onChange={(event) => setBrandFilter(event.target.value)}
                  className="border border-line bg-cream px-2 py-1.5 text-[10px] text-ink-muted"
                >
                  <option value="ALL">Tüm Markalar</option>
                  {brandOptions.map((brand) => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                </select>
                <select
                  value={sourceFilter}
                  onChange={(event) => setSourceFilter(event.target.value)}
                  className="border border-line bg-cream px-2 py-1.5 text-[10px] text-ink-muted"
                >
                  <option value="ALL">Tüm Kaynaklar</option>
                  {sourceOptions.map(([sourceId, label]) => (
                    <option key={sourceId} value={sourceId}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-[10px] text-ink-muted">{UI_COPY.modelsCount(savedFamilies.length)}</p>

              <ModelFamilyProductGrid
                items={visibleItems}
                emptyMessage={UI_COPY.emptySaved}
                density="visual"
                researchStates={researchStates}
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
            </>
          ) : null}

          {state.status === "ready" && pageTab === "brands" ? (
            <SavedBrandsPanel
              summary={state.data.summary}
              searchQuery={searchQuery}
              onSearchQuery={setSearchQuery}
              countryId={countryId}
              onCountryId={setCountryId}
              isSaved={isSaved}
              setSaved={setSaved}
              onSelectBrand={onSelectBrand}
            />
          ) : null}
        </div>
      </section>

      <ModelFamilyDetailDrawer
        family={selectedFamily}
        open={Boolean(selectedFamily)}
        onClose={() => setSelectedFamilyId(null)}
      />
    </>
  );
}

function SavedBrandsPanel({
  summary,
  searchQuery,
  onSearchQuery,
  countryId,
  onCountryId,
  isSaved,
  setSaved,
  onSelectBrand,
}: {
  summary: CatalogSummary;
  searchQuery: string;
  onSearchQuery: (value: string) => void;
  countryId: string;
  onCountryId: (value: string) => void;
  isSaved: (brandId: string) => boolean;
  setSaved: (brandId: string, saved: boolean) => void;
  onSelectBrand?: (brandId: string, brandName: string) => void;
}) {
  const countryOptions = countryOptionsFromSummary(summary);
  const cards = brandSummariesForIndex(summary, countryId).filter((card) => {
    if (!isSaved(card.brandId)) return false;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return card.brandName.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQuery(event.target.value)}
          placeholder={UI_COPY.searchPlaceholder}
          className="min-w-[180px] flex-1 border border-line bg-cream px-2.5 py-1.5 text-[10px] text-ink"
        />
        <select
          value={countryId}
          onChange={(event) => onCountryId(event.target.value)}
          className="border border-line bg-cream px-2 py-1.5 text-[10px] text-ink-muted"
        >
          <option value={ALL_COUNTRIES_ID}>{UI_COPY.allCountries}</option>
          {countryOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {cards.length === 0 ? (
        <p className="text-sm text-ink-muted">{UI_COPY.emptySavedBrands}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <article key={card.brandId} className="border border-line bg-cream/40 p-4">
              <button
                type="button"
                onClick={() => onSelectBrand?.(card.brandId, card.brandName)}
                className="w-full text-left"
              >
                <h3 className="font-serif text-xl tracking-wide">{card.brandName}</h3>
                <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                  {brandCardCountryLabel(card)}
                </p>
                <p className="mt-1 text-[11px] text-ink-muted">
                  {UI_COPY.productsCount(card.productCount)}
                </p>
              </button>
              <button
                type="button"
                onClick={() => setSaved(card.brandId, false)}
                className="mt-3 text-[9px] tracking-[0.14em] text-ink-faint hover:text-ink"
              >
                {UI_COPY.savedBrand}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
