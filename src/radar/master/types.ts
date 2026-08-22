import type { FootwearCategory } from "../../types/pilotProduct";
import type { BrandRole, BrandSegment } from "../../registry/types/brand";

export type MasterRadarType = "EARLY" | "COMMERCIAL";

export type MasterRadarView = "CHANGING" | "ALL";

export type EarlyRadarStage = "COK_ERKEN" | "ERKEN_SINYAL";

export type CommercialRadarStage = "HAZIRLAN" | "NUMUNEYE_GIR" | "DOYGUN_GEC";

export type RadarStage = EarlyRadarStage | CommercialRadarStage;

export type SignalConfidence = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";

export type SignalDimension =
  | "TOE_SHAPE"
  | "HEEL_TYPE"
  | "HEEL_HEIGHT_GROUP"
  | "DETAIL"
  | "CONSTRUCTION"
  | "SURFACE_EFFECT";

export const FORBIDDEN_SIGNAL_DIMENSIONS = [
  "COLOR",
  "MATERIAL",
  "CATEGORY",
] as const;

export interface SignalAttribute {
  dimension: SignalDimension;
  value: string;
}

export interface BrandEvidenceProfile {
  brand: string;
  segment: BrandSegment | "UNKNOWN";
  role: BrandRole | "UNKNOWN";
  directionalInfluence: number;
  commercialInfluence: number;
  footwearInfluence: number;
}

export interface RadarEvidenceItem {
  modelFamilyId: string;
  brand: string;
  canonicalName: string;
  imageUrl: string | null;
  productUrl: string;
  stage: RadarStage | null;
  variantCount: number;
  buyerValidation: string[];
}

export interface RadarDirectionSignal {
  id: string;
  directionName: string;
  category: FootwearCategory;
  radarType: MasterRadarType;
  stage: RadarStage;
  confidence: SignalConfidence;
  independentBrandCount: number;
  modelFamilyCount: number;
  description: string;
  requiredAttributes: SignalAttribute[];
  heroEvidence: RadarEvidenceItem[];
  allEvidence: RadarEvidenceItem[];
  momentumScore: number | null;
  rankingScore: number;
  isChanging: boolean;
  brands: string[];
}

export interface CategoryRadarSlice {
  category: FootwearCategory;
  earlySignals: RadarDirectionSignal[];
  commercialSignals: RadarDirectionSignal[];
  familyCount: number;
}

export interface MasterRadarBuildResult {
  categories: CategoryRadarSlice[];
  allSignals: RadarDirectionSignal[];
  comparisonAvailable: boolean;
  collectedAt: string;
}

export interface ExcludedCandidate {
  category: FootwearCategory;
  signalAttributes: SignalAttribute[];
  reason: string;
  candidateModelFamilyIds: string[];
}

export interface RadarSignalAuditEntry {
  signalId: string;
  category: FootwearCategory;
  radarType: MasterRadarType;
  directionName: string;
  signalAttributes: SignalAttribute[];
  requiredAttributes: SignalAttribute[];
  includedModelFamilyIds: string[];
  includedBrands: string[];
  excludedCandidates: ExcludedCandidate[];
  stageEvidence: Array<{
    stage: RadarStage;
    brand: string;
    modelFamilyId: string;
    segment: BrandSegment | "UNKNOWN";
    role: BrandRole | "UNKNOWN";
  }>;
  buyerValidation: Array<{
    modelFamilyId: string;
    sources: string[];
  }>;
  historyEvidence: {
    comparisonAvailable: boolean;
    momentumScore: number | null;
    isChanging: boolean;
  };
  confidence: SignalConfidence;
  rankingComponents: {
    brandBreadth: number;
    brandQuality: number;
    modelFamilyCount: number;
    distinctiveness: number;
    stageFit: number;
  };
}

export interface RadarSignalAuditReport {
  generatedAt: string;
  comparisonAvailable: boolean;
  totalSignals: number;
  signals: RadarSignalAuditEntry[];
  excludedGlobal: ExcludedCandidate[];
}
