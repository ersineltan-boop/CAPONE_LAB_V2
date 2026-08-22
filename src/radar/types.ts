export type RadarSignalDimension =
  | "CATEGORY"
  | "COLOR"
  | "MATERIAL"
  | "HEEL"
  | "DETAIL"
  | "CONSTRUCTION";

export interface RealSignalCluster {
  id: string;
  title: string;
  dimension: RadarSignalDimension;
  tag: string;
  productCount: number;
  brandCount: number;
  brands: string[];
  exampleProductUrls: string[];
}

export interface RadarBuildInput {
  comparisonAvailable: boolean;
  collectedAt: string;
  totalProducts: number;
  totalBrands: number;
}
