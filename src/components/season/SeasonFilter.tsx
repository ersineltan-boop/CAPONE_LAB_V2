import { SEASON_OPTIONS, type ProductSeason } from "../../season/productSeason";

interface SeasonFilterProps {
  value: ProductSeason | "ALL";
  onChange: (value: ProductSeason | "ALL") => void;
  counts?: Partial<Record<ProductSeason, number>>;
}

export default function SeasonFilter({ value, onChange, counts }: SeasonFilterProps) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Sezon filtresi">
      {SEASON_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`border px-2.5 py-1.5 text-[10px] tracking-wide transition-colors ${
            value === option.value
              ? "border-ink bg-ink text-cream"
              : "border-line text-ink-muted hover:border-ink"
          }`}
        >
          {option.label}
          {option.value !== "ALL" && counts?.[option.value] !== undefined
            ? ` (${counts[option.value]})`
            : ""}
        </button>
      ))}
    </div>
  );
}

