import type { TrendObservation } from "../types";
import type { TrendSourceConfig } from "../types";
import { isTrendMarketCountry } from "../constants/markets";
import { clamp } from "../utils/clamp";

export interface MarketValidationInput {
  observations: readonly TrendObservation[];
  sources: ReadonlyMap<string, TrendSourceConfig>;
  /** 6 doğrulama sinyali = 100 puan */
  maxSignals?: number;
}

const VALIDATION_ROLES = new Set(["MARKET", "RETAIL"]);

/**
 * Pazar doğrulaması — MARKET ve RETAIL rollerinden gelen trend pazarı gözlemleri.
 * Çin kaynakları dahil edilmez.
 */
export function scoreMarketValidation(input: MarketValidationInput): number {
  const signals = countMarketValidationSignals(input);
  const maxSignals = input.maxSignals ?? 6;
  return clamp((signals / maxSignals) * 100);
}

export function countMarketValidationSignals(
  input: MarketValidationInput,
): number {
  const { observations, sources } = input;
  let total = 0;

  for (const obs of observations) {
    const source = sources.get(obs.sourceId);
    if (!source || !source.isActive || !VALIDATION_ROLES.has(source.role)) {
      continue;
    }
    if (!isTrendMarketCountry(obs.country)) continue;

    total += obs.confidence;
  }

  return total;
}
