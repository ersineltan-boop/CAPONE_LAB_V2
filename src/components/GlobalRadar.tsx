import { globalMarkets } from "../data";

export default function GlobalRadar() {
  return (
    <section id="global-radar" className="border-t border-line bg-white/30">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-lg font-medium tracking-wide sm:text-xl">
            GLOBAL RADAR
          </h2>
          <span className="text-[9px] uppercase tracking-[0.2em] text-ink-faint">
            Demo içerik
          </span>
        </div>

        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-ink-muted sm:text-sm">
          İzlenecek global trend pazarları. Çin ana trend pazarı olarak
          gösterilmez — ileride &ldquo;Üretim / Kopyalanma Sinyali&rdquo;
          doğrulama katmanı eklenecek.
        </p>

        <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {globalMarkets.map((market) => (
            <li
              key={market.name}
              className={`border px-3 py-2 text-center text-xs tracking-wide ${
                market.active
                  ? "border-ink bg-ink text-cream"
                  : "border-line-light bg-cream/50 text-ink-faint"
              }`}
            >
              {market.name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
