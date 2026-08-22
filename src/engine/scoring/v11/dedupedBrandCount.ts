import type { ScoringContext } from "./context";
import { countIndependentEntities } from "../../independence/evidenceIndependence";
import { DEFAULT_EVIDENCE_INDEPENDENCE } from "../../types/observation";
import { clamp } from "../../utils/clamp";

/** Dedup sonrası bağımsız marka/grup sayısı skoru */
export function scoreDedupedBrandCount(
  ctx: ScoringContext,
  maxBrands = 10,
): number {
  const config = {
    ...DEFAULT_EVIDENCE_INDEPENDENCE,
    dedupeScope: ctx.dedupeScope,
  };
  const count = countIndependentEntities(ctx.trendObservations, config);
  return clamp((count / maxBrands) * 100);
}

export function countDedupedIndependentBrands(ctx: ScoringContext): number {
  const config = {
    ...DEFAULT_EVIDENCE_INDEPENDENCE,
    dedupeScope: ctx.dedupeScope,
  };
  return countIndependentEntities(ctx.trendObservations, config);
}
