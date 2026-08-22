import type { ScoringContext } from "./context";
import {
  hasMassMarketPenetration,
  highestSegmentReached,
  countSegmentTransitions,
} from "./segmentSpread";
import { countAdoptionUnitsInContext } from "./momentumScore";
import { countDedupedIndependentBrands } from "./dedupedBrandCount";
import { aggregateMomentumScore, computeMomentumComponents } from "./momentumScore";
import { SEGMENT_LIFECYCLE } from "../../types";
import { clamp } from "../../utils/clamp";

function scoreMassMarketSaturation(ctx: ScoringContext): number {
  if (!hasMassMarketPenetration(ctx)) return 10;
  return 90;
}

function scoreBrandPenetration(ctx: ScoringContext): number {
  const brands = countDedupedIndependentBrands(ctx);
  return clamp((brands / 12) * 100);
}

function scoreModelProliferation(ctx: ScoringContext): number {
  const units = countAdoptionUnitsInContext(ctx);
  return clamp((units / 15) * 100);
}

function scoreLifecycleCompletion(ctx: ScoringContext): number {
  const highest = highestSegmentReached(ctx);
  if (highest < 0) return 0;
  return clamp(((highest + 1) / SEGMENT_LIFECYCLE.length) * 100);
}

function scoreMomentumPlateau(ctx: ScoringContext): number {
  const components = computeMomentumComponents(ctx);
  const momentum = aggregateMomentumScore(components);

  if (momentum === null) return 20;

  if (momentum <= 25) return 80;
  if (momentum <= 45) return 55;
  if (momentum <= 60) return 30;
  return 10;
}

export function computeSaturationScore(ctx: ScoringContext): number {
  const mass = scoreMassMarketSaturation(ctx);
  const brands = scoreBrandPenetration(ctx);
  const models = scoreModelProliferation(ctx);
  const lifecycle = scoreLifecycleCompletion(ctx);
  const plateau = scoreMomentumPlateau(ctx);

  const segmentTransitionBoost = clamp(countSegmentTransitions(ctx) * 12);

  return clamp(
    mass * 0.28 +
      brands * 0.22 +
      models * 0.18 +
      lifecycle * 0.17 +
      plateau * 0.1 +
      segmentTransitionBoost * 0.05,
  );
}

export {
  scoreMassMarketSaturation,
  scoreBrandPenetration,
  scoreModelProliferation,
  scoreLifecycleCompletion,
};
