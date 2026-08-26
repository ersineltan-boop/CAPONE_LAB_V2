import { useMemo, useState } from "react";

import { loadMarketplaceShard } from "../../catalog/catalogClient";
import { CatalogErrorState, CatalogLoadingState } from "../../catalog/CatalogStatus";
import { useCatalogResource } from "../../catalog/useCatalogResource";
import { getMarketplaceById } from "../../registry/data/marketplaces";
import {
  extractMarketplaceBrands,
  filterFamiliesForMarketplaceSource,
  filterVerifiedNewForSource,
} from "../../source/sourceProductQuery";
import {
  countFamiliesByBasicCategory,
  filterFamiliesByBasicCategory,
} from "../../visual/basicCategories";
import { UI_COPY } from "../../presentation/turkishLabels";
import SourceProductBrowse from "../source/SourceProductBrowse";

type MarketplaceMode = "all" | "verified-new" | "categories" | "brands";

interface MarketplaceDetailProps {
  marketplaceId: string;
  onBack: () => void;
  selectedCategoryId?: string | null;
  onSelectCategory?: (categoryId: string | null) => void;
}

export default function MarketplaceDetail({
  marketplaceId,
  onBack,
  selectedCategoryId: selectedCategoryFromNav = null,
  onSelectCategory,
}: MarketplaceDetailProps) {
  const marketplace = getMarketplaceById(marketplaceId);
  const [mode, setMode] = useState<MarketplaceMode>("all");
  const [localCategoryId, setLocalCategoryId] = useState<string | null>(selectedCategoryFromNav);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const selectedCategoryId = onSelectCategory ? selectedCategoryFromNav : localCategoryId;
  const setSelectedCategoryId = onSelectCategory ?? setLocalCategoryId;
  const { state, retry } = useCatalogResource(
    () => loadMarketplaceShard(marketplaceId),
    [marketplaceId],
  );

  const shardFamilies = state.status === "ready" ? state.data.families : [];

  const marketplaceFamilies = useMemo(
    () => filterFamiliesForMarketplaceSource(shardFamilies, marketplaceId, selectedBrand),
    [shardFamilies, marketplaceId, selectedBrand],
  );

  const categories = useMemo(
    () => countFamiliesByBasicCategory(shardFamilies).filter((item) => item.id !== "tumu"),
    [shardFamilies],
  );

  const brands = useMemo(
    () => extractMarketplaceBrands(shardFamilies, marketplaceId),
    [shardFamilies, marketplaceId],
  );

  const hasVerifiedNew = useMemo(
    () => filterVerifiedNewForSource(shardFamilies, marketplaceId, "90D").length > 0,
    [shardFamilies, marketplaceId],
  );

  if (!marketplace) {
    return <p className="py-8 text-center text-sm text-ink-muted">Pazaryeri bulunamadı.</p>;
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-4 border border-line bg-white/20 p-4 sm:p-5">
        <div className="space-y-2">
          <button
            type="button"
            onClick={onBack}
            className="text-[10px] tracking-wide text-ink-muted hover:text-ink"
          >
            ← {UI_COPY.backToMarketplaces}
          </button>
          <h2 className="font-serif text-lg font-medium tracking-wide">{marketplace.name}</h2>
          {state.status === "ready" ? (
            <p className="text-[10px] text-ink-muted">
              {UI_COPY.modelsCount(marketplaceFamilies.length)} · {brands.length} marka ·{" "}
              {categories.length} kategori
            </p>
          ) : null}
        </div>

        {state.status === "loading" ? <CatalogLoadingState /> : null}
        {state.status === "error" ? <CatalogErrorState onRetry={retry} /> : null}

        {state.status === "ready" ? (
          <>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", UI_COPY.allProducts],
                  ["verified-new", UI_COPY.categoryNewArrivals],
                  ["categories", UI_COPY.sourceCategories],
                  ["brands", UI_COPY.marketplaceBrands],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setMode(value);
                    setSelectedCategoryId(null);
                    if (value !== "brands") setSelectedBrand(null);
                  }}
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

            {mode === "verified-new" && !hasVerifiedNew && (
              <p className="text-[10px] text-ink-muted">{UI_COPY.noVerifiedNewAtSource}</p>
            )}

            {mode === "brands" ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedBrand(null)}
                    className={`border px-2 py-1 text-[10px] ${
                      !selectedBrand ? "border-ink bg-ink text-cream" : "border-line text-ink-muted"
                    }`}
                  >
                    {UI_COPY.allProducts}
                  </button>
                  {brands.map((entry) => (
                    <button
                      key={entry.brand}
                      type="button"
                      onClick={() => setSelectedBrand(entry.brand)}
                      className={`border px-2 py-1 text-[10px] ${
                        selectedBrand === entry.brand
                          ? "border-ink bg-ink text-cream"
                          : "border-line text-ink-muted"
                      }`}
                    >
                      {entry.brand} ({entry.count})
                    </button>
                  ))}
                </div>
                <SourceProductBrowse
                  sourceId={marketplaceId}
                  sourceLabel={marketplace.name}
                  mode="all"
                  baseFamilies={marketplaceFamilies}
                  brandFilter={selectedBrand}
                  showCategorySidebar={false}
                  hideSourceCategoryLabel
                />
              </div>
            ) : (
              <div className="space-y-3">
                {mode === "categories" ? (
                  <div className="flex max-w-4xl flex-wrap gap-2">
                    {countFamiliesByBasicCategory(marketplaceFamilies).map((category) => {
                      const active =
                        category.id === "tumu"
                          ? !selectedCategoryId
                          : selectedCategoryId === category.id;
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() =>
                            setSelectedCategoryId(category.id === "tumu" ? null : category.id)
                          }
                          className={`border px-2 py-1 text-[10px] ${
                            active
                              ? "border-ink bg-ink text-cream"
                              : "border-line text-ink-muted"
                          }`}
                        >
                          {category.label} {category.count}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                <SourceProductBrowse
                  sourceId={marketplaceId}
                  sourceLabel={marketplace.name}
                  mode={mode === "verified-new" ? "verified-new" : "all"}
                  baseFamilies={
                    mode === "categories"
                      ? filterFamiliesByBasicCategory(marketplaceFamilies, selectedCategoryId)
                      : marketplaceFamilies
                  }
                  selectedCategoryId={null}
                  showCategorySidebar={false}
                  hideSourceCategoryLabel
                />
              </div>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}
