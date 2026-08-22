import {
  PRIMARY_DISPLAY_CATEGORIES,
  SECONDARY_DISPLAY_CATEGORIES,
} from "../../categories/categoryFilterConfig";
import {
  buildCategorySummaries,
  type CategorySummary,
} from "../../categories/categoryStats";
import { modelFamilies } from "../../data/modelFamilies";
import type { PrimaryFootwearCategory } from "../../taxonomy/types";
import { getCategoryLabel, UI_COPY } from "../../presentation/turkishLabels";
import ImagePlaceholder from "../radar/ImagePlaceholder";

interface CategoriesIndexProps {
  onSelectCategory: (category: PrimaryFootwearCategory) => void;
}

function CategoryCard({
  summary,
  onSelect,
}: {
  summary: CategorySummary;
  onSelect: () => void;
}) {
  const label = getCategoryLabel(summary.category);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group border border-line bg-cream/40 text-left transition-colors hover:border-ink"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-cream">
        {summary.heroImage ? (
          <img
            src={summary.heroImage}
            alt={label}
            className="h-full w-full object-cover object-center transition-transform group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <ImagePlaceholder alt={label} label={UI_COPY.noImage} />
        )}
      </div>
      <div className="space-y-1 p-3">
        <h3 className="font-serif text-sm tracking-wide">{label}</h3>
        <p className="text-[10px] text-ink-muted">
          {UI_COPY.modelsCount(summary.modelCount)}
        </p>
        {summary.verifiedNewCount > 0 && (
          <p className="text-[9px] text-ink-faint">
            {UI_COPY.verifiedNewCount(summary.verifiedNewCount)}
          </p>
        )}
      </div>
    </button>
  );
}

export default function CategoriesIndex({ onSelectCategory }: CategoriesIndexProps) {
  const primarySummaries = buildCategorySummaries(modelFamilies, [
    ...PRIMARY_DISPLAY_CATEGORIES,
  ]);
  const secondarySummaries = buildCategorySummaries(modelFamilies, [
    ...SECONDARY_DISPLAY_CATEGORIES,
  ]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-5 border border-line bg-white/20 p-4 sm:p-5">
        <div>
          <h2 className="font-serif text-lg font-medium tracking-wide sm:text-xl">
            {UI_COPY.categoriesTitle}
          </h2>
          <p className="mt-1 text-[10px] leading-relaxed text-ink-muted">
            {UI_COPY.categoriesSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {primarySummaries.map((summary) => (
            <CategoryCard
              key={summary.category}
              summary={summary}
              onSelect={() => onSelectCategory(summary.category)}
            />
          ))}
        </div>

        {secondarySummaries.some((summary) => summary.modelCount > 0) && (
          <div className="space-y-3 border-t border-line pt-4">
            <h3 className="text-[10px] tracking-[0.18em] text-ink-muted">
              {UI_COPY.otherCategories}
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {secondarySummaries.map((summary) => (
                <CategoryCard
                  key={summary.category}
                  summary={summary}
                  onSelect={() => onSelectCategory(summary.category)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
