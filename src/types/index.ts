export type TrendStatus =
  | "ERKEN SİNYAL"
  | "YÜKSELİYOR"
  | "HIZLANIYOR"
  | "ANA AKIM"
  | "DOYGUN";

export type OpportunityWindow =
  | "Çok Erken"
  | "Üretime Aday"
  | "En İyi Giriş Zamanı"
  | "Hızlanıyor"
  | "Ana Akım"
  | "Doygun";

export type CaponeDecision =
  | "NUMUNEYE GİR"
  | "TAKİP ET"
  | "BEKLE"
  | "GEÇ KALDIK";

export type EvidenceStrength = "düşük" | "orta" | "yüksek";

export type Direction = "↑" | "→" | "↓";

export interface ColorDirection {
  name: string;
  direction: Direction;
  note?: string;
}

export interface TrendSource {
  brand: string;
  country: string;
  segment: string;
  date: string;
  evidenceType: string;
  url: string | null;
}

export interface TrendEvidence {
  sourceCount: number;
  brandCount: number;
  countryCount: number;
  strength: EvidenceStrength;
}

/** Sabit 3 slot — gerçek veride url doldurulur, demo'da null kalabilir */
export interface TrendReferenceImage {
  slot: 1 | 2 | 3;
  url: string | null;
  alt: string;
}

/** Karar motoru girdileri — API/scraper bu alanları üretir, decision türetilir */
export interface CaponeDecisionInputs {
  trendStatus: TrendStatus;
  opportunityWindow: OpportunityWindow;
  evidenceStrength: EvidenceStrength;
}

export interface CaponeDecisionMeta {
  decision: CaponeDecision;
  inputs: CaponeDecisionInputs;
  rationale: string;
}

export interface Trend {
  id: string;
  name: string;
  nameTr: string;
  status: TrendStatus;
  direction: string;
  outlook6m: string;
  outlook12m: string;
  referenceImages: [TrendReferenceImage, TrendReferenceImage, TrendReferenceImage];
  colors: ColorDirection[];
  form: string;
  material: string;
  heelSole: string;
  detailAccessory: string;
  diffusion: string[];
  whyImportant: string;
  whyImportantShort: string;
  opportunityWindow: OpportunityWindow;
  caponeDecision: CaponeDecisionMeta;
  caponeOpportunity: string;
  evidence: TrendEvidence;
  sources: TrendSource[];
}

export interface DailySummary {
  trendsAccelerated: number;
  newSignals: number;
  colorMovements: number;
  approachingMainstream: number;
}

export interface GlobalMarket {
  name: string;
  active: boolean;
  note?: string;
}
