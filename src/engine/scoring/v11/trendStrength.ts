import type { ScoringContext } from "./context";
import { scoreSourceQuality } from "../sourceQuality";
import { scoreCountrySpread } from "../countrySpread";
import { scoreLeaderBrandSignal } from "../leaderBrandSignal";
import { scoreMarketValidation } from "../marketValidation";
import { scoreSegmentSpread } from "./segmentSpread";
import { scoreDedupedBrandCount } from "./dedupedBrandCount";
import { clamp } from "../../utils/clamp";
import type { TrendStrengthComponents } from "../../types";

const STRENGTH_WEIGHTS = {
  sourceQuality: 0.17,
  independentBrandCount: 0.17,
  countrySpread: 0.17,
  segmentSpread: 0.17,
  leaderValidation: 0.16,
  retailBuyerValidation: 0.16,
};

export function computeTrendStrengthComponents(
  ctx: ScoringContext,
): TrendStrengthComponents {
  const baseInput = {
    observations: ctx.trendObservations,
    sources: ctx.sources,
  };

  return {
    sourceQuality: scoreSourceQuality(baseInput),
    independentBrandCount: scoreDedupedBrandCount(ctx),
    countrySpread: scoreCountrySpread(baseInput),
    segmentSpread: scoreSegmentSpread(ctx),
    leaderValidation: scoreLeaderBrandSignal(baseInput),
    retailBuyerValidation: scoreMarketValidation(baseInput),
  };
}

export function aggregateTrendStrength(
  components: TrendStrengthComponents,
): number {
  const weighted =
    components.sourceQuality * STRENGTH_WEIGHTS.sourceQuality +
    components.independentBrandCount * STRENGTH_WEIGHTS.independentBrandCount +
    components.countrySpread * STRENGTH_WEIGHTS.countrySpread +
    components.segmentSpread * STRENGTH_WEIGHTS.segmentSpread +
    components.leaderValidation * STRENGTH_WEIGHTS.leaderValidation +
    components.retailBuyerValidation * STRENGTH_WEIGHTS.retailBuyerValidation;

  return clamp(weighted);
}

export function computeTrendStrength(ctx: ScoringContext): {
  score: number;
  components: TrendStrengthComponents;
} {
  const components = computeTrendStrengthComponents(ctx);
  return {
    score: aggregateTrendStrength(components),
    components,
  };
}

export { STRENGTH_WEIGHTS };
