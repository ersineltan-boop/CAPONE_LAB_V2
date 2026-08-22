export type SourceKind = "BRAND_OFFICIAL" | "LUXURY_MARKETPLACE";

export type SourceCoverageStatus = "FULL" | "PARTIAL" | "FAILED" | "NEEDS_PROBE";

export interface SourceNativeCategory {
  categoryId: string;
  categoryName: string;
  categoryPath?: string | null;
  categoryUrl?: string | null;
}

export interface SourceCategoryRef extends SourceNativeCategory {
  sourceId: string;
}
