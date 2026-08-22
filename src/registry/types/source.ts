export type SourceLayer =
  | "UPSTREAM"
  | "RUNWAY"
  | "EMERGING_DISCOVERY"
  | "FOOTWEAR_TRADE"
  | "RETAIL_BUYER"
  | "EDITORIAL"
  | "SEARCH"
  | "SOCIAL"
  | "PRODUCTION";

export type SourceRegistryRole =
  | "LEADER"
  | "EARLY_ADOPTER"
  | "MARKET"
  | "RETAIL"
  | "SOCIAL"
  | "PRODUCTION_SIGNAL";

export type SourceAccessMode =
  | "AUTOMATIC_CANDIDATE"
  | "LINK_ONLY"
  | "MANUAL"
  | "API_CANDIDATE";

export interface TrendSourceRegistryEntry {
  id: string;
  name: string;
  country: string;
  layer: SourceLayer;
  role: SourceRegistryRole;
  /** Kaynak ağırlığı — 0 ile 1 arası (motor entegrasyonu ile uyumlu) */
  weight: number;
  officialUrl: string | null;
  accessMode: SourceAccessMode;
  refreshCadence: string;
  isActive: boolean;
  notes: string;
}

export const SOURCE_LAYERS: readonly SourceLayer[] = [
  "UPSTREAM",
  "RUNWAY",
  "EMERGING_DISCOVERY",
  "FOOTWEAR_TRADE",
  "RETAIL_BUYER",
  "EDITORIAL",
  "SEARCH",
  "SOCIAL",
  "PRODUCTION",
] as const;

export const SOURCE_ROLES: readonly SourceRegistryRole[] = [
  "LEADER",
  "EARLY_ADOPTER",
  "MARKET",
  "RETAIL",
  "SOCIAL",
  "PRODUCTION_SIGNAL",
] as const;

export const SOURCE_ACCESS_MODES: readonly SourceAccessMode[] = [
  "AUTOMATIC_CANDIDATE",
  "LINK_ONLY",
  "MANUAL",
  "API_CANDIDATE",
] as const;

export const PRODUCTION_LAYER = "PRODUCTION" as const;
export const PRODUCTION_SIGNAL_ROLE = "PRODUCTION_SIGNAL" as const;

export function isProductionRegistrySource(
  entry: TrendSourceRegistryEntry,
): boolean {
  return (
    entry.layer === PRODUCTION_LAYER && entry.role === PRODUCTION_SIGNAL_ROLE
  );
}

export function isTrendMarketRegistrySource(
  entry: TrendSourceRegistryEntry,
): boolean {
  return !isProductionRegistrySource(entry);
}
