import type { TrendObservation } from "../types";
import type { TrendSourceConfig } from "../types";
import { isTrendScoreRole } from "../constants/roles";
import { isInWindow } from "../utils/dates";
import { clamp } from "../utils/clamp";

export interface AccelerationInput {
  observations: readonly TrendObservation[];
  sources: ReadonlyMap<string, TrendSourceConfig>;
  now: Date;
  windowDays: number;
}

function countInTrendWindow(input: AccelerationInput): {
  recent: number;
  previous: number;
} {
  const { observations, sources, now, windowDays } = input;
  let recent = 0;
  let previous = 0;

  for (const obs of observations) {
    const source = sources.get(obs.sourceId);
    if (!source || !source.isActive || !isTrendScoreRole(source.role)) continue;

    if (isInWindow(obs.observedAt, now, windowDays, 0)) {
      recent += 1;
    } else if (isInWindow(obs.observedAt, now, windowDays * 2, windowDays)) {
      previous += 1;
    }
  }

  return { recent, previous };
}

/**
 * Hızlanma skoru — son N gün / önceki N gün gözlem oranı.
 * Oran 1 = durgun (50 puan), 2+ = hızlanma (100'e yakın), 0 = düşüş (0'a yakın).
 */
export function scoreAcceleration(input: AccelerationInput): number {
  const { recent, previous } = countInTrendWindow(input);

  if (recent === 0 && previous === 0) return 0;
  if (previous === 0) return clamp(50 + recent * 10);

  const ratio = recent / previous;

  if (ratio >= 2) return 100;
  if (ratio >= 1) return clamp(50 + (ratio - 1) * 50);
  return clamp(ratio * 50);
}

export function scoreAcceleration30d(
  observations: readonly TrendObservation[],
  sources: ReadonlyMap<string, TrendSourceConfig>,
  now: Date,
): number {
  return scoreAcceleration({ observations, sources, now, windowDays: 30 });
}

export function scoreAcceleration90d(
  observations: readonly TrendObservation[],
  sources: ReadonlyMap<string, TrendSourceConfig>,
  now: Date,
): number {
  return scoreAcceleration({ observations, sources, now, windowDays: 90 });
}
