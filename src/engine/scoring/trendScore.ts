import type {
  TrendEngineInput,
  TrendScoreComponents,
  TrendScoreResult,
  TrendScoreWeights,
} from "../types";
import { computeTrendMetrics } from "./v11/computeTrendMetrics";
import { DEFAULT_TREND_SCORE_WEIGHTS } from "./legacyWeights";

/** @deprecated V1 weights — backward compatibility only */
export { DEFAULT_TREND_SCORE_WEIGHTS };

export function computeTrendScoreComponents(
  input: TrendEngineInput,
): TrendScoreComponents {
  const metrics = computeTrendMetrics(input);
  const ts = metrics.breakdown.trendStrength;
  const momentum = metrics.breakdown.momentum;

  return {
    sourceQuality: ts.sourceQuality,
    independentBrandCount: ts.independentBrandCount,
    countrySpread: ts.countrySpread,
    acceleration30d: momentum?.change30d ?? 0,
    acceleration90d: momentum?.change90d ?? 0,
    leaderBrandSignal: ts.leaderValidation,
    marketValidation: ts.retailBuyerValidation,
  };
}

export function aggregateTrendScore(
  components: TrendScoreComponents,
  weights: TrendScoreWeights = DEFAULT_TREND_SCORE_WEIGHTS,
): number {
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
  if (totalWeight === 0) return 0;

  const weighted =
    components.sourceQuality * weights.sourceQuality +
    components.independentBrandCount * weights.independentBrandCount +
    components.countrySpread * weights.countrySpread +
    components.acceleration30d * weights.acceleration30d +
    components.acceleration90d * weights.acceleration90d +
    components.leaderBrandSignal * weights.leaderBrandSignal +
    components.marketValidation * weights.marketValidation;

  return Math.min(100, Math.max(0, weighted / totalWeight));
}

/** @deprecated V1 — trendScore ≈ trendStrength; ivme null ise 0'a düşürülür */
export function computeTrendScore(
  input: TrendEngineInput,
  weights: TrendScoreWeights = DEFAULT_TREND_SCORE_WEIGHTS,
): TrendScoreResult {
  const metrics = computeTrendMetrics(input);

  return {
    components: computeTrendScoreComponents(input),
    trendScore: metrics.trendStrength,
    weights,
  };
}
