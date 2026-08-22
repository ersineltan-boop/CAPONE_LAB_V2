import { clamp } from "../../utils/clamp";

export interface OpportunityInput {
  trendStrength: number;
  momentumScore: number | null;
  noveltyScore: number;
  saturationScore: number;
}

/**
 * Fırsat skoru — trend gücü + ivme + novelty, saturation ile baskılanır.
 * momentumScore null ise ivme bileşeni nötr dışlanır (0 ivme sayılmaz).
 */
export function computeOpportunityScore(input: OpportunityInput): number {
  const { trendStrength, momentumScore, noveltyScore, saturationScore } = input;

  let base: number;
  if (momentumScore === null) {
    base = trendStrength * 0.55 + noveltyScore * 0.45;
  } else {
    base =
      trendStrength * 0.4 +
      momentumScore * 0.25 +
      noveltyScore * 0.35;
  }

  const saturationPenalty = 0.35 + (saturationScore / 100) * 0.65;
  return clamp(base * (1 - saturationPenalty * 0.75));
}
