import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";

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
import { filterSavedFamilies } from "../../categories/categoryResearch";
import { useResearchStateMap, useResearchStateRepository } from "../../research/useResearchState";
import { useBrandFavorites } from "../../research/useBrandFavorites";
import { getBrandFavoriteRepository } from "../../research/brandFavoritesRepository";
import { createPortableBackup, importPortableBackup, parsePortableBackup } from "../../research/portableBackup";
import { savedBrandOptions } from "../../research/savedBrandOptions";
import { filterSavedProducts } from "../../research/savedProductFilters";
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

const FIELD_CLASS = "touch-target min-w-0 border border-line bg-cream px-3 py-2 text-base text-ink sm:text-sm";

export default function SavedProducts({ onSelectBrand }: SavedProductsProps) {
  const [pageTab, setPageTab] = useState<"products" | "brands">("products");
  const [searchQuery, setSearchQuery] = useState("");
  const [brandSearchQuery, setBrandSearchQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState<string>("ALL");
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");
  const [withNotes, setWithNotes] = useState(false);
  const [countryId, setCountryId] = useState(ALL_COUNTRIES_ID);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [backupMessage, setBackupMessage] = useState("");

  const researchStates = useResearchStateMap();
  const researchRepo = useResearchStateRepository();
  const { isSaved, setSaved } = useBrandFavorites();

  function downloadBackup() {
    const json = createPortableBackup(researchRepo, getBrandFavoriteRepository());
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `capone-kayitlar-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setBackupMessage("Yedek indirildi. Telefonda açmak için dosyayı güvenli biçimde o cihaza aktarın.");
  }

  async function uploadBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw new Error("Dosya çok büyük (en fazla 5 MB).");
      const backup = parsePortableBackup(await file.text());
      const result = importPortableBackup(backup, researchRepo, getBrandFavoriteRepository());
      setBackupMessage(`${result.products} ürün kaydı ve ${result.brands} marka aktarıldı.` +
        (result.keptLocalNotes ? ` ${result.keptLocalNotes} çakışan notta bu cihazdaki not korundu.` : ""));
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "Yedek okunamadı.");
    }
  }
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

  const allSavedFamilies = useMemo(
    () => state.status === "ready" ? filterSavedFamilies(state.data.families, researchStates) : [],
    [state, researchStates],
  );
  const brandOptions = useMemo(() => {
    if (state.status !== "ready") return [];
    return savedBrandOptions(
      state.data.summary.brands.map((brand) => brand.brandName),
      allSavedFamilies.map((family) => family.brand),
    );
  }, [state, allSavedFamilies]);

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

  const savedFamilies = useMemo(
    () => filterSavedProducts(allSavedFamilies, researchStates, {
      query: searchQuery,
      brand: brandFilter,
      source: sourceFilter,
      withNotes,
    }),
    [allSavedFamilies, researchStates, brandFilter, sourceFilter, searchQuery, withNotes],
  );
  const hasProductFilters = Boolean(searchQuery.trim()) ||
    brandFilter !== "ALL" || sourceFilter !== "ALL" || withNotes;

  function clearProductFilters() {
    setSearchQuery("");
    setBrandFilter("ALL");
    setSourceFilter("ALL");
    setWithNotes(false);
  }

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
      <section className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 sm:py-8">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 font-serif text-lg font-medium tracking-wide sm:text-2xl">
            {UI_COPY.savedProductsTitle}
          </h2>
          <details className="relative shrink-0">
            <summary className="touch-target cursor-pointer border border-line bg-cream px-3 py-2 text-sm text-ink hover:border-ink">
              Yedekleme
            </summary>
            <div className="absolute right-0 top-full z-20 mt-1 w-[min(20rem,calc(100vw-2rem))] space-y-3 border border-line bg-cream p-4 text-sm shadow-lg">
              <p className="leading-relaxed text-ink-muted">
                Kayıtlar bu tarayıcıda saklanır. Başka bir cihazda görmek için yedeği o cihazda içe aktar.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={downloadBackup} className="touch-target border border-line px-3 py-2 hover:border-ink">
                  Yedeği indir
                </button>
                <label className="touch-target cursor-pointer border border-line px-3 py-2 hover:border-ink focus-within:border-ink">
                  Yedeği içe aktar
                  <input type="file" accept=".json,application/json" onChange={uploadBackup} className="sr-only" aria-label="Yedeği içe aktar" />
                </label>
              </div>
              {backupMessage && <p role="status" className="text-ink">{backupMessage}</p>}
            </div>
          </details>
        </div>

        <div className="flex gap-2 border-b border-line pb-2" role="group" aria-label="Kayıt türü">
          <button
            type="button"
            onClick={() => setPageTab("products")}
            aria-pressed={pageTab === "products"}
            className={`touch-target border px-4 py-2 text-xs font-medium tracking-wide ${
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
            aria-pressed={pageTab === "brands"}
            className={`touch-target border px-4 py-2 text-xs font-medium tracking-wide ${
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
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-[minmax(0,1fr)_13rem_13rem_auto]">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Marka, model veya not ara"
                  aria-label="Marka, model veya not ara"
                  className={`${FIELD_CLASS} col-span-2 lg:col-span-1`}
                />
                <select
                  aria-label="Markaya göre filtrele"
                  value={brandFilter}
                  onChange={(event) => setBrandFilter(event.target.value)}
                  className={FIELD_CLASS}
                >
                  <option value="ALL">Tüm Markalar</option>
                  {brandOptions.map((brand) => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Kaynağa göre filtrele"
                  value={sourceFilter}
                  onChange={(event) => setSourceFilter(event.target.value)}
                  className={FIELD_CLASS}
                >
                  <option value="ALL">Tüm Kaynaklar</option>
                  {sourceOptions.map(([sourceId, label]) => (
                    <option key={sourceId} value={sourceId}>
                      {label}
                    </option>
                  ))}
                </select>
                <label className="touch-target col-span-2 inline-flex w-fit cursor-pointer items-center gap-2 border border-line px-3 py-2 text-sm hover:border-ink lg:col-span-1">
                  <input
                    type="checkbox"
                    className="size-4 accent-ink"
                    checked={withNotes}
                    onChange={(event) => setWithNotes(event.target.checked)}
                  />
                  Notu olanlar
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p role="status" className="text-sm text-ink-muted">
                  <span className="font-medium text-ink">{UI_COPY.modelsCount(savedFamilies.length)}</span>
                  {savedFamilies.length > 1 && " · Son kaydedilenler önce"}
                </p>
                {hasProductFilters && (
                  <button type="button" onClick={clearProductFilters} className="touch-target text-sm text-ink underline underline-offset-4">
                    Filtreleri temizle
                  </button>
                )}
              </div>
            </div>

            <ModelFamilyProductGrid
              items={visibleItems}
              emptyMessage={savedIds.length === 0 ? UI_COPY.emptySaved : UI_COPY.emptyFilters}
              density="visual"
              researchStates={researchStates}
              onSelectItem={setSelectedFamilyId}
              onToggleReviewed={(id, reviewed) => researchRepo.setReviewed(id, reviewed)}
              onToggleSaved={(id, saved, note) => researchRepo.setSaved(id, saved, note)}
              onSaveNote={(id, note) => researchRepo.setNote(id, note)}
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
            searchQuery={brandSearchQuery}
            onSearchQuery={setBrandSearchQuery}
            countryId={countryId}
            onCountryId={setCountryId}
            isSaved={isSaved}
            setSaved={setSaved}
            onSelectBrand={onSelectBrand}
          />
        ) : null}
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
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_13rem]">
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQuery(event.target.value)}
          placeholder="Kayıtlı marka ara"
          aria-label="Kayıtlı marka ara"
          className={FIELD_CLASS}
        />
        <select
          aria-label="Ülkeye göre filtrele"
          value={countryId}
          onChange={(event) => onCountryId(event.target.value)}
          className={FIELD_CLASS}
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
        <p className="py-8 text-center text-sm text-ink-muted">
          {searchQuery.trim() || countryId !== ALL_COUNTRIES_ID
            ? "Filtrelere uygun kayıtlı marka bulunamadı."
            : UI_COPY.emptySavedBrands}
        </p>
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
