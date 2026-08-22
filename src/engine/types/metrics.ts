import type { CaponeDecision } from "../../types";
import type { TrendStage } from "./stage";
import type { TrendObservation } from "./observation";
import type { TrendSourceConfig } from "./source";
import type { DedupeScope } from "./stage";

export interface TrendStrengthComponents {
  sourceQuality: number;
  independentBrandCount: number;
  countrySpread: number;
  segmentSpread: number;
  leaderValidation: number;
  retailBuyerValidation: number;
}

export interface MomentumComponents {
  change30d: number | null;
  change90d: number | null;
  newBrandAcquisition: number | null;
  newSegmentTransitions: number | null;
}

export interface TrendEngineInput {
  observations: readonly TrendObservation[];
  sources: ReadonlyMap<string, TrendSourceConfig>;
  now?: Date;
  /** Siluet trendinde modelFamily dedup; renk trendinde color scope */
  dedupeScope?: DedupeScope;
  /** Momentum için minimum gözlem gün aralığı */
  minHistoryDays?: number;
}

export interface TrendEngineResultV11 {
  trendStrength: number;
  momentumScore: number | null;
  noveltyScore: number;
  saturationScore: number;
  opportunityScore: number;
  stage: TrendStage;
  caponeDecision: CaponeDecision;
  confidence: number;
  breakdown: {
    trendStrength: TrendStrengthComponents;
    momentum: MomentumComponents | null;
    independentAdoptionUnits: number;
    dedupedObservationCount: number;
  };
}

/** @deprecated V1 — backward compatibility */
export interface TrendScoreComponents {
  sourceQuality: number;
  independentBrandCount: number;
  countrySpread: number;
  acceleration30d: number;
  acceleration90d: number;
  leaderBrandSignal: number;
  marketValidation: number;
}

/** @deprecated V1 — backward compatibility */
export interface TrendScoreWeights {
  sourceQuality: number;
  independentBrandCount: number;
  countrySpread: number;
  acceleration30d: number;
  acceleration90d: number;
  leaderBrandSignal: number;
  marketValidation: number;
}

/** @deprecated V1 — backward compatibility */
export interface TrendScoreResult {
  components: TrendScoreComponents;
  trendScore: number;
  weights: TrendScoreWeights;
}

/** @deprecated V1 alias */
export type TrendScoreInput = TrendEngineInput;
