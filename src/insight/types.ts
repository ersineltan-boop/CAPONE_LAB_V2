import type { FootwearCategory } from "../types/pilotProduct";

export type InsightSource = "text" | "vision" | "none";

export interface AnalysisCoverage {
  text: boolean;
  vision: boolean;
}

export interface FieldConfidence {
  toeShape: number | null;
  heelType: number | null;
  details: number | null;
  construction: number | null;
  surfaceEffects: number | null;
}

export interface SourceOfTruth {
  color: "text";
  material: "text";
  category: "text";
  toeShape: InsightSource;
  heelType: InsightSource;
  details: InsightSource;
  construction: InsightSource;
  surfaceEffects: InsightSource;
}

export interface NormalizedProductInsight {
  brand: string;
  productName: string;
  productUrl: string;
  imageUrl: string | null;
  category: FootwearCategory | null;
  color: string | null;
  material: string | null;
  toeShape: string | null;
  heelType: string | null;
  details: string[];
  construction: string[];
  surfaceEffects: string[];
  confidence: FieldConfidence;
  analysisCoverage: AnalysisCoverage;
  sourceOfTruth: SourceOfTruth;
}

export interface ProvenanceTagCount {
  tag: string;
  productCount: number;
  brandCount: number;
  brands: string[];
  textSourced: number;
  visionSourced: number;
  hybridProducts: number;
}

export interface BrandBreakdownSummary {
  brand: string;
  productCount: number;
  textOnly: number;
  visionCovered: number;
  fullHybrid: number;
  topCategories: ProvenanceTagCount[];
}

export interface CategoryBreakdownSummary {
  category: string;
  productCount: number;
  brandCount: number;
  brands: string[];
  textSourced: number;
  visionSourced: number;
  hybridProducts: number;
}

export interface NormalizedSummary {
  totalProducts: number;
  textAnalyzedProducts: number;
  visionAnalyzedProducts: number;
  fullHybridProducts: number;
  topToeShape: ProvenanceTagCount[];
  topHeelType: ProvenanceTagCount[];
  topDetails: ProvenanceTagCount[];
  topConstruction: ProvenanceTagCount[];
  topSurfaceEffects: ProvenanceTagCount[];
  brandBreakdown: BrandBreakdownSummary[];
  categoryBreakdown: CategoryBreakdownSummary[];
}

export const VISION_CONFIDENCE_THRESHOLD = 0.5;
