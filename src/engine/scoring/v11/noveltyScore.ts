import type { ScoringContext } from "./context";
import { hasMassMarketPenetration, highestSegmentReached } from "./segmentSpread";
import { countAdoptionUnitsInContext } from "./momentumScore";
import { dimensionsSignature } from "../../independence/evidenceIndependence";
import { parseIsoDate, daysBetween } from "../../utils/dates";
import { clamp } from "../../utils/clamp";

function scoreLeaderEarlySignal(ctx: ScoringContext): number {
  let weighted = 0;
  let leaders = 0;

  for (const obs of ctx.trendObservations) {
    const source = ctx.sources.get(obs.sourceId);
    if (!source) continue;
    if (source.role === "LEADER" || source.role === "EARLY_ADOPTER") {
      weighted += obs.confidence * source.weight;
      leaders += 1;
    }
  }

  if (leaders === 0) return 10;

  const density = weighted / Math.max(1, leaders);
  const scarcityBonus = leaders <= 3 ? 25 : leaders <= 5 ? 10 : 0;

  return clamp(density * 70 + scarcityBonus);
}

function scoreLowMassPenetration(ctx: ScoringContext): number {
  if (hasMassMarketPenetration(ctx)) return 15;
  const highest = highestSegmentReached(ctx);
  if (highest <= 1) return 95;
  if (highest === 2) return 75;
  if (highest === 3) return 50;
  return 30;
}

function scoreConstructionNovelty(ctx: ScoringContext): number {
  const signatures = new Set<string>();
  for (const obs of ctx.trendObservations) {
    signatures.add(dimensionsSignature(obs.dimensions));
  }

  const units = countAdoptionUnitsInContext(ctx);
  if (units === 0) return 0;

  const diversityRatio = signatures.size / units;
  return clamp(30 + diversityRatio * 70);
}

function scoreFirstSeenRecency(ctx: ScoringContext): number {
  if (ctx.trendObservations.length === 0) return 0;

  const firstDates = ctx.trendObservations.map((o) => parseIsoDate(o.firstSeen));
  const avgDays =
    firstDates.reduce(
      (sum, d) => sum + daysBetween(d, ctx.now),
      0,
    ) / firstDates.length;

  if (avgDays <= 45) return 95;
  if (avgDays <= 90) return 75;
  if (avgDays <= 180) return 50;
  return 25;
}

export function computeNoveltyScore(ctx: ScoringContext): number {
  const leaderEarly = scoreLeaderEarlySignal(ctx);
  const lowMass = scoreLowMassPenetration(ctx);
  const construction = scoreConstructionNovelty(ctx);
  const recency = scoreFirstSeenRecency(ctx);

  return clamp(
    leaderEarly * 0.3 +
      lowMass * 0.3 +
      construction * 0.2 +
      recency * 0.2,
  );
}

export {
  scoreLeaderEarlySignal,
  scoreLowMassPenetration,
  scoreConstructionNovelty,
  scoreFirstSeenRecency,
};
