export const VISION_TOE_SHAPES = [
  "ROUND",
  "ALMOND",
  "POINTED",
  "SQUARE",
  "PEEP_TOE",
  "OPEN",
  "UNKNOWN",
] as const;

export const VISION_HEEL_TYPES = [
  "FLAT",
  "KITTEN",
  "BLOCK",
  "STILETTO",
  "WEDGE",
  "SCULPTURAL",
  "PLATFORM",
  "OTHER",
  "UNKNOWN",
] as const;

export const VISION_DETAILS = [
  "THONG",
  "BRAIDED",
  "WOVEN",
  "FRINGE",
  "BUCKLE",
  "BOW",
  "RUCHED",
  "FLOWER",
  "PEARL",
  "STONE",
  "METAL_HARDWARE",
  "CHAIN",
  "LACE_UP",
  "STUD",
  "CUT_OUT",
  "ASYMMETRIC",
] as const;

export const VISION_CONSTRUCTIONS = [
  "SLINGBACK",
  "OPEN_TOE",
  "PEEP_TOE",
  "HIGH_VAMP",
  "LOW_VAMP",
  "T_STRAP",
  "ANKLE_STRAP",
  "BACKLESS",
  "CLOSED_TOE",
] as const;

export const VISION_SURFACE_EFFECTS = [
  "CROC_EFFECT",
  "PATENT",
  "SUEDE_LOOK",
  "NUBUCK_LOOK",
  "METALLIC",
  "WOVEN",
  "MESH",
  "TRANSPARENT",
] as const;

export type VisionToeShape = (typeof VISION_TOE_SHAPES)[number];
export type VisionHeelType = (typeof VISION_HEEL_TYPES)[number];
export type VisionDetail = (typeof VISION_DETAILS)[number];
export type VisionConstruction = (typeof VISION_CONSTRUCTIONS)[number];
export type VisionSurfaceEffect = (typeof VISION_SURFACE_EFFECTS)[number];

export interface ScoredValue<T extends string = string> {
  value: T;
  confidence: number;
}

export interface ScoredTag<T extends string = string> {
  tag: T;
  confidence: number;
}

export interface VisionFields {
  toeShape: ScoredValue<VisionToeShape>;
  heelType: ScoredValue<VisionHeelType>;
  details: ScoredTag<VisionDetail>[];
  construction: ScoredTag<VisionConstruction>[];
  surfaceEffects: ScoredTag<VisionSurfaceEffect>[];
}

export interface AnalyzedProductInput {
  source: string;
  brand: string;
  productName: string;
  productUrl: string;
  imageUrl: string | null;
  category: string | null;
  toeShape: string | null;
  heelType: string | null;
  details: string | null;
  normalized?: {
    toeShape?: string;
    heelType?: string;
    details?: string[];
    construction?: string[];
  };
}

export interface VisionProductRecord {
  productUrl: string;
  brand: string;
  productName: string;
  imageUrl: string;
  model: string;
  analyzedAt: string;
  vision: VisionFields;
  usage?: TokenUsage;
  error?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface VisionAnalysisFile {
  runStartedAt: string;
  runFinishedAt: string | null;
  model: string;
  products: VisionProductRecord[];
  usage: TokenUsage;
}

export interface TextConflict {
  productUrl: string;
  brand: string;
  productName: string;
  field: string;
  textValue: string;
  visionValue: string;
  visionConfidence: number;
}

export interface LowConfidenceItem {
  productUrl: string;
  brand: string;
  productName: string;
  field: string;
  value: string;
  confidence: number;
}

export interface VisionAnalysisReport {
  runStartedAt: string;
  runFinishedAt: string;
  model: string;
  selectedProducts: number;
  analyzedProducts: number;
  skippedExisting: number;
  failedProducts: number;
  newApiCalls: number;
  toeShapeUnknownBefore: number;
  toeShapeUnknownAfter: number;
  heelTypeUnknownAfter: number;
  newlyFilledToeShape: number;
  newlyDetectedDetails: TagSummary[];
  conflictsWithText: TextConflict[];
  lowConfidenceResults: LowConfidenceItem[];
  topVisualDetails: TagSummary[];
  topVisualConstructions: TagSummary[];
  topVisualSurfaceEffects: TagSummary[];
  apiErrors: string[];
  usage: TokenUsage;
}

export interface TagSummary {
  tag: string;
  productCount: number;
  brandCount: number;
  brands: string[];
}

export const BRAND_TARGETS = ["SCHUTZ", "TONY BIANCO", "ST. AGNI"] as const;
export const PRODUCTS_PER_BRAND = 10;
export const LOW_CONFIDENCE_THRESHOLD = 0.5;
