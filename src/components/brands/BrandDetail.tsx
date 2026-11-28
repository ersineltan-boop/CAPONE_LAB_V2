import { useMemo, useState } from "react";

import { loadBrandShard } from "../../catalog/catalogClient";
import { CatalogErrorState, CatalogLoadingState } from "../../catalog/CatalogStatus";
import { useCatalogResource } from "../../catalog/useCatalogResource";
import { filterVerifiedNewForSource, slugifyBrandId } from "../../source/sourceProductQuery";
import {
  countFamiliesByBasicCategory,
  filterFamiliesByBasicCategory,
} from "../../visual/basicCategories";
import { UI_COPY } from "../../presentation/turkishLabels";
import { formatDateTurkish } from "../../presentation/turkishDates";
import SourceProductBrowse from "../source/SourceProductBrowse";

type BrandDetailMode = "all" | "verified-new";

interface BrandDetailProps {
  brandId: string;
  brandName: string;
  onBack: () => void;
  selectedCategoryId?: string | null;
  onSelectCategory?: (categoryId: string | null) => void;
}

export default function BrandDetail({
  brandId,
  brandName,
  onBack,
  selectedCategoryId = null,
  onSelectCategory,
}: BrandDetailProps) {
  const [mode, setMode] = useState<BrandDetailMode>("all");
  const [localCategoryId, setLocalCategoryId] = useState<string | null>(selectedCategoryId);
  const sourceId = slugifyBrandId(brandName);
  const categoryId = onSelectCategory ? selectedCategoryId : localCategoryId;
  const { state, retry } = useCatalogResource(() => loadBrandShard(brandId), [brandId]);

  const shard = state.status === "ready" && state.data.id === brandId ? state.data : undefined;
  const brandFamilies = shard?.families ?? [];
  const freshness = shard?.brandFreshness;

  const basicCategories = useMemo(
    () => countFamiliesByBasicCategory(brandFamilies),
    [brandFamilies],
  );

  const verifiedNewIds = useMemo(
    () => new Set(filterVerifiedNewForSource(brandFamilies, sourceId, "90D")
      .map((family) => family.modelFamilyId)),
    [brandFamilies, sourceId],
  );
  const verifiedNewCount = verifiedNewIds.size;

  const displayFamilies = useMemo(() => {
    const families = filterFamiliesByBasicCategory(brandFamilies, categoryId);
    return [...families].sort(
      (first, second) =>
        Number(verifiedNewIds.has(second.modelFamilyId)) -
        Number(verifiedNewIds.has(first.modelFamilyId)),
    );
  }, [brandFamilies, categoryId, verifiedNewIds]);

  const hasVerifiedNew = verifiedNewCount > 0;

  const setCategory = (next: string | null) => {
    if (onSelectCategory) onSelectCategory(next);
    else setLocalCategoryId(next);
  };

  const chipClass = (active: boolean) =>
    `border px-4 py-2.5 text-xs tracking-widest transition-colors ${
      active ? "border-ink bg-ink text-cream" : "border-line text-ink-muted hover:border-ink"
    }`;

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-5">
        <div className="space-y-2">
          <button
            type="button"
            onClick={onBack}
            className="text-[10px] tracking-wide text-ink-muted hover:text-ink"
          >
            ← {UI_COPY.backToBrands}
          </button>
          <h2 className="font-serif text-3xl font-medium tracking-wide sm:text-4xl">
            {brandName}
          </h2>
          {shard ? (
            <p className="text-sm text-ink-muted">
              {UI_COPY.productsCount(brandFamilies.length)}
              {verifiedNewCount > 0 ? (
                <span className="ml-3 text-ink">{UI_COPY.newCount(verifiedNewCount)}</span>
              ) : null}
            </p>
          ) : null}
          {shard && (
            <p className="text-xs text-ink-muted">
              {freshness ? (
                <>
                  {freshness.kind === "verified-update"
                    ? "Son doğrulanmış güncelleme"
                    : "Resmî kaynakta son ürün kontrolü"}{" "}
                  <time dateTime={freshness.at}>{formatDateTurkish(freshness.at, "Europe/Istanbul")}</time>
                </>
              ) : "Son doğrulanmış güncelleme tarihi bulunamadı."}
            </p>
          )}
          {shard?.coverage?.status === "PARTIAL" && (
            <p className="text-xs text-ink-muted">Katalog kısmi. Doğrulanmış ürünler gösteriliyor.</p>
          )}
        </div>

        {state.status === "loading" ? <CatalogLoadingState /> : null}
        {state.status === "error" ? <CatalogErrorState onRetry={retry} /> : null}

        {shard ? (
          <>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", UI_COPY.brandAllProducts],
                  ["verified-new", UI_COPY.brandNewArrivals],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={chipClass(mode === value)}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "verified-new" && !hasVerifiedNew && (
              <p className="text-[11px] text-ink-muted">{UI_COPY.noVerifiedNewAtSource}</p>
            )}

            <div className="space-y-3">
              <h3 className="text-[11px] tracking-[0.22em] text-ink-muted">
                {UI_COPY.categoriesHeading}
              </h3>
              <div className="flex max-w-4xl flex-wrap gap-2">
                {basicCategories.map((category) => {
                  const active =
                    category.id === "tumu" ? !categoryId : categoryId === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setCategory(category.id === "tumu" ? null : category.id)}
                      className={chipClass(active)}
                    >
                      {category.label} {category.count}
                    </button>
                  );
                })}
              </div>
            </div>

            <SourceProductBrowse
              sourceId={sourceId}
              sourceLabel={brandName}
              mode={mode === "verified-new" ? "verified-new" : "all"}
              baseFamilies={displayFamilies}
              selectedCategoryId={null}
              onSelectCategory={setCategory}
              showCategorySidebar={false}
              hideBrandName
              hideSourceCategoryLabel
            />
          </>
        ) : null}
      </div>
    </section>
  );
}
