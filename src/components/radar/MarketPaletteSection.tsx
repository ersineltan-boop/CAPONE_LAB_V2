import { marketPalette } from "../../data";

function formatEntries(
  entries: Array<{ label: string; productCount: number; brandCount: number }>,
): string {
  return entries.map((entry) => entry.label).join(" · ");
}

export default function MarketPaletteSection() {
  return (
    <section className="border-b border-line bg-cream/20">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-muted">
          Pazar Paleti
        </p>
        <p className="mt-1 text-[11px] text-ink-faint">
          Tek boyutlu dağılım — ana Radar kümesi değildir
        </p>

        <div className="mt-4 grid gap-4 text-xs sm:grid-cols-3 sm:text-[13px]">
          <div>
            <dt className="text-[9px] uppercase tracking-[0.12em] text-ink-faint">
              Renk
            </dt>
            <dd className="mt-1 leading-relaxed text-ink-muted">
              {formatEntries(marketPalette.colors)}
            </dd>
          </div>
          <div>
            <dt className="text-[9px] uppercase tracking-[0.12em] text-ink-faint">
              Malzeme
            </dt>
            <dd className="mt-1 leading-relaxed text-ink-muted">
              {formatEntries(marketPalette.materials)}
            </dd>
          </div>
          <div>
            <dt className="text-[9px] uppercase tracking-[0.12em] text-ink-faint">
              Ana Kategori
            </dt>
            <dd className="mt-1 leading-relaxed text-ink-muted">
              {formatEntries(marketPalette.categories)}
            </dd>
          </div>
        </div>
      </div>
    </section>
  );
}
