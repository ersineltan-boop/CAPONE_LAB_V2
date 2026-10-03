import { filterVisibleRecords } from "../auth/permissions";
import { OWNER_USER } from "../auth/roles";
import { getSession } from "../auth/session";
import type { BrandFavorite, BrandFavoriteStore, BrandFavoriteStoreV1 } from "./brandFavoriteTypes";

export interface BrandFavoriteRepository {
  isSaved(brandId: string): boolean;
  getAll(): BrandFavorite[];
  listVisible(): BrandFavorite[];
  listAllRecords(): BrandFavorite[];
  setSaved(brandId: string, saved: boolean): void;
  subscribe(listener: () => void): () => void;
}

export const BRAND_FAVORITE_STORAGE_KEY = "capone-lab-v2-brand-favorites-v1";

function recordKey(ownerUserId: string, brandId: string): string {
  return `${ownerUserId}::${brandId}`;
}

function currentUserId(): string {
  return getSession().user.id;
}

function emptyStore(): BrandFavoriteStore {
  return { version: 2, records: {}, updatedAt: new Date().toISOString() };
}

function migrateStore(raw: unknown): BrandFavoriteStore {
  if (!raw || typeof raw !== "object") return emptyStore();
  const data = raw as Partial<BrandFavoriteStore> & Partial<BrandFavoriteStoreV1>;
  if (data.version === 2 && data.records) {
    const records: Record<string, BrandFavorite> = {};
    for (const [key, favorite] of Object.entries(data.records)) {
      const ownerUserId = favorite.ownerUserId ?? favorite.userId ?? OWNER_USER.id;
      const createdAt = favorite.createdAt ?? favorite.savedAt ?? data.updatedAt ?? new Date().toISOString();
      records[key] = {
        ...favorite,
        userId: ownerUserId,
        ownerUserId,
        createdAt,
      };
    }
    return {
      version: 2,
      records,
      updatedAt: data.updatedAt ?? new Date().toISOString(),
    };
  }
  if (data.version === 1 && data.brands) {
    const records: Record<string, BrandFavorite> = {};
    for (const [brandId, favorite] of Object.entries(data.brands)) {
      records[recordKey(OWNER_USER.id, brandId)] = {
        ...favorite,
        userId: OWNER_USER.id,
        ownerUserId: OWNER_USER.id,
        createdAt: favorite.savedAt,
      };
    }
    return { version: 2, records, updatedAt: data.updatedAt ?? new Date().toISOString() };
  }
  return emptyStore();
}

function loadStore(): BrandFavoriteStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(BRAND_FAVORITE_STORAGE_KEY);
    if (!raw) return emptyStore();
    return migrateStore(JSON.parse(raw));
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
    return Boolean(this.store.records[recordKey(currentUserId(), brandId)]);
  }

  getAll(): BrandFavorite[] {
    return Object.values(this.store.records)
      .filter((item) => item.ownerUserId === currentUserId())
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  listAllRecords(): BrandFavorite[] {
    return Object.values(this.store.records);
  }

  listVisible(): BrandFavorite[] {
    return filterVisibleRecords(this.listAllRecords(), getSession().user).sort((a, b) =>
      b.savedAt.localeCompare(a.savedAt),
    );
  }

  setSaved(brandId: string, saved: boolean): void {
    const ownerUserId = currentUserId();
    const key = recordKey(ownerUserId, brandId);
    if (saved) {
      const createdAt = new Date().toISOString();
      this.store.records[key] = {
        brandId,
        userId: ownerUserId,
        ownerUserId,
        createdAt,
        savedAt: createdAt,
      };
    } else {
      delete this.store.records[key];
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
