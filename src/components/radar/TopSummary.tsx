import { analyzedProducts, modelFamilies, radarMeta, radarTopSummary } from "../../data";

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TopSummary() {
  const summary = radarTopSummary;

  return (
    <section className="border-b border-line bg-white/40">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-muted">
              Gerçek Pazar Radarı
            </p>
            <p className="mt-1 font-serif text-base tracking-wide sm:text-lg">
              {radarMeta.totalBrands} marka · {modelFamilies.length} model ·{" "}
              {analyzedProducts.length} varyant
            </p>
          </div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-ink-faint">
            Son tarama: {formatTimestamp(summary.lastUpdated)}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
          <span className="text-ink-muted">
            {summary.brandsChecked} marka kontrol edildi · {summary.newProducts} yeni ürün
            · {summary.significantMovements} önemli hareket
          </span>
          {!radarMeta.comparisonAvailable && (
            <span className="text-[9px] uppercase tracking-[0.14em] text-ink-faint">
              İlk ölçüm — delta bir sonraki taramada
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
