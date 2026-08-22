import type { SourceRole } from "../types";

/** Trend skoru hesabına dahil edilen roller */
export const TREND_SCORE_ROLES: readonly SourceRole[] = [
  "LEADER",
  "EARLY_ADOPTER",
  "MARKET",
  "RETAIL",
  "SOCIAL",
];

/** Trend pazarı skorlarına dahil edilmez — ayrı doğrulama katmanı */
export const PRODUCTION_SIGNAL_ROLE = "PRODUCTION_SIGNAL" as const;

export function isTrendScoreRole(role: SourceRole): boolean {
  return role !== PRODUCTION_SIGNAL_ROLE;
}
