export type ClusterDimension =
  | "CATEGORY"
  | "TOE_SHAPE"
  | "HEEL_TYPE"
  | "MATERIAL"
  | "COLOR"
  | "DETAIL"
  | "CONSTRUCTION"
  | "SURFACE_EFFECT";

export interface ClusterAttribute {
  dimension: ClusterDimension;
  value: string;
}

export interface ClusterExampleProduct {
  brand: string;
  productName: string;
  productUrl: string;
  imageUrl: string | null;
}

export interface ClusterEvidence {
  textEvidenceCount: number;
  visionEvidenceCount: number;
  hybridEvidenceCount: number;
  analyzedEligibleProducts: number;
  evidenceCoverage: number;
}

export type EvidenceStrength = "WEAK" | "MEDIUM" | "STRONG";

export interface RadarCluster {
  id: string;
  labelTr: string;
  attributes: ClusterAttribute[];
  productCount: number;
  brandCount: number;
  modelFamilyCount: number;
  brands: string[];
  categories: string[];
  exampleProducts: ClusterExampleProduct[];
  distinctivenessScore: number;
  evidenceStrength: EvidenceStrength;
  evidence: ClusterEvidence;
  snapshotStatus: "İLK ÖLÇÜM" | "KARŞILAŞTIRMA";
  productDelta?: number;
  brandDelta?: number;
  newlySeenBrands?: string[];
}

export interface MarketPaletteEntry {
  label: string;
  productCount: number;
  brandCount: number;
}

export interface MarketPalette {
  colors: MarketPaletteEntry[];
  materials: MarketPaletteEntry[];
  categories: MarketPaletteEntry[];
}

export interface ClusterBuildStats {
  candidatesGenerated: number;
  rejectedGenericity: number;
  rejectedRedundancy: number;
  rejectedOverlap: number;
  rejectedParentChild: number;
  rejectedMinBrands: number;
  rejectedUnknown: number;
  rejectedWeakQuality: number;
  selectedCount: number;
}

export interface RadarBuildInput {
  comparisonAvailable: boolean;
  collectedAt: string;
  totalProducts: number;
  totalBrands: number;
}

export interface ProductProvenance {
  text: boolean;
  vision: boolean;
}
