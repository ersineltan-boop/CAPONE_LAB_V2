import type { TrendObservation } from "../types";
import type { TrendSourceConfig } from "../types";
import { isTrendMarketCountry } from "../constants/markets";
import { isTrendScoreRole } from "../constants/roles";
import { clamp } from "../utils/clamp";

export interface IndependentBrandCountInput {
  observations: readonly TrendObservation[];
  sources: ReadonlyMap<string, TrendSourceConfig>;
  /** 10 marka = 100 puan */
  maxBrands?: number;
}

/**
 * Bağımsız marka sayısı — trend pazarı gözlemlerindeki benzersiz marka adedi.
 * Çin / PRODUCTION_SIGNAL gözlemleri hariç tutulur.
 */
export function scoreIndependentBrandCount(
  input: IndependentBrandCountInput,
): number {
  const { observations, sources, maxBrands = 10 } = input;
  const brands = new Set<string>();

  for (const obs of observations) {
    const source = sources.get(obs.sourceId);
    if (!source || !source.isActive || !isTrendScoreRole(source.role)) continue;
    if (!isTrendMarketCountry(obs.country)) continue;

    brands.add(obs.brand.trim().toLowerCase());
  }

  return clamp((brands.size / maxBrands) * 100);
}

export function countIndependentBrands(
  input: IndependentBrandCountInput,
): number {
  const { observations, sources } = input;
  const brands = new Set<string>();

  for (const obs of observations) {
    const source = sources.get(obs.sourceId);
    if (!source || !source.isActive || !isTrendScoreRole(source.role)) continue;
    if (!isTrendMarketCountry(obs.country)) continue;

    brands.add(obs.brand.trim().toLowerCase());
  }

  return brands.size;
}
