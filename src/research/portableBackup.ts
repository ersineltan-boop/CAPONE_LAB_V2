import type { BrandFavorite } from "./brandFavoriteTypes";
import type { BrandFavoriteRepository } from "./brandFavoritesRepository";
import type { ResearchStateRepository } from "./researchStateRepository";
import type { ModelFamilyResearchState } from "./types";

const MAX_BYTES = 5_000_000;
const MAX_ITEMS = 50_000;

export interface PortableBackup {
  format: "capone-research-backup";
  version: 1;
  createdAt: string;
  products: ModelFamilyResearchState[];
  brands: BrandFavorite[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function id(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 500 &&
    !["__proto__", "constructor", "prototype"].includes(value);
}

function dateOrNull(value: unknown): value is string | null {
  return value === null ||
    (typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value)));
}

export function createPortableBackup(
  research: ResearchStateRepository,
  favorites: BrandFavoriteRepository,
): string {
  const backup: PortableBackup = {
    format: "capone-research-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    products: [...research.getAll().values()]
      .filter((state) => state.savedAt || state.reviewedAt || state.note)
      .map(({ modelFamilyId, savedAt, reviewedAt, note }) => ({
        modelFamilyId, savedAt, reviewedAt, note,
      })),
    brands: favorites.getAll().map(({ brandId, savedAt }) => ({ brandId, savedAt })),
  };
  return JSON.stringify(backup, null, 2);
}

export function parsePortableBackup(text: string): PortableBackup {
  if (new TextEncoder().encode(text).length > MAX_BYTES) {
    throw new Error("Dosya çok büyük (en fazla 5 MB).");
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Geçerli bir JSON yedek dosyası seçin.");
  }
  if (!record(value) || value.format !== "capone-research-backup" || value.version !== 1 ||
      typeof value.createdAt !== "string" || !dateOrNull(value.createdAt) ||
      !Array.isArray(value.products) || !Array.isArray(value.brands) ||
      value.products.length > MAX_ITEMS || value.brands.length > MAX_ITEMS) {
    throw new Error("Bu dosya CAPONE kayıt yedeği değil veya sürümü desteklenmiyor.");
  }
  const products: ModelFamilyResearchState[] = [];
  const brands: BrandFavorite[] = [];
  const productIds = new Set<string>();
  const brandIds = new Set<string>();
  for (const item of value.products) {
    if (!record(item) || !id(item.modelFamilyId) || productIds.has(item.modelFamilyId) ||
        !dateOrNull(item.savedAt) || !dateOrNull(item.reviewedAt) ||
        !(item.note === null || (typeof item.note === "string" && item.note.length <= 20_000))) {
      throw new Error("Yedekte geçersiz ürün kaydı var; hiçbir kayıt aktarılmadı.");
    }
    productIds.add(item.modelFamilyId);
    products.push({
      modelFamilyId: item.modelFamilyId,
      savedAt: item.savedAt,
      reviewedAt: item.reviewedAt,
      note: item.note,
    });
  }
  for (const item of value.brands) {
    if (!record(item) || !id(item.brandId) || brandIds.has(item.brandId) ||
        typeof item.savedAt !== "string" || !dateOrNull(item.savedAt)) {
      throw new Error("Yedekte geçersiz marka kaydı var; hiçbir kayıt aktarılmadı.");
    }
    brandIds.add(item.brandId);
    brands.push({ brandId: item.brandId, savedAt: item.savedAt });
  }
  return { format: "capone-research-backup", version: 1, createdAt: value.createdAt, products, brands };
}

export function importPortableBackup(
  backup: PortableBackup,
  research: ResearchStateRepository,
  favorites: BrandFavoriteRepository,
): { products: number; brands: number; keptLocalNotes: number } {
  const keptLocalNotes = backup.products.filter((item) => {
    const local = research.get(item.modelFamilyId).note;
    return Boolean(local && item.note && local !== item.note);
  }).length;
  const products = research.mergeImported(backup.products);
  const brands = favorites.mergeImported(backup.brands);
  return { products, brands, keptLocalNotes };
}
