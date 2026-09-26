import { useMemo, useState } from "react";

import type { ModelFamilyGridItem } from "../../categories/modelFamilyGrid";
import { galleryForSelectedColor } from "../../images/galleryImages";
import { getTaxonomyChipLabel, UI_COPY } from "../../presentation/turkishLabels";
import type { ModelFamilyResearchState } from "../../research/types";
import { isReviewed, isSaved } from "../../research/researchStateRepository";
import VisualWallImageCarousel from "../visualWall/VisualWallImageCarousel";
import type { ColorVariantView } from "../../modelFamily/colorVariants";

export type GridDensity = "visual" | "compact" | "wall";

interface ModelFamilyProductGridProps {
  items: ModelFamilyGridItem[];
  emptyMessage?: string;
  onSelectItem?: (modelFamilyId: string) => void;
  density?: GridDensity;
  researchStates?: Map<string, ModelFamilyResearchState>;
  onToggleReviewed?: (modelFamilyId: string, reviewed: boolean) => void;
  onToggleSaved?: (modelFamilyId: string, saved: boolean) => void;
  verifiedNewIds?: Set<string>;
  loadMoreSlot?: React.ReactNode;
  hideBrand?: boolean;
  hideTaxonomy?: boolean;
  showPrice?: boolean;
}

const GRID_CLASS: Record<GridDensity, string> = {
  visual: "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4",
  compact: "grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
  wall: "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
};

