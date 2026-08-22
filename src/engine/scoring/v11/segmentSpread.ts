import type { ScoringContext } from "./context";
import {
  normalizeMarketSegment,
  SEGMENT_LIFECYCLE,
  segmentIndex,
  type MarketSegment,
} from "../../types";
import { isInWindow } from "../../utils/dates";
import { clamp } from "../../utils/clamp";

function resolveSegment(
  ctx: ScoringContext,
  observation: ScoringContext["trendObservations"][number],
): MarketSegment | null {
  if (observation.segment) return observation.segment;

  const source = ctx.sources.get(observation.sourceId);
  return normalizeMarketSegment(source?.segment ?? null);
}

/** Segment yayılımı — lifecycle boyunca kaç segmentte kanıt var */
export function scoreSegmentSpread(ctx: ScoringContext): number {
  const segments = collectObservedSegments(ctx);
  const maxSegments = SEGMENT_LIFECYCLE.length;
  return clamp((segments.size / maxSegments) * 100);
}

export function collectObservedSegments(
  ctx: ScoringContext,
): Set<MarketSegment> {
  const segments = new Set<MarketSegment>();

  for (const obs of ctx.trendObservations) {
    const segment = resolveSegment(ctx, obs);
    if (segment) segments.add(segment);
  }

  return segments;
}

/** Lifecycle'da ulaşılan en yüksek segment indeksi — saturation için */
export function highestSegmentReached(ctx: ScoringContext): number {
  const segments = collectObservedSegments(ctx);
  if (segments.size === 0) return -1;

  return Math.max(...[...segments].map((s) => segmentIndex(s)));
}

export function hasMassMarketPenetration(ctx: ScoringContext): boolean {
  return collectObservedSegments(ctx).has("MASS_MARKET");
}

export function countSegmentTransitions(ctx: ScoringContext): number {
  const segments = [...collectObservedSegments(ctx)].sort(
    (a, b) => segmentIndex(a) - segmentIndex(b),
  );

  return Math.max(0, segments.length - 1);
}

export function countNewSegmentsInWindow(
  ctx: ScoringContext,
  startDaysAgo: number,
  endDaysAgo: number,
): number {
  const before = new Set<MarketSegment>();
  const during = new Set<MarketSegment>();

  for (const obs of ctx.trendObservations) {
    const segment = resolveSegment(ctx, obs);
    if (!segment) continue;

    if (isInWindow(obs.firstSeen, ctx.now, startDaysAgo, endDaysAgo)) {
      during.add(segment);
    } else {
      const observed = new Date(obs.firstSeen);
      const diff = (ctx.now.getTime() - observed.getTime()) / 86_400_000;
      if (diff > startDaysAgo) before.add(segment);
    }
  }

  let novel = 0;
  for (const segment of during) {
    if (!before.has(segment)) novel += 1;
  }
  return novel;
}
