import type { FootwearCategory } from "./pilotProduct";

export type ColorFamily =
  | "BLACK"
  | "WHITE"
  | "CREAM"
  | "BEIGE"
  | "BROWN"
  | "ESPRESSO"
  | "TAN"
  | "BURGUNDY"
  | "RED"
  | "PINK"
  | "ORANGE"
  | "YELLOW"
  | "GREEN"
  | "BLUE"
  | "PURPLE"
  | "SILVER"
  | "GOLD"
  | "METALLIC_OTHER"
  | "MULTICOLOR"
  | "UNKNOWN";

export type MaterialFamily =
  | "LEATHER"
  | "NAPPA"
  | "SUEDE"
  | "NUBUCK"
  | "PATENT"
  | "CROC_EFFECT"
  | "WOVEN_LEATHER"
  | "TEXTILE"
  | "MESH"
  | "SATIN"
  | "VINYL_TPU"
  | "METALLIC_LEATHER"
  | "SYNTHETIC"
  | "OTHER"
  | "UNKNOWN";

export type HeelTypeNormalized =
  | "FLAT"
  | "KITTEN"
  | "BLOCK"
  | "STILETTO"
  | "WEDGE"
  | "SCULPTURAL"
  | "PLATFORM"
  | "OTHER"
  | "UNKNOWN";

export type HeelHeightGroup =
  | "FLAT"
  | "LOW"
  | "MID"
  | "HIGH"
  | "UNKNOWN";

export type ToeShapeNormalized =
  | "ROUND"
  | "POINTED"
  | "SQUARE"
  | "OPEN"
  | "UNKNOWN";

export type DetailTag =
  | "THONG"
  | "BRAIDED"
  | "WOVEN"
  | "FRINGE"
  | "BUCKLE"
  | "BOW"
  | "RUCHED"
  | "FLOWER"
  | "PEARL"
  | "STONE"
  | "METAL_HARDWARE"
  | "CHAIN"
  | "LACE_UP"
  | "STUD"
  | "CUT_OUT"
  | "ASYMMETRIC"
  | "OTHER";

export type ConstructionTag =
  | "SLINGBACK"
  | "OPEN_TOE"
  | "PEEP_TOE"
  | "HIGH_VAMP"
  | "LOW_VAMP"
  | "T_STRAP"
  | "ANKLE_STRAP"
  | "BACKLESS"
  | "CLOSED_TOE"
  | "OTHER";

export interface NormalizedFields {
  category: FootwearCategory | null;
  colorFamily: ColorFamily;
  materialFamily: MaterialFamily;
  heelType: HeelTypeNormalized;
  heelHeightGroup: HeelHeightGroup;
  toeShape: ToeShapeNormalized;
  details: DetailTag[];
  construction: ConstructionTag[];
}

export interface CleanedFields {
  heelHeight: string | null;
  color: string | null;
}

export interface AnalyzedProduct {
  source: string;
  brand: string;
  productName: string;
  productUrl: string;
  imageUrl: string | null;
  category: FootwearCategory | null;
  color: string | null;
  material: string | null;
  toeShape: string | null;
  heelType: string | null;
  heelHeight: string | null;
  details: string | null;
  discoveredAt: string;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  cleaned: CleanedFields;
  normalized: NormalizedFields;
}

export interface TagCount {
  tag: string;
  productCount: number;
  brandCount: number;
  brands: string[];
}

export interface BrandBreakdown {
  brand: string;
  productCount: number;
  topCategories: TagCount[];
  topColors: TagCount[];
}

export interface MarketSignal extends TagCount {
  dimension:
    | "category"
    | "colorFamily"
    | "materialFamily"
    | "heelType"
    | "heelHeightGroup"
    | "details"
    | "construction"
    | "surfaceEffects";
  labelTr: string;
}

export interface MarketAnalysis {
  totalProducts: number;
  totalBrands: number;
  categories: TagCount[];
  colors: TagCount[];
  materials: TagCount[];
  heelTypes: TagCount[];
  heelHeightGroups: TagCount[];
  details: TagCount[];
  constructions: TagCount[];
  brandBreakdown: BrandBreakdown[];
  topSignals: MarketSignal[];
  unknownCounts: {
    colorFamily: number;
    materialFamily: number;
    heelType: number;
    heelHeightGroup: number;
    toeShape: number;
  };
}

export type SignalFilter = {
  dimension: MarketSignal["dimension"];
  tag: string;
} | null;
