import type { TrendObservation } from "../types";
import type { TrendSourceConfig } from "../types";
import { clamp } from "../utils/clamp";

export interface LeaderBrandSignalInput {
  observations: readonly TrendObservation[];
  sources: ReadonlyMap<string, TrendSourceConfig>;
  /** 5 öncü marka sinyali = 100 puan */
  maxSignals?: number;
}

/**
 * Öncü marka sinyali — LEADER rolündeki kaynaklardan gelen gözlem yoğunluğu.
 */
export function scoreLeaderBrandSignal(input: LeaderBrandSignalInput): number {
  const { observations, sources, maxSignals = 5 } = input;
  let leaderSignals = 0;

  for (const obs of observations) {
    const source = sources.get(obs.sourceId);
    if (!source || !source.isActive || source.role !== "LEADER") continue;

    leaderSignals += obs.confidence;
  }

  return clamp((leaderSignals / maxSignals) * 100);
}

export function countLeaderSignals(input: LeaderBrandSignalInput): number {
  const { observations, sources } = input;
  let total = 0;

  for (const obs of observations) {
    const source = sources.get(obs.sourceId);
    if (!source || !source.isActive || source.role !== "LEADER") continue;
    total += obs.confidence;
  }

  return total;
}
