export interface BrandFavorite {
  brandId: string;
  userId: string;
  ownerUserId: string;
  createdAt: string;
  savedAt: string;
}

export interface BrandFavoriteStoreV1 {
  version: 1;
  brands: Record<string, Omit<BrandFavorite, "userId" | "ownerUserId" | "createdAt">>;
  updatedAt: string;
}

export interface BrandFavoriteStore {
  version: 2;
  records: Record<string, BrandFavorite>;
  updatedAt: string;
}
