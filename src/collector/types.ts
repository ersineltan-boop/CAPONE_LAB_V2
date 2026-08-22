export type FootwearCategory =
  | "BOOT"
  | "ANKLE_BOOT"
  | "PUMP"
  | "SLINGBACK"
  | "BALLERINA"
  | "MARY_JANE"
  | "LOAFER"
  | "MULE"
  | "SANDAL"
  | "THONG"
  | "WEDGE"
  | "SNEAKER"
  | "OTHER_FOOTWEAR";

export interface PilotProductVariant {
  title: string;
  color: string | null;
  sku: string | null;
}

export interface PilotProduct {
  source: string;
  brand: string;
  productName: string;
  productUrl: string;
  imageUrl: string | null;
  images?: string[];
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
  variants: PilotProductVariant[];
}

export interface SourceCollectionReport {
  source: string;
  status: "success" | "partial" | "failed";
  method?: string;
  discoveredProductLinks: number;
  parsedProducts: number;
  productsWithImages: number;
  productsWithMaterial: number;
  errors: string[];
  pagesTraversed?: number;
  rawProductUrlsDiscovered?: number;
  duplicateCount?: number;
  sourceReportedProductCount?: number | null;
  footwearRoots?: string[];
  sourceCategoriesCollected?: string[];
  paginationExhausted?: boolean;
  hitLegacyCap?: boolean;
}

export type CollectionMethod =
  | "shopify"
  | "schema-org"
  | "html-listing"
  | "generic-html"
  | "pilot-cache"
  | "custom-adapter"
  | "none";

export interface CollectionReport {
  runStartedAt: string;
  runFinishedAt: string;
  totalProducts: number;
  sources: SourceCollectionReport[];
  failedBrands?: string[];
  successfulBrands?: string[];
}

export interface PilotSourceConfig {
  id: string;
  brand: string;
  baseUrl: string;
  collectionPaths: string[];
  verifiedFootwearPaths?: string[];
  maxProducts: number;
  backfillLimit?: number;
  collectMode?: "legacy" | "backfill" | "incremental" | "full";
}