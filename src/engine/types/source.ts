export type SourceRole =
  | "LEADER"
  | "EARLY_ADOPTER"
  | "MARKET"
  | "RETAIL"
  | "SOCIAL"
  | "PRODUCTION_SIGNAL";

export interface TrendSourceConfig {
  id: string;
  brand: string;
  country: string;
  segment: string;
  sourceType: string;
  sourceUrl: string | null;
  /** Kaynak güvenilirlik ağırlığı — 0 ile 1 arası */
  weight: number;
  isActive: boolean;
  role: SourceRole;
}

export type SourceRegistry = ReadonlyMap<string, TrendSourceConfig>;
