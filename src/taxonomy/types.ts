/** CAPONE Footwear Taxonomy V1 — primary category (one per Model Family). */
export type PrimaryFootwearCategory =
  | "BALLET_FLAT"
  | "LOAFER"
  | "PUMP"
  | "SANDAL"
  | "MULE"
  | "BOOT"
  | "SNEAKER"
  | "ESPADRILLE"
  | "OXFORD_DERBY"
  | "CLOG"
  | "UNCLASSIFIED";

export type HybridInfluence =
  | "BALLET"
  | "LOAFER"
  | "PUMP"
  | "SANDAL"
  | "MULE"
  | "BOOT"
  | "SNEAKER"
  | "ESPADRILLE"
  | "OXFORD"
  | "DERBY"
  | "CLOG";

export type TaxonomyFieldStatus = "KNOWN" | "UNKNOWN" | "NOT_APPLICABLE";

export type TaxonomyEvidenceSource =
  | "PRODUCT_PAGE"
  | "STRUCTURED_DATA"
  | "PRODUCT_TEXT"
  | "COLLECTION_TAG"
  | "IMAGE"
  | "DERIVED"
  | "UNKNOWN";

export interface TaxonomyFeature<T> {
  value: T | null;
  status: TaxonomyFieldStatus;
  source: TaxonomyEvidenceSource;
  confidence: number | null;
}

export type ToeShapeTaxonomy = "POINTED" | "ALMOND" | "ROUND" | "SQUARE" | "CHISEL";
export type ToeLengthTaxonomy = "SHORT" | "STANDARD" | "ELONGATED";
export type ToeOpeningTaxonomy = "CLOSED" | "PEEP" | "OPEN";
export type BackConstructionTaxonomy = "CLOSED" | "SLINGBACK" | "BACKLESS";
export type VampHeightTaxonomy = "LOW" | "STANDARD" | "HIGH";
export type HeelHeightClassTaxonomy = "FLAT" | "LOW" | "MID" | "HIGH";
export type HeelTypeTaxonomy =
  | "NONE"
  | "KITTEN"
  | "STILETTO"
  | "BLOCK"
  | "CONE"
  | "FLARED"
  | "SCULPTURAL"
  | "WEDGE"
  | "CUBAN"
  | "OTHER";
export type SoleProfileTaxonomy = "THIN" | "STANDARD" | "CHUNKY" | "LUGGED";
export type PlatformConstructionTaxonomy =
  | "NONE"
  | "FRONT_PLATFORM"
  | "FULL_PLATFORM"
  | "FLATFORM";
export type SideConstructionTaxonomy = "FULL_SIDE" | "DORSAY" | "CUTOUT";
export type ShaftHeightTaxonomy = "ANKLE" | "MID_CALF" | "KNEE_HIGH" | "OVER_THE_KNEE";
export type ShaftFitTaxonomy = "TIGHT" | "REGULAR" | "WIDE" | "SLOUCHY";
export type BootStyleFeature =
  | "CHELSEA"
  | "BIKER"
  | "MOTO"
  | "COMBAT"
  | "WESTERN"
  | "RIDING"
  | "SOCK"
  | "HIKING_INSPIRED";
export type SneakerHeightTaxonomy = "LOW_TOP" | "MID_TOP" | "HIGH_TOP";
export type SneakerStyleArchetype =
  | "COURT"
  | "RETRO_RUNNER"
  | "TECH_RUNNER"
  | "FOOTBALL_INSPIRED"
  | "BOXING_INSPIRED"
  | "SKATE"
  | "BALLET_INSPIRED"
  | "MINIMAL";
export type LoaferDetailTaxonomy =
  | "PLAIN"
  | "PENNY_STRAP"
  | "HORSEBIT"
  | "TASSEL"
  | "KILTIE"
  | "CHAIN"
  | "BUCKLE"
  | "FRINGE";
export type ApronConstructionTaxonomy = "NONE" | "APRON" | "MOC_TOE" | "RAISED_APRON";
export type LacingConstructionTaxonomy = "OXFORD" | "DERBY" | "MONK" | "OTHER";
export type BroguingLevelTaxonomy = "NONE" | "SEMI" | "FULL";
export type ClogBaseConstructionTaxonomy = "WOOD" | "EVA" | "RUBBER" | "MOLDED" | "OTHER";

export type DerivedStyleTag =
  | "MARY_JANE"
  | "HORSEBIT_LOAFER"
  | "BIKER_BOOT"
  | "BALLET_SNEAKER"
  | "SLINGBACK_PUMP"
  | "THONG_SANDAL"
  | "CHELSEA_BOOT"
  | "PLATFORM_DERBY"
  | "ESPADRILLE_WEDGE";

