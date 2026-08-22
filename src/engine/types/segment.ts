export type MarketSegment =
  | "DIRECTIONAL"
  | "LUXURY"
  | "PREMIUM"
  | "CONTEMPORARY"
  | "MASS_MARKET";

/** Trend lifecycle sırası — düşükten yükseğe penetrasyon */
export const SEGMENT_LIFECYCLE: readonly MarketSegment[] = [
  "DIRECTIONAL",
  "LUXURY",
  "PREMIUM",
  "CONTEMPORARY",
  "MASS_MARKET",
] as const;

export function segmentIndex(segment: MarketSegment): number {
  return SEGMENT_LIFECYCLE.indexOf(segment);
}

export function normalizeMarketSegment(
  value: string | MarketSegment | undefined | null,
): MarketSegment | null {
  if (!value) return null;

  const map: Record<string, MarketSegment> = {
    DIRECTIONAL: "DIRECTIONAL",
    LUXURY: "LUXURY",
    LUX: "LUXURY",
    LÜKS: "LUXURY",
    "Lüks": "LUXURY",
    PREMIUM: "PREMIUM",
    Premium: "PREMIUM",
    CONTEMPORARY: "CONTEMPORARY",
    "Çağdaş": "CONTEMPORARY",
    MASS_MARKET: "MASS_MARKET",
    "Kitlesel Pazar": "MASS_MARKET",
    "Kitlesel": "MASS_MARKET",
  };

  return map[value.trim()] ?? map[value.trim().toUpperCase()] ?? null;
}
