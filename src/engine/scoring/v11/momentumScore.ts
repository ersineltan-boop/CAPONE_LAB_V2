import type { ScoringContext } from "./context";
import { isInWindow, parseIsoDate, daysBetween } from "../../utils/dates";
import { isTrendScoreRole } from "../../constants/roles";
import {
  countAdoptionUnits,
} from "../../independence/evidenceIndependence";
import { DEFAULT_EVIDENCE_INDEPENDENCE } from "../../types/observation";
import { countNewSegmentsInWindow } from "./segmentSpread";
import { scoreAcceleration } from "../acceleration";
import { clamp } from "../../utils/clamp";
import type { MomentumComponents } from "../../types";

export interface MomentumResult {
  score: number | null;
  components: MomentumComponents | null;
}

function observationHistorySpanDays(ctx: ScoringContext): number {
  if (ctx.trendObservations.length === 0) return 0;

  const dates = ctx.trendObservations.map((o) => parseIsoDate(o.observedAt));
  const min = new Date(Math.min(...dates.map((d) => d.getTime())));
  const max = new Date(Math.max(...dates.map((d) => d.getTime())));

  return daysBetween(min, max);
}

function hasObservationsInWindow(
  ctx: ScoringContext,
  startDaysAgo: number,
  endDaysAgo: number,
): boolean {
  return ctx.trendObservations.some((obs) =>
    isInWindow(obs.observedAt, ctx.now, startDaysAgo, endDaysAgo),
  );
}

function filterWindow(
  ctx: ScoringContext,
  startDaysAgo: number,
  endDaysAgo: number,
) {
  return ctx.trendObservations.filter((obs) =>
    isInWindow(obs.observedAt, ctx.now, startDaysAgo, endDaysAgo),
  );
}

function scoreBrandAcquisitionMomentum(ctx: ScoringContext): number | null {
  const recent = filterWindow(ctx, 30, 0);
  const previous = filterWindow(ctx, 60, 30);

  if (recent.length === 0) return null;

  const recentBrands = new Set(recent.map((o) => o.independentEntityKey));
  const previousBrands = new Set(previous.map((o) => o.independentEntityKey));

  let novel = 0;
  for (const brand of recentBrands) {
    if (brand && !previousBrands.has(brand)) novel += 1;
  }

  if (previous.length === 0) return novel > 0 ? clamp(40 + novel * 15) : null;

  const ratio = previousBrands.size === 0 ? novel : novel / previousBrands.size;
  return clamp(Math.min(100, 30 + ratio * 70));
}

function scoreSegmentTransitionMomentum(ctx: ScoringContext): number | null {
  const novelSegments = countNewSegmentsInWindow(ctx, 90, 0);
  if (!hasObservationsInWindow(ctx, 90, 0)) return null;
  if (novelSegments === 0) return 20;
  return clamp(35 + novelSegments * 25);
}

export function hasSufficientMomentumHistory(
  ctx: ScoringContext,
  minHistoryDays = 60,
): boolean {
  const span = observationHistorySpanDays(ctx);
  if (span < minHistoryDays) return false;
  if (ctx.trendObservations.length < 3) return false;

  const hasPreviousWindow =
    hasObservationsInWindow(ctx, 60, 30) ||
    hasObservationsInWindow(ctx, 180, 90);

  return hasPreviousWindow;
}

export function computeMomentumComponents(
  ctx: ScoringContext,
): MomentumComponents | null {
  if (!hasSufficientMomentumHistory(ctx)) return null;

  const change30d = hasObservationsInWindow(ctx, 30, 0) &&
    hasObservationsInWindow(ctx, 60, 30)
    ? scoreAcceleration({
        observations: ctx.trendObservations,
        sources: ctx.sources,
        now: ctx.now,
        windowDays: 30,
      })
    : null;

  const change90d = hasObservationsInWindow(ctx, 90, 0) &&
    hasObservationsInWindow(ctx, 180, 90)
    ? scoreAcceleration({
        observations: ctx.trendObservations,
        sources: ctx.sources,
        now: ctx.now,
        windowDays: 90,
      })
    : null;

  const newBrandAcquisition = scoreBrandAcquisitionMomentum(ctx);
  const newSegmentTransitions = scoreSegmentTransitionMomentum(ctx);

  if (
    change30d === null &&
    change90d === null &&
    newBrandAcquisition === null &&
    newSegmentTransitions === null
  ) {
    return null;
  }

  return {
    change30d,
    change90d,
    newBrandAcquisition,
    newSegmentTransitions,
  };
}

export function aggregateMomentumScore(
  components: MomentumComponents | null,
): number | null {
  if (!components) return null;

  const values = [
    components.change30d,
    components.change90d,
    components.newBrandAcquisition,
    components.newSegmentTransitions,
  ].filter((v): v is number => v !== null);

  if (values.length === 0) return null;

  return clamp(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export function computeMomentumScore(ctx: ScoringContext): MomentumResult {
  const components = computeMomentumComponents(ctx);
  return {
    score: aggregateMomentumScore(components),
    components,
  };
}

/** Yardımcı — adoption unit kazanımı */
export function countAdoptionUnitsInContext(ctx: ScoringContext): number {
  const config = {
    ...DEFAULT_EVIDENCE_INDEPENDENCE,
    dedupeScope: ctx.dedupeScope,
  };
  return countAdoptionUnits(ctx.trendObservations, config);
}

export function isEligibleTrendObservation(
  ctx: ScoringContext,
  obs: ScoringContext["trendObservations"][number],
): boolean {
  const source = ctx.sources.get(obs.sourceId);
  return Boolean(source?.isActive && isTrendScoreRole(source.role));
}
