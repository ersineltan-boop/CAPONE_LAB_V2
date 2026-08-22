import type { CaponeDecision, EvidenceStrength, TrendStatus } from "../../types";
import type { TrendScoreResult, TrendEngineResultV11 } from "../types";
import { deriveCaponeDecisionFromMetrics } from "./caponeDecisionFromMetrics";
import type { TrendObservation } from "../types";
import type { TrendSourceConfig } from "../types";

export interface EngineCaponeDecisionInput {
  /** @deprecated V1 */
  score?: TrendScoreResult;
  /** V1.1 tercih edilen giriş */
  metrics?: TrendEngineResultV11;
  observations?: readonly TrendObservation[];
  sources?: ReadonlyMap<string, TrendSourceConfig>;
}

export interface EngineCaponeDecisionResult {
  decision: CaponeDecision;
  rationale: string;
  derivedInputs: {
    trendStatus: TrendStatus;
    opportunityWindow: import("../../types").OpportunityWindow;
    evidenceStrength: EvidenceStrength;
  };
}

function mapStageToTrendStatus(
  metrics: TrendEngineResultV11,
): TrendStatus {
  switch (metrics.stage) {
    case "ACCELERATING":
      return "HIZLANIYOR";
    case "RISING":
      return "YÜKSELİYOR";
    case "EARLY_SIGNAL":
    case "VERY_EARLY":
      return "ERKEN SİNYAL";
    case "MAINSTREAM":
      return "ANA AKIM";
    case "SATURATED":
      return "DOYGUN";
    default:
      return "YÜKSELİYOR";
  }
}

function mapOpportunityWindow(
  metrics: TrendEngineResultV11,
): import("../../types").OpportunityWindow {
  if (metrics.saturationScore >= 70) return "Doygun";
  if (metrics.opportunityScore >= 65) return "En İyi Giriş Zamanı";
  if (metrics.opportunityScore >= 50) return "Üretime Aday";
  if (metrics.noveltyScore >= 65 && metrics.trendStrength < 45) return "Çok Erken";
  if (metrics.momentumScore !== null && metrics.momentumScore >= 60) return "Hızlanıyor";
  if (metrics.stage === "MAINSTREAM") return "Ana Akım";
  return "Doygun";
}

function mapEvidenceStrength(metrics: TrendEngineResultV11): EvidenceStrength {
  const units = metrics.breakdown.independentAdoptionUnits;
  const quality = metrics.breakdown.trendStrength.sourceQuality;
  const composite = units * 12 + quality * 0.4;
  if (composite >= 55) return "yüksek";
  if (composite >= 30) return "orta";
  return "düşük";
}

/**
 * CAPONE KARARI — V1.1 metrics tercih edilir; yoksa legacy score fallback.
 */
export function deriveCaponeDecisionFromEngine(
  input: EngineCaponeDecisionInput,
): EngineCaponeDecisionResult {
  if (input.metrics) {
    const { decision, rationale } = deriveCaponeDecisionFromMetrics({
      trendStrength: input.metrics.trendStrength,
      momentumScore: input.metrics.momentumScore,
      noveltyScore: input.metrics.noveltyScore,
      saturationScore: input.metrics.saturationScore,
      opportunityScore: input.metrics.opportunityScore,
      independentAdoptionUnits: input.metrics.breakdown.independentAdoptionUnits,
      sourceQuality: input.metrics.breakdown.trendStrength.sourceQuality,
      leaderValidation: input.metrics.breakdown.trendStrength.leaderValidation,
      stage: input.metrics.stage,
    });

    return {
      decision,
      rationale,
      derivedInputs: {
        trendStatus: mapStageToTrendStatus(input.metrics),
        opportunityWindow: mapOpportunityWindow(input.metrics),
        evidenceStrength: mapEvidenceStrength(input.metrics),
      },
    };
  }

  if (input.score) {
    const { score } = input;
    const components = score.components;
    const pseudoMetrics: TrendEngineResultV11 = {
      trendStrength: score.trendScore,
      momentumScore:
        components.acceleration30d > 0 || components.acceleration90d > 0
          ? (components.acceleration30d + components.acceleration90d) / 2
          : null,
      noveltyScore: 50,
      saturationScore: score.trendScore >= 70 ? 55 : 25,
      opportunityScore: score.trendScore * 0.7,
      stage: score.trendScore >= 70 ? "RISING" : "EARLY_SIGNAL",
      caponeDecision: "TAKİP ET",
      confidence: 50,
      breakdown: {
        trendStrength: {
          sourceQuality: components.sourceQuality,
          independentBrandCount: components.independentBrandCount,
          countrySpread: components.countrySpread,
          segmentSpread: 0,
          leaderValidation: components.leaderBrandSignal,
          retailBuyerValidation: components.marketValidation,
        },
        momentum: null,
        independentAdoptionUnits: 0,
        dedupedObservationCount: 0,
      },
    };

    return deriveCaponeDecisionFromEngine({ metrics: pseudoMetrics });
  }

  throw new Error("deriveCaponeDecisionFromEngine: metrics veya score gerekli");
}
