export interface BrandFavorite {
  brandId: string;
  savedAt: string;
}

export interface BrandFavoriteStore {
  version: 1;
  brands: Record<string, BrandFavorite>;
  updatedAt: string;
}
