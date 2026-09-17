import { useCallback, useEffect, useState } from "react";

import { subscribeSession } from "../auth/session";
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
    const sync = () => setFavorites(repo.getAll());
    sync();
    const unsubRepo = repo.subscribe(sync);
    const unsubSession = subscribeSession(sync);
    return () => {
      unsubRepo();
      unsubSession();
    };
  }, [repo]);

  const savedIds = new Set(favorites.map((item) => item.brandId));
  const isSaved = useCallback((brandId: string) => savedIds.has(brandId), [savedIds]);
  const setSaved = useCallback(
    (brandId: string, saved: boolean) => repo.setSaved(brandId, saved),
    [repo],
  );

  return { savedIds, favorites, isSaved, setSaved };
}

export function useVisibleBrandFavorites(): {
  savedIds: Set<string>;
  favorites: BrandFavorite[];
  isSaved: (brandId: string) => boolean;
  setSaved: (brandId: string, saved: boolean) => void;
} {
  const repo = getBrandFavoriteRepository();
  const [favorites, setFavorites] = useState(() => repo.listVisible());

  useEffect(() => {
    const sync = () => setFavorites(repo.listVisible());
    sync();
    const unsubRepo = repo.subscribe(sync);
    const unsubSession = subscribeSession(sync);
    return () => {
      unsubRepo();
      unsubSession();
    };
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
