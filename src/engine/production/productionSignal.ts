import type { TrendObservation } from "../types";
import type { TrendSourceConfig } from "../types";

export interface ProductionSignalSummary {
  observationCount: number;
  sourceCount: number;
  brands: string[];
  /** @deprecated use productionPressure */
  signalStrength: number;
  /** Üretim / kopyalanma baskısı — 0–100, trendStrength'ten bağımsız */
  productionPressure: number;
}

/**
 * Çin ve PRODUCTION_SIGNAL rolündeki gözlemler için ayrı özet.
 * Trend pazarı skorlarına karışmaz.
 */
export function summarizeProductionSignals(
  observations: readonly TrendObservation[],
  sources: ReadonlyMap<string, TrendSourceConfig>,
): ProductionSignalSummary {
  const brands = new Set<string>();
  let observationCount = 0;
  let weightedConfidence = 0;
  const activeSourceIds = new Set<string>();

  for (const obs of observations) {
    const source = sources.get(obs.sourceId);
    if (!source || !source.isActive || source.role !== "PRODUCTION_SIGNAL") {
      continue;
    }

    observationCount += 1;
    weightedConfidence += obs.confidence * source.weight;
    brands.add(obs.brand);
    activeSourceIds.add(source.id);
  }

  const productionPressure = Math.min(
    100,
    observationCount * 15 + weightedConfidence * 40,
  );

  return {
    observationCount,
    sourceCount: activeSourceIds.size,
    brands: [...brands],
    signalStrength: productionPressure,
    productionPressure,
  };
}
