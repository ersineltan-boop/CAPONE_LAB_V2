import type { TrendSignalDimensions } from "./signal";
import type { MarketSegment } from "./segment";

/** Tek bir trend gözlemi — scraper veya manuel girişten gelir */
export interface TrendObservation {
  id: string;
  /** İlişkili trend kimliği (opsiyonel — kümeleme aşamasında atanır) */
  trendId?: string;
  dimensions: TrendSignalDimensions;
  /** İlk kez görüldüğü tarih (ISO 8601) */
  firstSeen: string;
  /** Bu gözlemin kaydedildiği tarih (ISO 8601) */
  observedAt: string;
  country: string;
  brand: string;
  /** TrendSourceConfig.id */
  sourceId: string;
  /** Gözlem güven skoru — 0 ile 1 arası */
  confidence: number;
  /** Aynı markanın aynı model ailesi — SKU varyantları tek adoption unit sayılır */
  modelFamily?: string;
  /** Kurumsal grup — bağımsız marka sayısını şişirmemek için */
  corporateGroup?: string;
  /** SKU / renk / materyal varyant kimliği */
  skuVariant?: string;
  /** Aynı kaynağın tekrar yayını — publication dedup */
  publicationId?: string;
  /** Gözlemin ait olduğu pazar segmenti */
  segment?: MarketSegment;
}

export interface EvidenceIndependenceConfig {
  /** silhouette: modelFamily dedup; color/material: varyant bazlı analiz */
  dedupeScope: import("./stage").DedupeScope;
  /** publicationId + sourceId birleşimi ile tekrar kanıtı birleştir */
  dedupePublications: boolean;
  /** corporateGroup varsa marka bağımsızlığında grup bazlı say */
  useCorporateGroup: boolean;
}

export const DEFAULT_EVIDENCE_INDEPENDENCE: EvidenceIndependenceConfig = {
  dedupeScope: "silhouette",
  dedupePublications: true,
  useCorporateGroup: true,
};
