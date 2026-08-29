import { loadCatalogSummary } from "../../catalog/catalogClient";
import { CatalogErrorState, CatalogLoadingState } from "../../catalog/CatalogStatus";
import { useCatalogResource } from "../../catalog/useCatalogResource";
import { UI_COPY } from "../../presentation/turkishLabels";
import { BRAND_CARD_SIZES, resolveDisplayImage } from "../../images/resolveImageQuality";
import ImagePlaceholder from "../radar/ImagePlaceholder";

interface MarketplacesIndexProps {
  onSelectMarketplace: (marketplaceId: string) => void;
}

export default function MarketplacesIndex({ onSelectMarketplace }: MarketplacesIndexProps) {
  const { state, retry } = useCatalogResource(() => loadCatalogSummary(), []);

  if (state.status === "loading") {
    return <CatalogLoadingState message={UI_COPY.appLoading} />;
  }
  if (state.status === "error") {
    return <CatalogErrorState onRetry={retry} />;
  }

  const visible = state.data.marketplaces.filter((item) => item.productCount > 0);

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-5">
        <div>
          <h2 className="font-serif text-2xl font-medium tracking-wide sm:text-3xl">
            {UI_COPY.marketplacesTitle}
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
            {UI_COPY.marketplacesSubtitle}
          </p>
        </div>

        {visible.length === 0 ? (
          <p className="border border-line bg-white/30 px-4 py-8 text-center text-[11px] text-ink-muted">
            {UI_COPY.marketplaceEmpty}
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {visible.map((entry) => {
              const hero = entry.images[0]
                ? resolveDisplayImage(entry.images[0], BRAND_CARD_SIZES)
                : null;
              return (
                <button
                  key={entry.sourceId}
                  type="button"
                  onClick={() => onSelectMarketplace(entry.sourceId)}
                  className="overflow-hidden border border-line bg-white/40 text-left transition-colors hover:border-ink"
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-cream">
                    {hero ? (
                      <img
                        src={hero.src}
                        srcSet={hero.srcSet}
                        sizes={hero.sizes}
                        alt={entry.name}
                        className="h-full w-full object-cover object-center"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <ImagePlaceholder alt={entry.name} label={UI_COPY.noImage} />
                    )}
                  </div>
                  <div className="space-y-1 p-4">
                    <h3 className="font-serif text-xl tracking-wide">{entry.name}</h3>
                    <p className="text-[11px] text-ink-muted">
                      {UI_COPY.productsCount(entry.productCount)} · {entry.brandCount} marka ·{" "}
                      {entry.categoryCount} kategori
                    </p>
                    {entry.verifiedNewCount > 0 && (
                      <p className="text-[10px] text-ink-faint">
                        {UI_COPY.newCount(entry.verifiedNewCount)}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