function ColorVariantStrip({
  variants,
  selectedId,
  onSelect,
}: {
  variants: ColorVariantView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (variants.length <= 1) return null;
  return (
    <div className="space-y-1">
      <p className="text-[8px] tracking-[0.16em] text-ink-faint">{UI_COPY.colorsCount(variants.length)}</p>
      <div className="flex flex-wrap gap-1">
        {variants.map((variant) => {
          const active = selectedId === variant.id;
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
              {variant.thumbnail ? (
                <img
                  src={variant.thumbnail}
                  alt=""
                  className="h-full w-full object-contain object-center"
                />
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

function ProductCard({
  item,
  index,
  onSelectItem,
  researchState,
  onToggleReviewed,
  onToggleSaved,
  isVerifiedNew,
  hideBrand,
  hideTaxonomy,
  showPrice,
}: {
  item: ModelFamilyGridItem;
  index: number;
  onSelectItem?: (modelFamilyId: string) => void;
  researchState?: ModelFamilyResearchState;
  onToggleReviewed?: (modelFamilyId: string, reviewed: boolean) => void;
  onToggleSaved?: (modelFamilyId: string, saved: boolean) => void;
  isVerifiedNew: boolean;
  hideBrand: boolean;
  hideTaxonomy: boolean;
  showPrice: boolean;
}) {
  const variants = item.variants ?? [];
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    variants[0]?.id ?? null,
  );
  const selected = variants.find((variant) => variant.id === selectedVariantId) ?? variants[0];
  const images =
    selected && selected.images.length > 0
      ? selected.images
      : item.images.length > 0
        ? item.images
        : item.representativeImage
          ? [item.representativeImage]
          : [];
  const productUrl = selected?.url ?? item.productUrl;
  const reviewed = researchState ? isReviewed(researchState) : false;
  const saved = researchState ? isSaved(researchState) : false;
  const priceLabel = resolveVisiblePriceLabel(item, showPrice);

  const chipLabels = hideTaxonomy
    ? []
    : item.taxonomyChips
        .map((chip) => getTaxonomyChipLabel(chip, item.primaryCategory))
        .filter((label): label is string => Boolean(label))
        .filter((label, labelIndex, all) => all.indexOf(label) === labelIndex)
        .slice(0, 3);

  return (
    <article className="group border border-line bg-cream/40 p-2 transition-colors hover:border-ink">
      <div className="relative aspect-[3/4] overflow-hidden bg-cream">
        <VisualWallImageCarousel
          images={images}
          alt={item.canonicalName}
          hideControlsUntilHover
          priority={index < 4}
          colorVariants={variants}
          selectedVariantId={selected?.id ?? null}
          onSelectVariant={setSelectedVariantId}
        />
        {isVerifiedNew && (
          <span className="absolute left-1 top-1 z-20 border border-ink bg-ink px-1.5 py-0.5 text-[8px] tracking-widest text-cream">
            {UI_COPY.verifiedNewBadge}
          </span>
        )}
        {productUrl && (
          <a
            href={productUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="absolute right-1 top-1 z-20 border border-line bg-white/90 px-1.5 py-0.5 text-[9px] text-ink-muted transition-colors hover:border-ink hover:text-ink"
            aria-label={UI_COPY.openAtSource}
            title={UI_COPY.openAtSource}
          >
            ↗
          </a>
        )}
      </div>

      <div className="mt-2 space-y-1.5">
        <button
          type="button"
          onClick={() => onSelectItem?.(item.modelFamilyId)}
          className="w-full space-y-1 text-left"
        >
          {!hideBrand && (
            <p className="text-[9px] uppercase tracking-[0.18em] text-ink-muted">{item.brand}</p>
          )}
          <h3 className="line-clamp-2 font-serif text-xs leading-snug">{item.canonicalName}</h3>
          {priceLabel ? (
            <p className="text-[9px] tracking-wide text-ink-muted">{priceLabel}</p>
          ) : null}
          {item.sourceCategoryLabel && (
            <p className="text-[9px] tracking-wide text-ink-faint">{item.sourceCategoryLabel}</p>
          )}
          {!hideTaxonomy && chipLabels.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {chipLabels.map((label) => (
                <span
                  key={label}
                  className="border border-line px-1 py-0.5 text-[8px] tracking-wide text-ink-muted"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </button>

        <ColorVariantStrip
          variants={variants}
          selectedId={selected?.id ?? null}
          onSelect={setSelectedVariantId}
        />

        <div className="flex flex-wrap gap-1">
          {onToggleReviewed && (
            <button
              type="button"
              onClick={() => onToggleReviewed(item.modelFamilyId, !reviewed)}
              className={`border px-1.5 py-0.5 text-[8px] tracking-wide transition-colors ${
                reviewed
                  ? "border-ink bg-ink text-cream"
                  : "border-line text-ink-muted hover:border-ink"
              }`}
            >
              {reviewed ? UI_COPY.reviewed : UI_COPY.markReviewed}
            </button>
          )}
          {onToggleSaved && (
            <button
              type="button"
              onClick={() => onToggleSaved(item.modelFamilyId, !saved)}
              className={`border px-1.5 py-0.5 text-[8px] tracking-wide transition-colors ${
                saved
                  ? "border-ink bg-ink text-cream"
                  : "border-line text-ink-muted hover:border-ink"
              }`}
            >
              {saved ? UI_COPY.saved : UI_COPY.save}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function ModelFamilyProductGrid({
  items,
  emptyMessage = UI_COPY.emptyFilters,
  onSelectItem,
  density = "visual",
  researchStates,
  onToggleReviewed,
  onToggleSaved,
  verifiedNewIds,
  loadMoreSlot,
  hideBrand = false,
  hideTaxonomy = false,
  showPrice = true,
}: ModelFamilyProductGridProps) {
  const keyedItems = useMemo(() => items, [items]);

  if (keyedItems.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-muted">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-4">
      <div className={GRID_CLASS[density]}>
        {keyedItems.map((item, index) => (
          <ProductCard
            key={item.modelFamilyId}
            item={item}
            index={index}
            onSelectItem={onSelectItem}
            researchState={researchStates?.get(item.modelFamilyId)}
            onToggleReviewed={onToggleReviewed}
            onToggleSaved={onToggleSaved}
            isVerifiedNew={verifiedNewIds?.has(item.modelFamilyId) ?? false}
            hideBrand={hideBrand}
            hideTaxonomy={hideTaxonomy}
            showPrice={showPrice}
          />
        ))}
      </div>
      {loadMoreSlot}
    </div>
  );
}

export function selectVariantImages(
  item: Pick<ModelFamilyGridItem, "images" | "representativeImage" | "variants">,
  variantId: string | null,
): string[] {
  return galleryForSelectedColor(
    {
      hero: item.representativeImage,
      images: item.images,
      variants: item.variants,
    },
    variantId,
  );
}

export function selectVariantUrl(
  item: Pick<ModelFamilyGridItem, "productUrl" | "variants">,
  variantId: string | null,
): string | null {
  return item.variants?.find((variant) => variant.id === variantId)?.url ?? item.productUrl;
}

export function resolveVisiblePriceLabel(
  item: Pick<ModelFamilyGridItem, "priceLabel">,
  showPrice: boolean,
): string | null {
  return showPrice ? item.priceLabel ?? null : null;
}
