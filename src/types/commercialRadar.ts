/** Ticari karar — kullanıcıya gösterilen set */
export type CommercialDecision =
  | "NUMUNEYE GİR"
  | "HAZIRLAN"
  | "İZLE"
  | "DOYGUN"
  | "VERİ BİRİKİYOR";

export type CommercialStage =
  | "DIRECTIONAL"
  | "EARLY_COMMERCIAL"
  | "COMMERCIAL"
  | "MASS_MARKET";

export interface ProductReference {
  brand: string;
  model?: string;
  country?: string;
  segment?: string;
  commercialStage: CommercialStage;
  imageUrl?: string | null;
  externalUrl?: string | null;
  observedAt?: string;
  roleLabel?: string;
}

export interface MarketFitEntry {
  market: string;
  level: "Yüksek" | "Orta" | "Düşük";
}

export interface ProductTranslation {
  form: string;
  toe: string;
  upper: string;
  heelSole: string;
  material: string;
  colors: string[];
  turkeyProduction: string;
  chinaNeed: string;
  commercialRisk: string;
  recommendedSamples: string[];
}

export interface EngineMetricsSnapshot {
  trendStrength: number;
  momentumScore: number | null;
  noveltyScore: number;
  saturationScore: number;
  opportunityScore: number;
}

export interface TrendCommercialRadarItem {
  id: string;
  title: string;
  category: string;
  decision: CommercialDecision;
  stage: string;
  summary: string;
  whyNow: string;
  marketFit: MarketFitEntry[];
  production: string;
  seasonFit: string;
  caponeRecommendation: string;
  /** Ana kart — 4 aşama görseli */
  heroReferences: [
    ProductReference,
    ProductReference,
    ProductReference,
    ProductReference,
  ];
  /** Detay — aşama bazlı tüm referanslar (20+ destekli) */
  references: ProductReference[];
  reverseSeasonReferences: ProductReference[];
  reverseSeasonLabel: string;
  productTranslation: ProductTranslation;
  engineMetrics?: EngineMetricsSnapshot;
  /** Distinctive cluster rationale for detail modal */
  radarReason?: string;
  updatedAt: string;
  radarType?: "EARLY" | "COMMERCIAL";
  confidence?: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";
  momentumScore?: number | null;
  isChanging?: boolean;
}

export interface RadarTopSummary {
  lastUpdated: string;
  brandsChecked: number;
  newProducts: number;
  significantMovements: number;
}

export interface BrandDiscoveryItem {
  id: string;
  country: string;
  brand: string;
  segment: string;
  whyNotable: string;
  images: Array<{ alt: string; url?: string | null }>;
}

export interface BrandExplorerItem {
  id: string;
  brand: string;
  country: string;
  segment: string;
  classificationStatus: "UNREVIEWED" | "REVIEWED";
  footwearInfluence: number;
  recentSignalCount: number;
  images: Array<{ alt: string; url?: string | null }>;
}

export const COMMERCIAL_STAGE_LABELS: Record<CommercialStage, string> = {
  DIRECTIONAL: "ÖNCÜ",
  EARLY_COMMERCIAL: "ERKEN TİCARİ",
  COMMERCIAL: "TİCARİ",
  MASS_MARKET: "MASS MARKET",
};

export const HERO_STAGE_ORDER: CommercialStage[] = [
  "DIRECTIONAL",
  "EARLY_COMMERCIAL",
  "COMMERCIAL",
  "MASS_MARKET",
];
