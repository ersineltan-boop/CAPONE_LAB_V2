import type { FootwearCategory } from "../types/pilotProduct";
import type {
  FootwearTaxonomyV1,
  HybridInfluence,
  PrimaryFootwearCategory,
  SourceSighting,
} from "../taxonomy/types";
import type { SourceCategoryRef } from "../source/types";
import type { VisualMappedCategoryId } from "../visual/basicCategories";

export type GroupingConfidence = "HIGH" | "MEDIUM";

export interface ModelFamilyVariant {
  productId: string;
  title: string;
  url: string;
  color: string | null;
  material: string | null;
  images: string[];
  sku?: string;
  styleCode?: string;
  modelCode?: string;
}

export interface ModelFamily {
  modelFamilyId: string;
  brand: string;
  canonicalName: string;
  /** Legacy collector/analysis category — preserved for backward compatibility */
  category: FootwearCategory | null;
  /** Taxonomy V1 primary category (one per family) */
  primaryCategory?: PrimaryFootwearCategory;
  hybridInfluences?: HybridInfluence[];
  taxonomy?: FootwearTaxonomyV1;
  modelFamilyFirstSeenAt?: string;
  sourceSightings?: SourceSighting[];
  representativeProductId: string;
  representativeImage: string | null;
  representativeImages: string[];
  variantCount: number;
  variants: ModelFamilyVariant[];
  allImages: string[];
  sourceProductIds: string[];
  sourceCategoryRefs?: SourceCategoryRef[];
  /** Precomputed Brand/Visual basic category. Not stored in collector JSON. */
  basicCategory?: VisualMappedCategoryId;
  groupingConfidence: GroupingConfidence;
  groupingReason: string;
}

export interface ModelFamilyReport {
  rawProductCount: number;
  modelFamilyCount: number;
  totalVariants: number;
  multiVariantFamilyCount: number;
  reductionPercent: number;
  collapsedVariantProducts: number;
  representativeImageStats: {
    familiesWithMultipleRepresentativeImages: number;
    averageRepresentativeImageCount: number;
    maxRepresentativeImageCount: number;
  };
  largestVariantFamilies: Array<{
    modelFamilyId: string;
    brand: string;
    canonicalName: string;
    variantCount: number;
  }>;
  mediumConfidenceGroups: Array<{
    modelFamilyId: string;
    brand: string;
    canonicalName: string;
    variantCount: number;
    groupingReason: string;
  }>;
}

export interface RawAnalyzedProductVariant {
  title?: string;
  color?: string | null;
  sku?: string;
  imageUrl?: string | null;
  images?: string[];
}

export interface RawAnalyzedProduct {
  sourceModelCode?: string;
  source: string;
  brand: string;
  productName: string;
  productUrl: string;
  imageUrl: string | null;
  images?: string[];
  category: FootwearCategory | null;
  color: string | null;
  material: string | null;
  discoveredAt: string;
  collectionPath?: string | null;
  collectionLabel?: string | null;
  sourceCategoryId?: string | null;
  sourceCategoryName?: string | null;
  sourceCategoryPath?: string | null;
  sourceCategoryUrl?: string | null;
  sourceCategories?: Array<{
    categoryId: string;
    categoryName: string;
    categoryPath?: string | null;
    categoryUrl?: string | null;
  }>;
  isNewArrivalsCollection?: boolean;
  hasNewBadge?: boolean;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  variants?: RawAnalyzedProductVariant[];
  cleaned: { heelHeight: string | null; color: string | null };
  normalized: {
    category: FootwearCategory | null;
    colorFamily: string;
    materialFamily: string;
    heelType: string;
    heelHeightGroup: string;
    toeShape: string;
    details: string[];
    construction: string[];
  };
}
