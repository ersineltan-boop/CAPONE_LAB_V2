import type { ModelFamily } from "../modelFamily/types";

export interface CatalogBrandSummary {
  brandId: string;
  brandName: string;
  country: string;
  productCount: number;
  verifiedNewCount: number;
  images: string[];
}

export interface CatalogMarketplaceSummary {
  sourceId: string;
  name: string;
  productCount: number;
  brandCount: number;
  categoryCount: number;
  verifiedNewCount: number;
  images: string[];
}

export interface CatalogSummary {
  generatedAt: string;
  brands: CatalogBrandSummary[];
  marketplaces: CatalogMarketplaceSummary[];
}

export interface CatalogShard {
  id: string;
  kind: "brand" | "marketplace";
  families: ModelFamily[];
}

export interface FamilyLocator {
  brandId?: string;
  marketplaceId?: string;
}

export interface CatalogIdIndex {
  generatedAt: string;
  families: Record<string, FamilyLocator>;
}

export const CATALOG_PUBLIC_BASE = "/data/catalog";
export const VISUAL_PUBLIC_BASE = "/data/catalog/visual";
export const MAX_BRAND_CARD_IMAGES = 1;
export const MAX_DELIVERY_IMAGES = 24;
export const MAX_VISUAL_CARD_IMAGES = 8;
export const MAX_VARIANT_IMAGES = 8;
export const BRAND_DETAIL_BATCH = 48;
export const VISUAL_DETAIL_BATCH = 48;
