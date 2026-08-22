import type { TrendEngineInput } from "../../types";
import type { TrendSourceConfig } from "../../types";
import type { TrendObservation } from "../../types";
import type { DedupeScope } from "../../types/stage";
import { isTrendScoreRole } from "../../constants/roles";
import { isTrendMarketCountry } from "../../constants/markets";
import {
  dedupeObservations,
  type DedupedObservation,
} from "../../independence/evidenceIndependence";
import { DEFAULT_EVIDENCE_INDEPENDENCE } from "../../types/observation";

export interface ScoringContext {
  observations: readonly TrendObservation[];
  sources: ReadonlyMap<string, TrendSourceConfig>;
  now: Date;
  dedupeScope: DedupeScope;
  deduped: DedupedObservation[];
  trendObservations: DedupedObservation[];
}

export function createScoringContext(input: TrendEngineInput): ScoringContext {
  const now = input.now ?? new Date();
  const dedupeScope = input.dedupeScope ?? "silhouette";
  const config = { ...DEFAULT_EVIDENCE_INDEPENDENCE, dedupeScope };

  const deduped = dedupeObservations(input.observations, config);
  const trendObservations = deduped.filter((obs) => {
    const source = input.sources.get(obs.sourceId);
    if (!source?.isActive || !isTrendScoreRole(source.role)) return false;
    if (!isTrendMarketCountry(obs.country)) return false;
    return true;
  });

  return {
    observations: input.observations,
    sources: input.sources,
    now,
    dedupeScope,
    deduped,
    trendObservations,
  };
}
