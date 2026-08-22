import type { FootwearCategory } from "./pilotProduct";

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

export interface NormalizedProduct {
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
