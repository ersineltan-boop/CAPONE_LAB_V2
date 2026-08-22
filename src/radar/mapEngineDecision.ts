import type { CaponeDecision } from "../types";
import type { CommercialDecision } from "../types/commercialRadar";

export function mapEngineToCommercialDecision(
  decision: CaponeDecision,
): CommercialDecision {
  switch (decision) {
    case "NUMUNEYE GİR":
      return "NUMUNEYE GİR";
    case "TAKİP ET":
      return "İZLE";
    case "BEKLE":
      return "HAZIRLAN";
    case "GEÇ KALDIK":
      return "DOYGUN";
    default:
      return "HAZIRLAN";
  }
}

export function mapEngineStageLabel(stage: string): string {
  switch (stage) {
    case "VERY_EARLY":
      return "Çok erken sinyal";
    case "EARLY_SIGNAL":
      return "Erken sinyal";
    case "RISING":
      return "Yükselen sinyal";
    case "ACCELERATING":
      return "Hızlanan sinyal";
    case "MAINSTREAM":
      return "Ana akım";
    case "SATURATED":
      return "Doygun sinyal";
    default:
      return stage;
  }
}
