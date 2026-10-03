import { useState } from "react";

import { loadCatalogSummary } from "../../catalog/catalogClient";
import { CatalogErrorState, CatalogLoadingState } from "../../catalog/CatalogStatus";
import {
  brandCardCountryLabel,
  brandSummariesForIndex,
  countryOptionsFromSummary,
} from "../../catalog/brandIndexFromSummary";
import { useCatalogResource } from "../../catalog/useCatalogResource";
import { ALL_COUNTRIES_ID } from "../../brands/countryGrouping";
import {
  BRAND_CARD_SIZES,
  resolveDisplayImage,
} from "../../images/resolveImageQuality";
import { UI_COPY } from "../../presentation/turkishLabels";
import { useBrandFavorites } from "../../research/useBrandFavorites";
import ImagePlaceholder from "../radar/ImagePlaceholder";
import { brandPriceSegmentLabel, type BrandPriceSegmentFilter as SegmentFilter } from "../../brands/brandPriceSegments";
import BrandPriceSegmentFilter from "./BrandPriceSegmentFilter";

interface BrandsIndexProps {
  onSelectBrand: (brandId: string, brandName: string) => void;
}

function BrandCardImages({
  images,
  brand,
  priority,
}: {
  images: string[];
  brand: string;
  priority: boolean;
}) {
  const resolved = images
    .map((url) => resolveDisplayImage(url, BRAND_CARD_SIZES))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (resolved.length === 0) {
    return <ImagePlaceholder alt={brand} label={UI_COPY.noImage} />;
  }

  const image = resolved[0]!;
  return (
    <img
      src={image.src}
      srcSet={image.srcSet}
      sizes={image.sizes}
      alt={brand}
      className="h-full w-full object-contain object-center"
      loading={priority ? "eager" : "lazy"}
      decoding="async"
    />
  );
}

export default function BrandsIndex({ onSelectBrand }: BrandsIndexProps) {
  const { state, retry } = useCatalogResource(() => loadCatalogSummary(), []);
  const [countryId, setCountryId] = useState(ALL_COUNTRIES_ID);
  const [segment, setSegment] = useState<SegmentFilter>("all");
  const [brandMode, setBrandMode] = useState<"all" | "saved">("all");
  const { isSaved, setSaved } = useBrandFavorites();

  if (state.status === "loading") {
    return <CatalogLoadingState message={UI_COPY.appLoading} />;
  }
  if (state.status === "error") {
    return <CatalogErrorState onRetry={retry} />;
  }

  const countryOptions = countryOptionsFromSummary(state.data);
  const cards = brandSummariesForIndex(state.data, countryId, segment).filter((card) =>
    brandMode === "saved" ? isSaved(card.brandId) : true,
  );

  const modeChip = (active: boolean) =>
    `border px-3 py-1.5 text-[10px] tracking-widest ${
      active ? "border-ink bg-ink text-cream" : "border-line text-ink-muted hover:border-ink"
    }`;

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        <div>
          <h2 className="font-serif text-2xl font-medium tracking-wide sm:text-3xl">
            {UI_COPY.brandsTitle}
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
            {UI_COPY.brandsSubtitle}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setBrandMode("all")}
            className={modeChip(brandMode === "all")}
          >
            {UI_COPY.allBrands}
          </button>
          <button
            type="button"
            onClick={() => setBrandMode("saved")}
            className={modeChip(brandMode === "saved")}
          >
            {UI_COPY.savedBrandsFilter}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCountryId(ALL_COUNTRIES_ID)}
            className={`border px-3 py-1.5 text-[10px] tracking-widest ${
              countryId === ALL_COUNTRIES_ID
                ? "border-ink bg-ink text-cream"
                : "border-line text-ink-muted hover:border-ink"
            }`}
          >
            {UI_COPY.allCountries}
          </button>
          {countryOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setCountryId(option.id)}
              className={`border px-3 py-1.5 text-[10px] tracking-widest ${
                countryId === option.id
                  ? "border-ink bg-ink text-cream"
                  : "border-line text-ink-muted hover:border-ink"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <BrandPriceSegmentFilter value={segment} onChange={setSegment} />
        <p className="text-[10px] text-ink-muted">{cards.length} marka</p>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, index) => {
            const saved = isSaved(card.brandId);
            const segmentLabel = brandPriceSegmentLabel(card.brandId, card.brandName);
            return (
              <article
                key={card.brandId}
                className="group overflow-hidden border border-line bg-white/40 text-left transition-colors hover:border-ink"
              >
                <button
                  type="button"
                  onClick={() => onSelectBrand(card.brandId, card.brandName)}
                  className="block w-full text-left"
                >
                  <div className="relative aspect-[5/4] overflow-hidden bg-cream">
                    <BrandCardImages
                      images={card.images}
                      brand={card.brandName}
                      priority={index < 3}
                    />
                  </div>
                  <div className="space-y-1 px-4 pt-4">
                    <h3 className="font-serif text-xl tracking-wide sm:text-2xl">{card.brandName}</h3>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                      {brandCardCountryLabel(card)}
                      {segmentLabel ? ` · ${segmentLabel}` : ""}
                    </p>
                    <p className="text-[11px] text-ink-muted">
                      {UI_COPY.productsCount(card.productCount)}
                      {card.verifiedNewCount > 0 ? ` · ${UI_COPY.newCount(card.verifiedNewCount)}` : ""}
                    </p>
                  </div>
                </button>
                <div className="px-4 pb-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setSaved(card.brandId, !saved)}
                    className="text-[9px] tracking-[0.14em] text-ink-faint hover:text-ink"
                  >
                    {saved ? UI_COPY.savedBrand : UI_COPY.saveBrand}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        {cards.length === 0 ? (
          <p className="text-sm text-ink-muted">{brandMode === "saved" && segment === "all" && countryId === ALL_COUNTRIES_ID
            ? UI_COPY.emptySavedBrands : "Seçtiğiniz filtrelere uygun marka bulunamadı."}</p>
        ) : null}
      </div>
    </section>
  );
}
