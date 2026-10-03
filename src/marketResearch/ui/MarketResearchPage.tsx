import { UI_COPY } from "../../presentation/turkishLabels";
import { formatMarketResearchObservedAt } from "../format";
import { romaniaBrandCards, romaniaCountrySummary } from "../romania/catalog";
import ImagePlaceholder from "../../components/radar/ImagePlaceholder";
import { isIncompleteMarketResearchVisual, marketResearchVisualLabel } from "../visualCopy";
import { canSeeMarketResearch, readMarketResearchDataForRole } from "../../auth/permissions";
import { useSession } from "../../auth/useSession";

interface MarketResearchPageProps {
  onSelectBrand: (brandId: string) => void;
}

export default function MarketResearchPage({ onSelectBrand }: MarketResearchPageProps) {
  const session = useSession();
  if (!canSeeMarketResearch(session.user.role)) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <p data-testid="market-research-denied" className="text-sm text-ink-muted">
          {UI_COPY.marketResearchDenied}
        </p>
      </section>
    );
  }

  const summary = readMarketResearchDataForRole(
    session.user.role,
    romaniaCountrySummary,
  );
  const cards =
    readMarketResearchDataForRole(session.user.role, romaniaBrandCards) ?? [];

  if (!summary) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        <div>
          <h2
            data-testid="market-research-page"
            className="font-serif text-2xl font-medium tracking-wide sm:text-3xl"
          >
            {UI_COPY.marketResearchTitle}
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
            {UI_COPY.marketResearchSubtitle}
          </p>
          <p className="mt-2 text-[10px] tracking-wide text-ink-faint">
            {UI_COPY.marketResearchSnapshotNote} · {UI_COPY.marketResearchObservedAt}:{" "}
            {formatMarketResearchObservedAt(summary.observedAt)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="border border-ink bg-ink px-3 py-1.5 text-[10px] tracking-widest text-cream"
          >
            {UI_COPY.marketResearchRomania}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, index) => (
            <article
              key={card.id}
              className={`group overflow-hidden border text-left transition-colors hover:border-ink ${
                isIncompleteMarketResearchVisual(card.visualStatus)
                  ? "border-dashed border-line bg-cream/30"
                  : "border-line bg-white/40"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectBrand(card.id)}
                className="block w-full text-left"
              >
                <div className="relative aspect-[5/4] overflow-hidden bg-cream">
                  {card.images[0] ? (
                    <img
                      src={card.images[0]}
                      alt={card.name}
                      className="h-full w-full object-contain object-center"
                      loading={index < 3 ? "eager" : "lazy"}
                      decoding="async"
                    />
                  ) : (
                    <ImagePlaceholder
                      alt={card.name}
                      label={
                        isIncompleteMarketResearchVisual(card.visualStatus)
                          ? UI_COPY.marketResearchSourceUnavailable
                          : UI_COPY.noImage
                      }
                      className="h-full w-full"
                    />
                  )}
                </div>
                <div className="space-y-1 px-4 py-4">
                  <h3 className="font-serif text-xl tracking-wide sm:text-2xl">{card.name}</h3>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                    {UI_COPY.marketResearchOrigin}: {card.originCountryLabel}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                    {UI_COPY.marketResearchSalesMarket}: {card.salesMarketLabel}
                  </p>
                  <p className="text-[11px] text-ink-muted">
                    {card.soldInSalesMarket
                      ? UI_COPY.marketResearchSoldInMarket
                      : UI_COPY.marketResearchNotSoldInMarket}
                    {card.modelCount > 0 ? ` · ${UI_COPY.modelsCount(card.modelCount)}` : ""}
                  </p>
                  {isIncompleteMarketResearchVisual(card.visualStatus) ? (
                    <p className="text-[10px] leading-relaxed text-ink-faint">
                      {marketResearchVisualLabel(card.visualStatus, card.visualNote)}
                    </p>
                  ) : null}
                </div>
              </button>
              <div className="flex flex-wrap gap-2 px-4 pb-4">
                {card.sourceLinks.map((link) => (
                  <a
                    key={`${card.id}-${link.url}`}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] tracking-[0.14em] text-ink-faint hover:text-ink"
                  >
                    {link.label} ↗
                  </a>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
