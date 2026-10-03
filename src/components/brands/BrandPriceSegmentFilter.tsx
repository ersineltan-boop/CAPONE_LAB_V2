import { BRAND_PRICE_SEGMENTS, type BrandPriceSegmentFilter as SegmentFilter } from "../../brands/brandPriceSegments";

export default function BrandPriceSegmentFilter({ value, onChange }: {
  value: SegmentFilter;
  onChange: (value: SegmentFilter) => void;
}) {
  return (
    <div role="group" aria-label="Marka sınıfı" className="space-y-2">
      <p className="text-[10px] uppercase tracking-widest text-ink-muted">Marka sınıfı</p>
      <div className="flex flex-wrap gap-2">
        {[{ id: "all" as const, label: "Tüm sınıflar" }, ...BRAND_PRICE_SEGMENTS].map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={value === option.id}
            onClick={() => onChange(option.id)}
            className={`border px-3 py-1.5 text-[10px] tracking-widest transition-colors ${
              value === option.id ? "border-ink bg-ink text-cream" : "border-line text-ink-muted hover:border-ink"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
