import { brandDiscoveryItems } from "../../data";
import ImagePlaceholder from "./ImagePlaceholder";

export default function BrandDiscoverySection() {
  return (
    <section id="marka-kesfi" className="border-t border-line bg-white/30">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-lg font-medium tracking-wide sm:text-xl">
            BU HAFTA RADARIMIZA GİREN MARKALAR
          </h2>
        </div>

        {brandDiscoveryItems.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">
            İlk ölçüm tamamlandı. Yeni marka hareketi bir sonraki taramada görünecek.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {brandDiscoveryItems.map((item) => (
              <article
                key={item.id}
                className="border border-line-light bg-cream/30 p-4"
              >
                <p className="text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                  {item.country}
                </p>
                <h3 className="mt-1 font-serif text-base font-medium">
                  {item.brand}
                </h3>
                <p className="text-[10px] text-ink-muted">{item.segment}</p>
                <p className="mt-2 text-xs leading-snug text-ink-muted">
                  {item.whyNotable}
                </p>
                <div className="mt-3 flex gap-1">
                  {item.images.map((img, i) => (
                    <div key={i} className="h-14 w-14 shrink-0 border border-line-light">
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
        )}
      </div>
    </section>
  );
}
