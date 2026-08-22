import type { CaponeDecision } from "../../types";
import type { TrendStage } from "../types";

export interface CaponeDecisionMetricsInput {
  trendStrength: number;
  momentumScore: number | null;
  noveltyScore: number;
  saturationScore: number;
  opportunityScore: number;
  independentAdoptionUnits: number;
  sourceQuality: number;
  leaderValidation?: number;
  stage: TrendStage;
}

export interface CaponeDecisionMetricsResult {
  decision: CaponeDecision;
  rationale: string;
}

function buildRationale(
  decision: CaponeDecision,
  input: CaponeDecisionMetricsInput,
): string {
  const momentumLabel =
    input.momentumScore === null ? "ivme yok (yetersiz tarih)" : `${Math.round(input.momentumScore)}`;

  return (
    `Güç ${Math.round(input.trendStrength)} · ivme ${momentumLabel} · ` +
    `novelty ${Math.round(input.noveltyScore)} · doygunluk ${Math.round(input.saturationScore)} · ` +
    `fırsat ${Math.round(input.opportunityScore)} → ${decision}.`
  );
}

/**
 * V1.1 CAPONE KARARI — trend gücü ≠ fırsat.
 * Saturation yüksekse güçlü trend bile GEÇ KALDIK olabilir.
 */
export function deriveCaponeDecisionFromMetrics(
  input: CaponeDecisionMetricsInput,
): CaponeDecisionMetricsResult {
  const {
    trendStrength,
    momentumScore,
    noveltyScore,
    saturationScore,
    opportunityScore,
    independentAdoptionUnits,
    sourceQuality,
  } = input;

  let decision: CaponeDecision;

  if (
    saturationScore >= 70 ||
    (trendStrength >= 65 && saturationScore >= 55) ||
    input.stage === "SATURATED" ||
    input.stage === "MAINSTREAM"
  ) {
    decision = "GEÇ KALDIK";
  } else if (
    (trendStrength >= 55 || (momentumScore !== null && momentumScore >= 60)) &&
    opportunityScore >= 55 &&
    saturationScore < 60 &&
    independentAdoptionUnits >= 3 &&
    sourceQuality >= 35
  ) {
    decision = "NUMUNEYE GİR";
  } else if (
    (noveltyScore >= 65 && trendStrength < 50) ||
    (input.leaderValidation !== undefined &&
      input.leaderValidation >= 50 &&
      noveltyScore >= 60 &&
      trendStrength < 55) ||
    (opportunityScore >= 35 && opportunityScore < 55)
  ) {
    decision = "TAKİP ET";
  } else if (
    sourceQuality < 30 ||
    (trendStrength < 30 && independentAdoptionUnits < 2)
  ) {
    decision = "BEKLE";
  } else if (opportunityScore >= 55 && saturationScore < 60) {
    decision = "NUMUNEYE GİR";
  } else if (trendStrength >= 45) {
    decision = "TAKİP ET";
  } else {
    decision = "BEKLE";
  }

  return {
    decision,
    rationale: buildRationale(decision, input),
  };
}
