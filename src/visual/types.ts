import type { VisualBasicCategoryId, VisualMappedCategoryId } from "./basicCategories";
import type { ColorVariantView } from "../modelFamily/colorVariants";
import type { BrandPriceSegment } from "../brands/brandPriceSegments";

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
  priceSegments?: Partial<Record<BrandPriceSegment, { count: number; verifiedNewCount: number }>>;
}

export interface VisualSummary {
  pageSize?: number;
  generatedAt: string;
  totalCount: number;
  categories: VisualCategoryCount[];
}

/** Rows are in display order. Their array positions locate the full cards. */
export type VisualSearchRow = [brand: string, name: string, segment: BrandPriceSegment | null, isNew: 0 | 1];
export type VisualSearchIndex = { id: VisualBasicCategoryId; rows: VisualSearchRow[] };

export interface VisualShard {
  id: VisualBasicCategoryId;
  cards: VisualCard[];
}
