import { dailySummary } from "../data";

const items = [
  { value: dailySummary.trendsAccelerated, label: "Trend Hızlandı" },
  { value: dailySummary.newSignals, label: "Yeni Sinyal" },
  { value: dailySummary.colorMovements, label: "Renk Hareketi" },
  { value: dailySummary.approachingMainstream, label: "Ana Akıma Yaklaşıyor" },
];

export default function DailySummary() {
  return (
    <section className="border-b border-line bg-white/40">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="font-serif text-sm font-medium tracking-wide sm:text-base">
            BUGÜN NE DEĞİŞTİ?
          </h2>
          <span className="text-[9px] uppercase tracking-[0.2em] text-ink-faint">
            Demo içerik
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-2 border border-line-light bg-cream/50 px-3 py-2.5 text-xs sm:text-sm">
          {items.map((item, i) => (
            <span key={item.label} className="flex items-center gap-1">
              {i > 0 && (
                <span className="mx-1.5 hidden text-ink-faint sm:inline">|</span>
              )}
              <span className="font-serif text-base font-medium tabular-nums sm:text-lg">
                {item.value}
              </span>
              <span className="text-ink-muted">{item.label}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
