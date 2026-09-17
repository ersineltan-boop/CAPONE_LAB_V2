export interface BrandFavorite {
  brandId: string;
  ownerUserId: string;
  savedAt: string;
}

export interface BrandFavoriteStoreV1 {
  version: 1;
  brands: Record<string, Omit<BrandFavorite, "ownerUserId">>;
  updatedAt: string;
}

export interface BrandFavoriteStore {
  version: 2;
  records: Record<string, BrandFavorite>;
  updatedAt: string;
}
