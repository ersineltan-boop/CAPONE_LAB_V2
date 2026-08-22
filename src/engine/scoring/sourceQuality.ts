import type { TrendObservation } from "../types";
import type { TrendSourceConfig } from "../types";
import { isTrendScoreRole } from "../constants/roles";
import { clamp } from "../utils/clamp";

export interface SourceQualityInput {
  observations: readonly TrendObservation[];
  sources: ReadonlyMap<string, TrendSourceConfig>;
}

/**
 * Kaynak kalitesi — aktif kaynakların ağırlığı × gözlem güveni ortalaması.
 * PRODUCTION_SIGNAL kaynakları trend skoruna dahil edilmez.
 */
export function scoreSourceQuality(input: SourceQualityInput): number {
  const { observations, sources } = input;

  if (observations.length === 0) return 0;

  let weightedSum = 0;
  let weightTotal = 0;

  for (const obs of observations) {
    const source = sources.get(obs.sourceId);
    if (!source || !source.isActive || !isTrendScoreRole(source.role)) continue;

    const contribution = source.weight * obs.confidence;
    weightedSum += contribution;
    weightTotal += source.weight;
  }

  if (weightTotal === 0) return 0;

  return clamp((weightedSum / weightTotal) * 100);
}