export interface FootwearTaxonomyGlobal {
  toeShape: TaxonomyFeature<ToeShapeTaxonomy>;
  toeLength: TaxonomyFeature<ToeLengthTaxonomy>;
  toeOpening: TaxonomyFeature<ToeOpeningTaxonomy>;
  backConstruction: TaxonomyFeature<BackConstructionTaxonomy>;
  vampHeight: TaxonomyFeature<VampHeightTaxonomy>;
  heelHeightClass: TaxonomyFeature<HeelHeightClassTaxonomy>;
  heelHeightMm: TaxonomyFeature<number>;
  heelType: TaxonomyFeature<HeelTypeTaxonomy>;
  soleProfile: TaxonomyFeature<SoleProfileTaxonomy>;
  platformConstruction: TaxonomyFeature<PlatformConstructionTaxonomy>;
  closureFeatures: TaxonomyFeature<string[]>;
  strapFeatures: TaxonomyFeature<string[]>;
  sideConstruction: TaxonomyFeature<SideConstructionTaxonomy>;
  hardwareType: TaxonomyFeature<string[]>;
  hardwareIntensity: TaxonomyFeature<"MINIMAL" | "MODERATE" | "STATEMENT">;
  embellishmentFeatures: TaxonomyFeature<string[]>;
  materialFamily: TaxonomyFeature<string[]>;
  colorFamily: TaxonomyFeature<string[]>;
  surfacePattern: TaxonomyFeature<string[]>;
}

export interface FootwearTaxonomyCategoryFields {
  throatShape?: TaxonomyFeature<string>;
  toplineConstruction?: TaxonomyFeature<string>;
  strapConfiguration?: TaxonomyFeature<string>;
  apronConstruction?: TaxonomyFeature<ApronConstructionTaxonomy>;
  loaferDetail?: TaxonomyFeature<LoaferDetailTaxonomy[]>;
  outsoleConstruction?: TaxonomyFeature<string>;
  upperCoverage?: TaxonomyFeature<string>;
  ankleCoverage?: TaxonomyFeature<string>;
  shaftHeight?: TaxonomyFeature<ShaftHeightTaxonomy>;
  shaftFit?: TaxonomyFeature<ShaftFitTaxonomy>;
  shaftShape?: TaxonomyFeature<string>;
  bootStyleFeatures?: TaxonomyFeature<BootStyleFeature[]>;
  sneakerHeight?: TaxonomyFeature<SneakerHeightTaxonomy>;
  soleShape?: TaxonomyFeature<string>;
  upperProfile?: TaxonomyFeature<string>;
  styleArchetype?: TaxonomyFeature<SneakerStyleArchetype>;
  panelComplexity?: TaxonomyFeature<"MINIMAL" | "MODERATE" | "COMPLEX">;
  outsoleVisualWeight?: TaxonomyFeature<"LIGHT" | "STANDARD" | "HEAVY">;
  upperConstruction?: TaxonomyFeature<string>;
  espadrilleSoleHeight?: TaxonomyFeature<"FLAT" | "WEDGE" | "PLATFORM">;
  lacingConstruction?: TaxonomyFeature<LacingConstructionTaxonomy>;
  toeConstruction?: TaxonomyFeature<string>;
  broguingLevel?: TaxonomyFeature<BroguingLevelTaxonomy>;
  baseConstruction?: TaxonomyFeature<ClogBaseConstructionTaxonomy>;
}

export type CategoryAssignmentProvenance =
  | "PRODUCT_EVIDENCE"
  | "LEGACY_CATEGORY"
  | "INSUFFICIENT";

export interface FootwearTaxonomyV1 {
  version: 1;
  primaryCategory: PrimaryFootwearCategory;
  hybridInfluences: HybridInfluence[];
  categoryProvenance?: CategoryAssignmentProvenance;
  categoryAssignmentReason?: string;
  global: FootwearTaxonomyGlobal;
  categorySpecific: FootwearTaxonomyCategoryFields;
  derivedStyleTags: DerivedStyleTag[];
}

import type { SourceNewness } from "../newArrivals/newness";
import type { SourceNativeCategory } from "../source/types";

export interface SourceSighting {
  sourceId: string;
  sourceLabel: string;
  sourceKind?: "BRAND_OFFICIAL" | "LUXURY_MARKETPLACE";
  firstSeenAt: string;
  lastSeenAt: string;
  newness?: SourceNewness;
  sourceCategories?: SourceNativeCategory[];
}

export const PRIMARY_FOOTWEAR_CATEGORIES: PrimaryFootwearCategory[] = [
  "BALLET_FLAT",
  "LOAFER",
  "PUMP",
  "SANDAL",
  "MULE",
  "BOOT",
  "SNEAKER",
  "ESPADRILLE",
  "OXFORD_DERBY",
  "CLOG",
  "UNCLASSIFIED",
];
