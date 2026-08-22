import type { TrendSourceConfig } from "../engine/types";

export const BRAND_COUNTRY: Record<string, string> = {
  SCHUTZ: "Brezilya",
  AREZZO: "Brezilya",
  "TONY BIANCO": "Avustralya",
  "ALIAS MAE": "Avustralya",
  "A.EMERY": "Avustralya",
  "ST. AGNI": "Avustralya",
  ALOHAS: "İspanya",
  "DEAR FRANCES": "İngiltere",
  "LE MONDE BERYL": "İngiltere",
  MIISTA: "İspanya",
  LARROUDE: "ABD",
  "DOLCE VITA": "ABD",
  "JEFFREY CAMPBELL": "ABD",
  "STEVE MADDEN": "ABD",
};

export function brandCountry(brand: string): string {
  return BRAND_COUNTRY[brand] ?? "Global";
}

export function brandSourceId(brand: string): string {
  return brand.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function buildMultibrandSourceRegistry(
  brands: string[],
): Map<string, TrendSourceConfig> {
  const registry = new Map<string, TrendSourceConfig>();

  for (const brand of brands) {
    const id = brandSourceId(brand);
    registry.set(id, {
      id,
      brand,
      country: brandCountry(brand),
      segment: "Premium",
      sourceType: "Marka vitrin",
      sourceUrl: null,
      weight: 0.75,
      isActive: true,
      role: "RETAIL",
    });
  }

  return registry;
}
