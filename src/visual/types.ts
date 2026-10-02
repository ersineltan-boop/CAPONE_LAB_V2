import type { VisualBasicCategoryId, VisualMappedCategoryId } from "./basicCategories";
import type { ColorVariantView } from "../modelFamily/colorVariants";

export interface VisualCard {
  modelFamilyId: string;
  brand: string;
  productName: string;
  mainImage: string | null;
  images: string[];
  sourceId: string;
  sourceUrl: string | null;
  basicCategory: VisualMappedCategoryId;
  verifiedNew: boolean;
  verifiedNewAt?: string | null;
  brandId?: string;
  marketplaceId?: string;
  variants?: ColorVariantView[];
}

export interface VisualCategoryCount {
  id: VisualBasicCategoryId;
  label: string;
  count: number;
  verifiedNewCount?: number;
}

export interface VisualSummary {
  generatedAt: string;
  totalCount: number;
  categories: VisualCategoryCount[];
}

export interface VisualShard {
  id: VisualBasicCategoryId;
  cards: VisualCard[];
}
