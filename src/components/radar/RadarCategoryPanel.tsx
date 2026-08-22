import type { FootwearCategory } from "../../types/pilotProduct";
import type {
  MasterRadarBuildResult,
  MasterRadarType,
  MasterRadarView,
} from "../../radar/master/types";
import { getNavCategorySignals } from "../../radar/radarMainCategories";
import { signalToRadarItem } from "../../radar/master/mapToUi";
import CommercialRadarCard from "./CommercialRadarCard";
import type { TrendCommercialRadarItem } from "../../types/commercialRadar";

interface RadarCategoryPanelProps {
  result: MasterRadarBuildResult;
  category: FootwearCategory;
  radarType: MasterRadarType;
  view: MasterRadarView;
  onDetail: (item: TrendCommercialRadarItem) => void;
}

const RADAR_TYPE_LABELS: Record<MasterRadarType, string> = {
  EARLY: "Erken Radar",
  COMMERCIAL: "Ticari Radar",
};

export default function RadarCategoryPanel({
  result,
  category,
  radarType,
  view,
  onDetail,
}: RadarCategoryPanelProps) {
  const signals = getNavCategorySignals(result, category, radarType, view);
  const items = signals.map((signal) =>
    signalToRadarItem(
      signal,
      result.comparisonAvailable,
      result.collectedAt,
    ),
  );

  if (items.length === 0) {
    return (
      <div className="border border-line bg-white/20 px-4 py-8 text-center">
        <p className="font-serif text-base text-ink">
          Henüz yeterli {radarType === "EARLY" ? "erken" : "ticari"} sinyal yok.
        </p>
        <p className="mt-2 text-xs text-ink-muted">
          Veri birikiyor. Yeterli bağımsız marka ve stage kanıtı oluştuğunda
          {` ${RADAR_TYPE_LABELS[radarType].toLowerCase()}`} yönleri burada görünecek.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {items.map((item) => (
        <CommercialRadarCard
          key={item.id}
          item={item}
          onDetail={() => onDetail(item)}
        />
      ))}
    </div>
  );
}
