import { useMemo, useState } from "react";
import { brandExplorerCountries, brandExplorerItems } from "../../data";
import { formatBrandExplorerSubtitle } from "../../radar/buildCommercialRadar";
import ImagePlaceholder from "../radar/ImagePlaceholder";

export default function BrandExplorer() {
  const [country, setCountry] = useState<string>("Tümü");

  const filtered = useMemo(() => {
    if (country === "Tümü") return brandExplorerItems;
    return brandExplorerItems.filter((brand) => {
      const brandCountry = brand.country.trim().toLowerCase();
      const filter = country.trim().toLowerCase();
      return brandCountry === filter || brandCountry.includes(filter);
    });
  }, [country]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-xl font-medium tracking-wide sm:text-2xl">
          MARKALAR
        </h2>
        <span className="text-[9px] uppercase tracking-[0.2em] text-ink-faint">
          Registry · {brandExplorerItems.length} marka
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-[10px] uppercase tracking-[0.15em] text-ink-muted">
          Ülke
        </label>
        <select
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          className="min-w-[12rem] border border-line bg-cream px-2.5 py-1.5 text-[11px] tracking-wide text-ink"
          aria-label="Ülke filtresi"
        >
          {brandExplorerCountries.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((brand) => (
          <article
            key={brand.id}
            className="border border-line bg-white/30 p-4"
          >
            <div className="flex justify-between gap-2">
              <div>
                <h3 className="font-serif text-lg font-medium">{brand.brand}</h3>
                <p className="text-[10px] text-ink-muted">
                  {formatBrandExplorerSubtitle(brand)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-[0.1em] text-ink-faint">
                  Footwear
                </p>
                <p className="font-serif text-lg tabular-nums">
                  {brand.footwearInfluence}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              {brand.recentSignalCount} son sinyal
            </p>
            <div className="mt-3 flex gap-1">
              {brand.images.map((img, i) => (
                <div
                  key={i}
                  className="h-16 w-16 shrink-0 border border-line-light"
                >
                  {img.url ? (
                    <img
                      src={img.url}
                      alt={img.alt}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImagePlaceholder alt={img.alt} className="h-full w-full" />
                  )}
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-8 text-sm text-ink-muted">Bu filtrede marka yok.</p>
      )}
    </div>
  );
}
