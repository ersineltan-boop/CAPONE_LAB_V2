import { useEffect, useMemo, useState } from "react";

import { loadFamilyById, loadVisualResults, loadVisualSummary } from "../../catalog/catalogClient";
import { CatalogErrorState, CatalogLoadingState } from "../../catalog/CatalogStatus";
import { useCatalogResource } from "../../catalog/useCatalogResource";
import {
  VISUAL_BASIC_CATEGORIES,
  type VisualBasicCategoryId,
} from "../../visual/basicCategories";
import type { VisualCard } from "../../visual/types";
import { PAZAR_OZETI_ENABLED } from "./visualWallSections";
import { VISUAL_PAGE_SIZE } from "../../visual/visualPages";
import { UI_COPY } from "../../presentation/turkishLabels";
import { useResearchStateMap, useResearchStateRepository } from "../../research/useResearchState";
import type { ModelFamilyGridItem } from "../../categories/modelFamilyGrid";
import ModelFamilyProductGrid from "../modelFamily/ModelFamilyProductGrid";
import ModelFamilyDetailDrawer from "../modelFamily/ModelFamilyDetailDrawer";
import type { ModelFamily } from "../../modelFamily/types";
import type { BrandPriceSegmentFilter as SegmentFilter } from "../../brands/brandPriceSegments";
import BrandPriceSegmentFilter from "../brands/BrandPriceSegmentFilter";

function cardToGridItem(card: VisualCard): ModelFamilyGridItem {
  return {
    modelFamilyId: card.modelFamilyId,
    brand: card.brand,
    canonicalName: card.productName,
    primaryCategory: "UNCLASSIFIED",
    representativeImage: card.mainImage,
    images: card.images.length > 0 ? card.images : card.mainImage ? [card.mainImage] : [],
    productUrl: card.sourceUrl,
    firstSeenAt: null,
    sourceLabel: card.brand,
    taxonomyChips: [],
    variants: card.variants,
  };
}

export default function VisualWall() {
  const [categoryId, setCategoryId] = useState<VisualBasicCategoryId>("tumu");
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyNew, setOnlyNew] = useState(false);
  const [segment, setSegment] = useState<SegmentFilter>("all");
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<ModelFamily | null>(null);
  const summary = useCatalogResource(() => loadVisualSummary(), []);
  const query = searchQuery.trim();

  const openFamily = async (modelFamilyId: string) => {
    setSelectedFamilyId(modelFamilyId);
    const family = await loadFamilyById(modelFamilyId);
    setSelectedFamily(family);
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-5">
        <div className="space-y-1">
          <h2 className="font-serif text-3xl font-medium tracking-wide sm:text-4xl">
            {UI_COPY.visualTitle}
          </h2>
          <p className="text-sm text-ink-muted">{UI_COPY.visualSubtitle}</p>
        </div>

        {PAZAR_OZETI_ENABLED ? null : null}

        <BrandPriceSegmentFilter value={segment} onChange={setSegment} />

        <div className="flex flex-wrap gap-2">
          {VISUAL_BASIC_CATEGORIES.map((category) => {
            const entry = summary.state.status === "ready"
              ? summary.state.data.categories.find((item) => item.id === category.id)
              : null;
            const counts = segment === "all" ? entry : entry?.priceSegments?.[segment];
            const count = onlyNew ? counts?.verifiedNewCount : counts?.count;
            const active = categoryId === category.id;
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={active}
                onClick={() => setCategoryId(category.id)}
                className={`border px-4 py-2.5 text-xs tracking-widest transition-colors ${
                  active
                    ? "border-ink bg-ink text-cream"
                    : "border-line text-ink-muted hover:border-ink"
                }`}
              >
                {category.label}
                {count != null ? ` ${count}` : ""}
              </button>
            );
          })}
        </div>

        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={UI_COPY.searchPlaceholder}
          className="w-full border border-line bg-cream px-3 py-2 text-[11px] text-ink sm:max-w-md"
        />

        <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-ink">
          <input
            type="checkbox"
            checked={onlyNew}
            onChange={(event) => setOnlyNew(event.target.checked)}
            className="h-4 w-4 accent-ink"
          />
          {UI_COPY.visualOnlyNew}
        </label>

        {summary.state.status === "error" ? <CatalogErrorState onRetry={summary.retry} /> : null}
        <VisualResults key={JSON.stringify([categoryId, query, onlyNew, segment])}
          categoryId={categoryId} query={query} onlyNew={onlyNew} segment={segment} openFamily={openFamily} />
      </div>

      <ModelFamilyDetailDrawer
        family={selectedFamily}
        open={Boolean(selectedFamilyId)}
        onClose={() => {
          setSelectedFamilyId(null);
          setSelectedFamily(null);
        }}
      />
    </section>
  );
}

function VisualResults({ categoryId, query, onlyNew, segment, openFamily }: {
  categoryId: VisualBasicCategoryId; query: string; onlyNew: boolean; segment: SegmentFilter;
  openFamily: (id: string) => Promise<void>;
}) {
  const researchStates = useResearchStateMap();
  const researchRepo = useResearchStateRepository();
  const [limit, setLimit] = useState(VISUAL_PAGE_SIZE);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Awaited<ReturnType<typeof loadVisualResults>>>();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let current = true;
    const timer = window.setTimeout(() => {
      void loadVisualResults(categoryId, { query, onlyNew, segment }, limit).then(data => {
        if (current) { setResult(data); setStatus("ready"); }
      }, () => {
        if (current) setStatus("error");
      });
    }, query && limit === VISUAL_PAGE_SIZE ? 180 : 0);
    return () => { current = false; window.clearTimeout(timer); };
  }, [categoryId, query, onlyNew, segment, limit, attempt]);

  const items = useMemo(() => result?.cards.map(cardToGridItem) ?? [], [result]);
  const newIds = useMemo(() => new Set(result?.cards.filter(card => card.verifiedNew)
    .map(card => card.modelFamilyId)), [result]);

  return <>
    {status === "loading" && !result ? <CatalogLoadingState /> : null}
    {status === "error" ? <CatalogErrorState onRetry={() => { setStatus("loading"); setAttempt(x => x + 1); }} /> : null}
    {result ? <>
      <p className="text-[10px] text-ink-muted">
        {UI_COPY.modelsCount(result.total)} · {UI_COPY.visualNewFirst}
      </p>
      <ModelFamilyProductGrid
        items={items}
        emptyMessage={UI_COPY.emptyFilters}
        density="wall"
        researchStates={researchStates}
        onSelectItem={(id) => { void openFamily(id); }}
        onToggleSaved={(id, saved) => researchRepo.setSaved(id, saved)}
        verifiedNewIds={newIds}
        hideTaxonomy
        loadMoreSlot={items.length < result.total ? (
          <div className="flex justify-center pt-2">
            <button type="button" disabled={status !== "ready"} aria-busy={status === "loading"}
              onClick={() => { setStatus("loading"); setLimit(x => x + VISUAL_PAGE_SIZE); }}
              className="border border-line px-4 py-2 text-[10px] tracking-widest text-ink-muted hover:border-ink hover:text-ink">
              {UI_COPY.loadMore}
            </button>
          </div>
        ) : null}
      />
    </> : null}
  </>;
}
