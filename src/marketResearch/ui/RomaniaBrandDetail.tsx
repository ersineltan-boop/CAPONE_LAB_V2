import { useMemo, useState } from "react";

import { UI_COPY } from "../../presentation/turkishLabels";
import { countModelsByCategory, filterModelsByCategory } from "../categories";
import { findRomaniaBrand, getRomaniaCatalog } from "../romania/catalog";
import { isIncompleteMarketResearchVisual, marketResearchVisualLabel } from "../visualCopy";
import MarketResearchProductGrid from "./MarketResearchProductGrid";

interface RomaniaBrandDetailProps {
  brandId: string;
  onBack: () => void;
}

export default function RomaniaBrandDetail({ brandId, onBack }: RomaniaBrandDetailProps) {
  const catalog = getRomaniaCatalog();
  const brand = findRomaniaBrand(brandId, catalog);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const categories = useMemo(
    () => (brand ? countModelsByCategory(brand.models) : []),
    [brand],
  );
  const models = useMemo(
    () => (brand ? filterModelsByCategory(brand.models, categoryId) : []),
    [brand, categoryId],
  );

  if (!brand) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <button
          type="button"
          onClick={onBack}
          className="text-[10px] tracking-wide text-ink-muted hover:text-ink"
        >
          ← {UI_COPY.backToMarketResearch}
        </button>
        <p className="mt-6 text-sm text-ink-muted">{UI_COPY.marketResearchEmptyBrand}</p>
      </section>
    );
  }

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
            ← {UI_COPY.backToMarketResearch}
          </button>
          <h2 className="font-serif text-3xl font-medium tracking-wide sm:text-4xl">{brand.name}</h2>
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">
            {UI_COPY.marketResearchOrigin}: {brand.originCountryLabel} ({brand.originCountry}) ·{" "}
            {UI_COPY.marketResearchSalesMarket}: {catalog.salesMarketLabel} ({brand.salesMarket})
          </p>
          <p className="text-[11px] text-ink-muted">
            {brand.soldInSalesMarket
              ? UI_COPY.marketResearchSoldInMarket
              : UI_COPY.marketResearchNotSoldInMarket}
            {brand.models.length > 0 ? ` · ${UI_COPY.modelsCount(brand.models.length)}` : ""}
          </p>
          {isIncompleteMarketResearchVisual(brand.visualStatus) ? (
            <p className="border border-dashed border-line bg-cream/40 px-3 py-2 text-[10px] leading-relaxed text-ink-muted">
              {marketResearchVisualLabel(brand.visualStatus, brand.visualNote)}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="text-[9px] tracking-[0.16em] text-ink-faint">{UI_COPY.marketResearchSources}</span>
            {brand.sourceLinks.map((link) => (
              <a
                key={`${link.kind}-${link.url}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-line px-2 py-1 text-[10px] tracking-wide text-ink-muted hover:border-ink hover:text-ink"
              >
                {link.label} ↗
              </a>
            ))}
          </div>
        </div>

        {categories.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-[11px] tracking-[0.22em] text-ink-muted">{UI_COPY.categoriesHeading}</h3>
            <div className="flex max-w-4xl flex-wrap gap-2">
              {categories.map((category) => {
                const active = category.id === "tumu" ? !categoryId : categoryId === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setCategoryId(category.id === "tumu" ? null : category.id)}
                    className={chipClass(active)}
                  >
                    {category.label} {category.count}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <MarketResearchProductGrid
          models={models}
          emptyMessage={UI_COPY.marketResearchEmptyBrand}
        />
      </div>
    </section>
  );
}
