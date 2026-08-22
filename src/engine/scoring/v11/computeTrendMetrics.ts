import type { TrendEngineInput, TrendEngineResultV11 } from "../../types";
import { createScoringContext } from "./context";
import { computeTrendStrength } from "./trendStrength";
import { computeMomentumScore, countAdoptionUnitsInContext } from "./momentumScore";
import { computeNoveltyScore } from "./noveltyScore";
import { computeSaturationScore } from "./saturationScore";
import { computeOpportunityScore } from "./opportunityScore";
import { deriveTrendStage } from "./trendStage";
import { deriveCaponeDecisionFromMetrics } from "../../decision/caponeDecisionFromMetrics";
import { countAdoptionUnits } from "../../independence/evidenceIndependence";
import { DEFAULT_EVIDENCE_INDEPENDENCE } from "../../types/observation";
import { clamp } from "../../utils/clamp";

function computeConfidence(
  trendStrength: number,
  independentUnits: number,
  dedupedCount: number,
): number {
  const evidenceDepth = clamp((dedupedCount / 8) * 100);
  const adoptionBreadth = clamp((independentUnits / 6) * 100);
  return clamp(trendStrength * 0.5 + evidenceDepth * 0.25 + adoptionBreadth * 0.25);
}

/** V1.1 ana çıktı */
export function computeTrendMetrics(
  input: TrendEngineInput,
): TrendEngineResultV11 {
  const ctx = createScoringContext(input);
  const { score: trendStrength, components: trendStrengthComponents } =
    computeTrendStrength(ctx);
  const { score: momentumScore, components: momentumComponents } =
    computeMomentumScore(ctx);
  const noveltyScore = computeNoveltyScore(ctx);
  const saturationScore = computeSaturationScore(ctx);
  const opportunityScore = computeOpportunityScore({
    trendStrength,
    momentumScore,
    noveltyScore,
    saturationScore,
  });
  const stage = deriveTrendStage(
    { trendStrength, momentumScore, noveltyScore, saturationScore },
    ctx,
  );

  const config = {
    ...DEFAULT_EVIDENCE_INDEPENDENCE,
    dedupeScope: ctx.dedupeScope,
  };
  const independentAdoptionUnits = countAdoptionUnits(
    ctx.trendObservations,
    config,
  );
  const dedupedObservationCount = ctx.trendObservations.length;

  const { decision: caponeDecision } = deriveCaponeDecisionFromMetrics({
    trendStrength,
    momentumScore,
    noveltyScore,
    saturationScore,
    opportunityScore,
    independentAdoptionUnits,
      sourceQuality: trendStrengthComponents.sourceQuality,
      leaderValidation: trendStrengthComponents.leaderValidation,
      stage,
  });

  const confidence = computeConfidence(
    trendStrength,
    independentAdoptionUnits,
    dedupedObservationCount,
  );

  return {
    trendStrength,
    momentumScore,
    noveltyScore,
    saturationScore,
    opportunityScore,
    stage,
    caponeDecision,
    confidence,
    breakdown: {
      trendStrength: trendStrengthComponents,
      momentum: momentumComponents,
      independentAdoptionUnits,
      dedupedObservationCount,
    },
  };
}

export { countAdoptionUnitsInContext };
