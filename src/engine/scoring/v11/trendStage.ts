import type { TrendStage } from "../../types";
import type { ScoringContext } from "./context";
import { hasMassMarketPenetration } from "./segmentSpread";

export interface StageInput {
  trendStrength: number;
  momentumScore: number | null;
  noveltyScore: number;
  saturationScore: number;
}

export function deriveTrendStage(
  input: StageInput,
  ctx?: ScoringContext,
): TrendStage {
  const { trendStrength, momentumScore, noveltyScore, saturationScore } = input;
  const massMarket = ctx ? hasMassMarketPenetration(ctx) : saturationScore >= 70;

  if (saturationScore >= 78 || (trendStrength >= 70 && saturationScore >= 65)) {
    return "SATURATED";
  }

  if (
    massMarket &&
    trendStrength >= 55 &&
    (momentumScore === null || momentumScore < 55)
  ) {
    return "MAINSTREAM";
  }

  if (
    trendStrength >= 50 &&
    momentumScore !== null &&
    momentumScore >= 65
  ) {
    return "ACCELERATING";
  }

  if (trendStrength >= 42 || (momentumScore !== null && momentumScore >= 48)) {
    return "RISING";
  }

  if (noveltyScore >= 55 && trendStrength < 42) {
    return "EARLY_SIGNAL";
  }

  return "VERY_EARLY";
}
