import { useMemo, useState } from "react";

import { loadFamilyById, loadVisualShard, loadVisualSummary } from "../../catalog/catalogClient";
import { CatalogErrorState, CatalogLoadingState } from "../../catalog/CatalogStatus";
import { useCatalogResource } from "../../catalog/useCatalogResource";
import { filterVisualCards } from "../../visual/buildVisualDelivery";
import {
  VISUAL_BASIC_CATEGORIES,
  type VisualBasicCategoryId,
} from "../../visual/basicCategories";
import type { VisualCard } from "../../visual/types";
import { PAZAR_OZETI_ENABLED } from "./visualWallSections";
import { useProgressiveBatch } from "../../ui/useProgressiveBatch";
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
  const researchStates = useResearchStateMap();
  const researchRepo = useResearchStateRepository();

  const summary = useCatalogResource(() => loadVisualSummary(), []);
  const shard = useCatalogResource(() => loadVisualShard(categoryId), [categoryId]);

  const filteredCards = useMemo(() => {
    if (shard.state.status !== "ready") return [];
    return filterVisualCards(shard.state.data.cards, searchQuery, { onlyNew, segment });
  }, [shard.state, searchQuery, onlyNew, segment]);

  const gridItems = useMemo(() => filteredCards.map(cardToGridItem), [filteredCards]);
  const { visibleItems, hasMore, loadMore } = useProgressiveBatch(
    gridItems,
    48,
    `${categoryId}|${searchQuery}|${onlyNew}|${segment}|${filteredCards.length}`,
  );

  const verifiedNewIds = useMemo(
    () => new Set(filteredCards.filter((card) => card.verifiedNew).map((card) => card.modelFamilyId)),
    [filteredCards],
  );

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

        {summary.state.status === "loading" || shard.state.status === "loading" ? (
          <CatalogLoadingState />
        ) : null}
        {summary.state.status === "error" ? <CatalogErrorState onRetry={summary.retry} /> : null}
        {shard.state.status === "error" ? <CatalogErrorState onRetry={shard.retry} /> : null}

        {shard.state.status === "ready" ? (
          <>
            <p className="text-[10px] text-ink-muted">
              {UI_COPY.modelsCount(filteredCards.length)} · {UI_COPY.visualNewFirst}
            </p>
            <ModelFamilyProductGrid
              items={visibleItems}
              emptyMessage={UI_COPY.emptyFilters}
              density="wall"
              researchStates={researchStates}
              onSelectItem={(id) => {
                void openFamily(id);
              }}
              onToggleSaved={(id, saved) => researchRepo.setSaved(id, saved)}
              verifiedNewIds={verifiedNewIds}
              hideTaxonomy
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
