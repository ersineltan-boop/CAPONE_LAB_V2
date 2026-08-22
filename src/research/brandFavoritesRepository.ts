import type { BrandFavorite, BrandFavoriteStore } from "./brandFavoriteTypes";

export interface BrandFavoriteRepository {
  isSaved(brandId: string): boolean;
  getAll(): BrandFavorite[];
  setSaved(brandId: string, saved: boolean): void;
  subscribe(listener: () => void): () => void;
}

export const BRAND_FAVORITE_STORAGE_KEY = "capone-lab-v2-brand-favorites-v1";

function emptyStore(): BrandFavoriteStore {
  return { version: 1, brands: {}, updatedAt: new Date().toISOString() };
}

function loadStore(): BrandFavoriteStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(BRAND_FAVORITE_STORAGE_KEY);
    if (!raw) return emptyStore();
    return JSON.parse(raw) as BrandFavoriteStore;
  } catch {
    return emptyStore();
  }
}

function saveStore(store: BrandFavoriteStore): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BRAND_FAVORITE_STORAGE_KEY, JSON.stringify(store));
}

export class LocalBrandFavoriteRepository implements BrandFavoriteRepository {
  private store: BrandFavoriteStore;
  private listeners = new Set<() => void>();

  constructor() {
    this.store = loadStore();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private persist(): void {
    this.store.updatedAt = new Date().toISOString();
    saveStore(this.store);
    this.notify();
  }

  isSaved(brandId: string): boolean {
    return Boolean(this.store.brands[brandId]);
  }

  getAll(): BrandFavorite[] {
    return Object.values(this.store.brands).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  setSaved(brandId: string, saved: boolean): void {
    if (saved) {
      this.store.brands[brandId] = { brandId, savedAt: new Date().toISOString() };
    } else {
      delete this.store.brands[brandId];
    }
    this.persist();
  }
}

let singleton: BrandFavoriteRepository | null = null;

export function getBrandFavoriteRepository(): BrandFavoriteRepository {
  if (!singleton) singleton = new LocalBrandFavoriteRepository();
  return singleton;
}

export function resetBrandFavoriteRepositoryForTests(
  seed?: Record<string, BrandFavorite>,
): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(BRAND_FAVORITE_STORAGE_KEY);
  }
  singleton = new LocalBrandFavoriteRepository();
  if (seed) {
    for (const favorite of Object.values(seed)) {
      singleton.setSaved(favorite.brandId, true);
    }
  }
}
