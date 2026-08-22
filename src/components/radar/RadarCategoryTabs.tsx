import { labelTagTr } from "../../analysis/buildMarketAnalysis";
import type { FootwearCategory } from "../../types/pilotProduct";
import type { MasterRadarType } from "../../radar/master/types";
import type { RadarNavCategorySlice } from "../../radar/radarMainCategories";

interface RadarCategoryTabsProps {
  navCategories: RadarNavCategorySlice[];
  activeCategory: FootwearCategory;
  onChange: (category: FootwearCategory) => void;
}

export default function RadarCategoryTabs({
  navCategories,
  activeCategory,
  onChange,
}: RadarCategoryTabsProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {navCategories.map((slice) => (
        <button
          key={slice.category}
          type="button"
          onClick={() => onChange(slice.category)}
          className={`border px-2 py-1 text-[8px] tracking-[0.08em] transition-colors sm:text-[9px] ${
            activeCategory === slice.category
              ? "border-ink bg-ink text-cream"
              : "border-line text-ink-muted hover:border-ink"
          }`}
        >
          {labelTagTr(slice.category)}
          <span className="ml-1 tabular-nums opacity-70">
            {slice.earlyCount}/{slice.commercialCount}
          </span>
        </button>
      ))}
    </div>
  );
}

interface RadarTypeTabsProps {
  active: MasterRadarType;
  onChange: (type: MasterRadarType) => void;
}

export function RadarTypeTabs({ active, onChange }: RadarTypeTabsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(["EARLY", "COMMERCIAL"] as const).map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onChange(type)}
          className={`border px-3 py-1.5 text-[9px] tracking-[0.12em] transition-colors sm:text-[10px] ${
            active === type
              ? "border-ink bg-ink text-cream"
              : "border-line text-ink-muted hover:border-ink"
          }`}
        >
          {type === "EARLY" ? "ERKEN RADAR" : "TİCARİ RADAR"}
        </button>
      ))}
    </div>
  );
}

interface RadarViewTabsProps {
  active: "CHANGING" | "ALL";
  onChange: (view: "CHANGING" | "ALL") => void;
}

export function RadarViewTabs({ active, onChange }: RadarViewTabsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange("CHANGING")}
        className={`border px-2.5 py-1 text-[9px] tracking-[0.1em] ${
          active === "CHANGING"
            ? "border-ink bg-ink text-cream"
            : "border-line text-ink-muted hover:border-ink"
        }`}
      >
        YENİ / DEĞİŞEN
      </button>
      <button
        type="button"
        onClick={() => onChange("ALL")}
        className={`border px-2.5 py-1 text-[9px] tracking-[0.1em] ${
          active === "ALL"
            ? "border-ink bg-ink text-cream"
            : "border-line text-ink-muted hover:border-ink"
        }`}
      >
        TÜM GÜNCEL YÖNLER
      </button>
    </div>
  );
}
