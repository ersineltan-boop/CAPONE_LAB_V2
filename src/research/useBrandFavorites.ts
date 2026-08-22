import { useCallback, useEffect, useState } from "react";

import {
  getBrandFavoriteRepository,
  type BrandFavoriteRepository,
} from "./brandFavoritesRepository";
import type { BrandFavorite } from "./brandFavoriteTypes";

export function useBrandFavorites(): {
  savedIds: Set<string>;
  favorites: BrandFavorite[];
  isSaved: (brandId: string) => boolean;
  setSaved: (brandId: string, saved: boolean) => void;
} {
  const repo = getBrandFavoriteRepository();
  const [favorites, setFavorites] = useState(() => repo.getAll());

  useEffect(() => {
    setFavorites(repo.getAll());
    return repo.subscribe(() => setFavorites(repo.getAll()));
  }, [repo]);

  const savedIds = new Set(favorites.map((item) => item.brandId));
  const isSaved = useCallback((brandId: string) => savedIds.has(brandId), [savedIds]);
  const setSaved = useCallback(
    (brandId: string, saved: boolean) => repo.setSaved(brandId, saved),
    [repo],
  );

  return { savedIds, favorites, isSaved, setSaved };
}

export function useBrandFavoriteRepository(): BrandFavoriteRepository {
  return getBrandFavoriteRepository();
}
