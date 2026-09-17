import { useState } from "react";

import VisualWallImageCarousel from "../../components/visualWall/VisualWallImageCarousel";
import ImagePlaceholder from "../../components/radar/ImagePlaceholder";
import { UI_COPY } from "../../presentation/turkishLabels";
import { formatMarketResearchPrice } from "../format";
import type { MarketResearchModel, MarketResearchVariant } from "../types";
import { isIncompleteMarketResearchVisual, marketResearchVisualLabel } from "../visualCopy";

interface MarketResearchProductGridProps {
  models: MarketResearchModel[];
  emptyMessage?: string;
}

function VariantStrip({
  variants,
  selectedId,
  onSelect,
}: {
  variants: MarketResearchVariant[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  if (variants.length <= 1) return null;
  return (
    <div className="space-y-1">
      <p className="text-[8px] tracking-[0.16em] text-ink-faint">{UI_COPY.colorsCount(variants.length)}</p>
      <div className="flex flex-wrap gap-1">
        {variants.map((variant) => {
          const active = selectedId === variant.id;
          const thumb = variant.images[0];
          return (
            <button
              key={variant.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelect(variant.id);
              }}
              className={`h-8 w-8 overflow-hidden border ${
                active ? "border-ink" : "border-line hover:border-ink"
              }`}
              title={variant.color ?? undefined}
              aria-label={variant.color ?? UI_COPY.colorsHeading}
            >
              {thumb ? (
                <img src={thumb} alt="" className="h-full w-full object-contain object-center" />
              ) : (
                <span className="block h-full w-full bg-line/40" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProductCard({ model, index }: { model: MarketResearchModel; index: number }) {
  const [selectedId, setSelectedId] = useState(model.variants[0]?.id ?? "");
  const selected = model.variants.find((variant) => variant.id === selectedId) ?? model.variants[0];
  const images = selected?.images ?? [];
  const price = selected ? formatMarketResearchPrice(selected) : null;

  return (
    <article className="group border border-line bg-cream/40 p-2 transition-colors hover:border-ink">
      <div className="relative aspect-[3/4] overflow-hidden bg-cream">
        {images.length > 0 ? (
          <VisualWallImageCarousel
            images={images}
            alt={model.name}
            hideControlsUntilHover
            priority={index < 4}
            colorVariants={model.variants}
            selectedVariantId={selectedId}
            onSelectVariant={setSelectedId}
          />
        ) : (
          <ImagePlaceholder
            alt={model.name}
            label={
              isIncompleteMarketResearchVisual(selected?.visualStatus)
                ? UI_COPY.marketResearchVisualIncomplete
                : UI_COPY.noImage
            }
            className="h-full w-full"
          />
        )}
        {selected?.productUrl ? (
          <a
            href={selected.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute right-1 top-1 z-20 border border-line bg-white/90 px-1.5 py-0.5 text-[9px] text-ink-muted transition-colors hover:border-ink hover:text-ink"
            aria-label={UI_COPY.openAtSource}
            title={UI_COPY.openAtSource}
          >
            ↗
          </a>
        ) : null}
      </div>
      <div className="mt-2 space-y-1.5">
        <h3 className="line-clamp-2 font-serif text-xs leading-snug">{model.name}</h3>
        <p className="text-[9px] tracking-wide text-ink-faint">{model.categoryLabel}</p>
        {selected?.color ? (
          <p className="text-[9px] tracking-wide text-ink-muted">{selected.color}</p>
        ) : null}
        {images.length === 0 && selected?.visualNote ? (
          <p className="text-[9px] leading-relaxed text-ink-faint">
            {marketResearchVisualLabel(selected.visualStatus, selected.visualNote)}
          </p>
        ) : null}
        <VariantStrip variants={model.variants} selectedId={selectedId} onSelect={setSelectedId} />
        {price ? (
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-baseline gap-2">
              {price.current ? (
                <p className="text-[12px] font-medium tracking-wide">{price.current}</p>
              ) : (
                <p className="text-[10px] text-ink-faint">{UI_COPY.marketResearchPricePending}</p>
              )}
              {price.list ? (
                <p className="text-[10px] text-ink-faint line-through">{price.list}</p>
              ) : null}
              {price.discount ? (
                <p className="text-[10px] tracking-wide text-ink">{price.discount}</p>
              ) : null}
            </div>
            <p className="text-[8px] tracking-[0.12em] text-ink-faint">
              {UI_COPY.marketResearchObservedAt}: {price.observedAt}
            </p>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default function MarketResearchProductGrid({
  models,
  emptyMessage = UI_COPY.emptyCategory,
}: MarketResearchProductGridProps) {
  if (models.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-muted">{emptyMessage}</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {models.map((model, index) => (
        <ProductCard key={model.id} model={model} index={index} />
      ))}
    </div>
  );
}
