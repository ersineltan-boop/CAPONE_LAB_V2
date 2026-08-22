import { useMemo, useState } from "react";

import { modelFamilies } from "../../data/modelFamilies";
import { modelFamiliesToGridItems } from "../../categories/modelFamilyGrid";
import { queryDiscoveredNewArrivals } from "../../newArrivals/discoveredQuery";
import { queryVerifiedNewArrivals } from "../../newArrivals/verifiedQuery";
import type { NewArrivalsPeriod } from "../../newArrivals/query";
import { getPeriodLabel, UI_COPY } from "../../presentation/turkishLabels";
import { useProgressiveBatch } from "../../ui/useProgressiveBatch";
import ModelFamilyDetailDrawer from "../modelFamily/ModelFamilyDetailDrawer";
import ModelFamilyProductGrid from "../modelFamily/ModelFamilyProductGrid";

const PERIODS: NewArrivalsPeriod[] = ["24H", "7D", "30D", "90D"];

type NewArrivalsTab = "verified" | "discovered";

export default function NewArrivals() {
  const [period, setPeriod] = useState<NewArrivalsPeriod>("30D");
  const [tab, setTab] = useState<NewArrivalsTab>("verified");
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);

  const familyById = useMemo(
    () => new Map(modelFamilies.map((family) => [family.modelFamilyId, family])),
    [],
  );

  const verifiedIds = useMemo(
    () =>
      new Set(
        queryVerifiedNewArrivals(modelFamilies, {
          scope: { type: "ALL" },
          period,
        }).map((item) => item.modelFamilyId),
      ),
    [period],
  );

  const items = useMemo(() => {
    if (tab === "verified") {
      const arrivals = queryVerifiedNewArrivals(modelFamilies, {
        scope: { type: "ALL" },
        period,
      });
      return arrivals
        .map((item) => familyById.get(item.modelFamilyId))
        .filter((family): family is NonNullable<typeof family> => Boolean(family));
    }
    const discovered = queryDiscoveredNewArrivals(modelFamilies, {
      scope: { type: "ALL" },
      period,
    });
    return discovered
      .map((item) => familyById.get(item.modelFamilyId))
      .filter((family): family is NonNullable<typeof family> => Boolean(family));
  }, [tab, period, familyById]);

  const gridItems = useMemo(() => modelFamiliesToGridItems(items), [items]);
  const { visibleItems, hasMore, loadMore } = useProgressiveBatch(gridItems);

  const selectedFamily = selectedFamilyId
    ? familyById.get(selectedFamilyId) ?? null
    : null;

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="space-y-4 border border-line bg-white/20 p-4 sm:p-5">
          <div>
            <h2 className="font-serif text-lg font-medium tracking-wide sm:text-xl">
              {UI_COPY.newArrivalsTitle}
            </h2>
            <p className="mt-1 text-[10px] leading-relaxed text-ink-muted">
              {tab === "verified"
                ? UI_COPY.newArrivalsSubtitle
                : UI_COPY.newArrivalsDiscoveredSubtitle}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTab("verified")}
              className={`border px-2.5 py-1.5 text-[10px] tracking-widest transition-colors ${
                tab === "verified"
                  ? "border-ink bg-ink text-cream"
                  : "border-line text-ink-muted hover:border-ink"
              }`}
            >
              {UI_COPY.newArrivalsVerifiedTab}
            </button>
            <button
              type="button"
              onClick={() => setTab("discovered")}
              className={`border px-2.5 py-1.5 text-[10px] tracking-widest transition-colors ${
                tab === "discovered"
                  ? "border-ink bg-ink text-cream"
                  : "border-line text-ink-muted hover:border-ink"
              }`}
            >
              {UI_COPY.newArrivalsDiscoveredTab}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {PERIODS.map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setPeriod(entry)}
                className={`border px-2.5 py-1.5 text-[10px] tracking-widest transition-colors ${
                  period === entry
                    ? "border-ink bg-ink text-cream"
                    : "border-line text-ink-muted hover:border-ink"
                }`}
              >
                <span className="hidden sm:inline">{getPeriodLabel(entry)}</span>
                <span className="sm:hidden">{getPeriodLabel(entry, { compact: true })}</span>
              </button>
            ))}
          </div>

          <p className="text-[10px] text-ink-muted">
            {UI_COPY.modelsCount(gridItems.length)} · {UI_COPY.sortNewest}
          </p>

          <ModelFamilyProductGrid
            items={visibleItems}
            emptyMessage={
              tab === "verified" ? UI_COPY.emptyNewArrivals : UI_COPY.emptyDiscovered
            }
            verifiedNewIds={tab === "verified" ? verifiedIds : undefined}
            onSelectItem={setSelectedFamilyId}
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
        </div>
      </section>

      <ModelFamilyDetailDrawer
        family={selectedFamily}
        open={Boolean(selectedFamily)}
        onClose={() => setSelectedFamilyId(null)}
      />
    </>
  );
}
