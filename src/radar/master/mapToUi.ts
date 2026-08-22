import { labelTagTr } from "../../analysis/buildMarketAnalysis";
import { brandCountry } from "../brandMeta";
import type {
  CommercialDecision,
  ProductReference,
  TrendCommercialRadarItem,
} from "../../types/commercialRadar";
import type {
  MasterRadarBuildResult,
  MasterRadarType,
  MasterRadarView,
  RadarDirectionSignal,
  RadarStage,
} from "./types";

export const EARLY_STAGE_LABELS: Record<string, string> = {
  COK_ERKEN: "ÇOK ERKEN",
  ERKEN_SINYAL: "ERKEN SİNYAL",
};

export const COMMERCIAL_STAGE_LABELS: Record<string, string> = {
  HAZIRLAN: "HAZIRLAN",
  NUMUNEYE_GIR: "NUMUNEYE GİR",
  DOYGUN_GEC: "DOYGUN / GEÇ",
};

export function stageLabel(stage: RadarStage): string {
  return EARLY_STAGE_LABELS[stage] ?? COMMERCIAL_STAGE_LABELS[stage] ?? stage;
}

export function confidenceLabel(confidence: string): string {
  switch (confidence) {
    case "HIGH":
      return "Yüksek güven";
    case "MEDIUM":
      return "Orta güven";
    case "LOW":
      return "Düşük güven";
    default:
      return "Yetersiz kanıt";
  }
}

function mapDecision(
  signal: RadarDirectionSignal,
  comparisonAvailable: boolean,
): CommercialDecision {
  if (!comparisonAvailable) return "VERİ BİRİKİYOR";
  if (signal.radarType === "COMMERCIAL") {
    if (signal.stage === "NUMUNEYE_GIR") return "NUMUNEYE GİR";
    if (signal.stage === "HAZIRLAN") return "HAZIRLAN";
    if (signal.stage === "DOYGUN_GEC") return "DOYGUN";
  }
  return "İZLE";
}

function evidenceToReference(
  item: RadarDirectionSignal["heroEvidence"][number],
): ProductReference {
  return {
    brand: item.brand,
    model: item.canonicalName,
    country: brandCountry(item.brand),
    segment: "PREMIUM",
    commercialStage: "DIRECTIONAL",
    imageUrl: item.imageUrl,
    externalUrl: item.productUrl,
    roleLabel: item.variantCount > 1 ? `${item.variantCount} varyant` : item.brand,
  };
}

export function signalToRadarItem(
  signal: RadarDirectionSignal,
  comparisonAvailable: boolean,
  collectedAt: string,
): TrendCommercialRadarItem {
  const hero = signal.heroEvidence.slice(0, 4);
  while (hero.length < 4) {
    hero.push(hero[hero.length - 1] ?? signal.heroEvidence[0]!);
  }

  return {
    id: signal.id,
    title: signal.directionName,
    category: labelTagTr(signal.category),
    decision: mapDecision(signal, comparisonAvailable),
    stage: comparisonAvailable ? stageLabel(signal.stage) : "İLK ÖLÇÜM",
    summary: signal.description,
    whyNow: comparisonAvailable
      ? `${signal.independentBrandCount} bağımsız marka · ${signal.modelFamilyCount} model ailesi · ${confidenceLabel(signal.confidence)}`
      : "İlk ölçüm tamamlandı. Zaman içi hareket bir sonraki taramada hesaplanacak.",
    marketFit: signal.brands.slice(0, 4).map((brand) => ({
      market: brandCountry(brand),
      level: "Orta" as const,
    })),
    production: `${signal.modelFamilyCount} model ailesi kanıtı`,
    seasonFit: "Gerçek multibrand ölçüm",
    caponeRecommendation: mapDecision(signal, comparisonAvailable),
    heroReferences: hero.map((item) => evidenceToReference(item)) as TrendCommercialRadarItem["heroReferences"],
    references: signal.allEvidence.map((item) => evidenceToReference(item)),
    reverseSeasonReferences: [],
    reverseSeasonLabel: "",
    productTranslation: {
      form: labelTagTr(signal.category),
      toe: signal.requiredAttributes
        .filter((attribute) => attribute.dimension === "TOE_SHAPE")
        .map((attribute) => labelTagTr(attribute.value))
        .join(" · ") || "—",
      upper: signal.requiredAttributes
        .filter((attribute) => attribute.dimension === "CONSTRUCTION")
        .map((attribute) => labelTagTr(attribute.value))
        .join(" · ") || "—",
      heelSole: signal.requiredAttributes
        .filter((attribute) => attribute.dimension === "HEEL_TYPE")
        .map((attribute) => labelTagTr(attribute.value))
        .join(" · ") || "—",
      material: "Radar sinyali — materyal eksen değil",
      colors: ["—"],
      turkeyProduction: "—",
      chinaNeed: "—",
      commercialRisk: "—",
      recommendedSamples: signal.heroEvidence
        .slice(0, 3)
        .map((item) => item.canonicalName),
    },
    engineMetrics: comparisonAvailable
      ? undefined
      : {
          trendStrength: 0,
          momentumScore: null,
          noveltyScore: 0,
          saturationScore: 0,
          opportunityScore: 0,
        },
    radarReason: [
      `${signal.independentBrandCount} bağımsız marka`,
      `${signal.modelFamilyCount} model ailesi`,
      `Güven: ${confidenceLabel(signal.confidence)}`,
      `Aşama: ${stageLabel(signal.stage)}`,
    ].join(" · "),
    updatedAt: collectedAt,
    radarType: signal.radarType,
    confidence: signal.confidence,
    momentumScore: signal.momentumScore,
    isChanging: signal.isChanging,
  };
}

export function filterSignalsForView(
  signals: RadarDirectionSignal[],
  view: MasterRadarView,
): RadarDirectionSignal[] {
  if (view === "ALL") return signals;
  return signals.filter((signal) => signal.isChanging);
}

export function getCategorySignals(
  result: MasterRadarBuildResult,
  category: import("../../types/pilotProduct").FootwearCategory,
  radarType: MasterRadarType,
  view: MasterRadarView,
): RadarDirectionSignal[] {
  const slice = result.categories.find((entry) => entry.category === category);
  if (!slice) return [];
  const signals =
    radarType === "EARLY" ? slice.earlySignals : slice.commercialSignals;
  return filterSignalsForView(signals, view);
}

export function mapMasterRadarItems(
  result: MasterRadarBuildResult,
): TrendCommercialRadarItem[] {
  return result.allSignals.map((signal) =>
    signalToRadarItem(signal, result.comparisonAvailable, result.collectedAt),
  );
}
