import type { TrendObservation } from "../types";
import type { TrendSignalDimensions } from "../types";

export function createObservation(
  partial: Omit<TrendObservation, "dimensions"> & {
    dimensions?: Partial<TrendSignalDimensions>;
  },
): TrendObservation {
  const { dimensions, ...rest } = partial;

  return {
    ...rest,
    dimensions: {
      silhouette: null,
      toeShape: null,
      heelType: null,
      heelHeight: null,
      sole: null,
      material: null,
      color: null,
      detail: null,
      category: null,
      ...dimensions,
    },
  };
}

export function filterObservationsForTrendScore(
  observations: readonly TrendObservation[],
  sources: ReadonlyMap<string, import("../types").TrendSourceConfig>,
): TrendObservation[] {
  return observations.filter((obs) => {
    const source = sources.get(obs.sourceId);
    return source?.isActive && source.role !== "PRODUCTION_SIGNAL";
  });
}
