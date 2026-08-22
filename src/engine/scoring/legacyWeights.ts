import type { TrendScoreWeights } from "../types";

/** @deprecated V1 ağırlıkları */
export const DEFAULT_TREND_SCORE_WEIGHTS: TrendScoreWeights = {
  sourceQuality: 0.15,
  independentBrandCount: 0.15,
  countrySpread: 0.15,
  acceleration30d: 0.15,
  acceleration90d: 0.1,
  leaderBrandSignal: 0.15,
  marketValidation: 0.15,
};
