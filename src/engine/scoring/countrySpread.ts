import type { TrendObservation } from "../types";
import type { TrendSourceConfig } from "../types";
import { isTrendMarketCountry } from "../constants/markets";
import { isTrendScoreRole } from "../constants/roles";
import { clamp } from "../utils/clamp";

export interface CountrySpreadInput {
  observations: readonly TrendObservation[];
  sources: ReadonlyMap<string, TrendSourceConfig>;
  /** 8 ülke = 100 puan */
  maxCountries?: number;
}

/**
 * Ülke yayılımı — trend pazarlarında gözlemlenen benzersiz ülke sayısı.
 * Çin trend pazarı olarak sayılmaz.
 */
export function scoreCountrySpread(input: CountrySpreadInput): number {
  const countries = countTrendMarketCountries(input);
  const maxCountries = input.maxCountries ?? 8;
  return clamp((countries / maxCountries) * 100);
}

export function countTrendMarketCountries(input: CountrySpreadInput): number {
  const { observations, sources } = input;
  const countries = new Set<string>();

  for (const obs of observations) {
    const source = sources.get(obs.sourceId);
    if (!source || !source.isActive || !isTrendScoreRole(source.role)) continue;
    if (!isTrendMarketCountry(obs.country)) continue;

    countries.add(obs.country.trim());
  }

  return countries.size;
}
