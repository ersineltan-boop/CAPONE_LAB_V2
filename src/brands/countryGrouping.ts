import type { BrandRegistryEntry } from "../registry/types/brand";

export const UNKNOWN_COUNTRY_ID = "unknown";
export const UNKNOWN_COUNTRY_LABEL = "DİĞER / ÜLKE BİLGİSİ YOK";
export const ALL_COUNTRIES_ID = "all";

/** Display-only translations of known registry country strings. Does not invent missing countries. */
const COUNTRY_DISPLAY: Record<string, string> = {
  abd: "ABD",
  usa: "ABD",
  us: "ABD",
  "united states": "ABD",
  "united states of america": "ABD",
  italy: "İtalya",
  italya: "İtalya",
  italia: "İtalya",
  france: "Fransa",
  fransa: "Fransa",
  spain: "İspanya",
  ispanya: "İspanya",
  "united kingdom": "İngiltere",
  uk: "İngiltere",
  england: "İngiltere",
  ingiltere: "İngiltere",
  germany: "Almanya",
  almanya: "Almanya",
  sweden: "İsveç",
  isvec: "İsveç",
  belgium: "Belçika",
  belcika: "Belçika",
  denmark: "Danimarka",
  danimarka: "Danimarka",
  switzerland: "İsviçre",
  isvicre: "İsviçre",
  portugal: "Portekiz",
  portekiz: "Portekiz",
  brazil: "Brezilya",
  brezilya: "Brezilya",
  australia: "Avustralya",
  avustralya: "Avustralya",
  "south korea": "Güney Kore",
  korea: "Güney Kore",
  "guney kore": "Güney Kore",
  "güney kore": "Güney Kore",
};

function foldKey(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replaceAll("ı", "i")
    .replaceAll("İ", "i")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function isMissingCountry(country: string | null | undefined): boolean {
  const trimmed = country?.trim() ?? "";
  if (!trimmed) return true;
  const key = foldKey(trimmed);
  return key === "global" || key === "worldwide" || key === "international";
}

export function countryGroupId(country: string | null | undefined): string {
  if (isMissingCountry(country)) return UNKNOWN_COUNTRY_ID;
  const display = countryDisplayLabel(country);
  return foldKey(display).replace(/[^a-z0-9]+/g, "-");
}

export function countryDisplayLabel(country: string | null | undefined): string {
  if (isMissingCountry(country)) return UNKNOWN_COUNTRY_LABEL;
  const mapped = COUNTRY_DISPLAY[foldKey(country ?? "")];
  if (mapped) return mapped;
  return country!.trim();
}

export interface CountryFilterOption {
  id: string;
  label: string;
  count: number;
}

export function buildCountryFilterOptions(
  brands: Array<Pick<BrandRegistryEntry, "country">>,
): CountryFilterOption[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const brand of brands) {
    const id = countryGroupId(brand.country);
    const label = countryDisplayLabel(brand.country);
    const existing = counts.get(id);
    if (existing) existing.count += 1;
    else counts.set(id, { label, count: 1 });
  }

  const options = [...counts.entries()].map(([id, value]) => ({
    id,
    label: value.label,
    count: value.count,
  }));

  options.sort((a, b) => {
    if (a.id === UNKNOWN_COUNTRY_ID) return 1;
    if (b.id === UNKNOWN_COUNTRY_ID) return -1;
    return b.count - a.count || a.label.localeCompare(b.label, "tr");
  });

  return options;
}

export function filterBrandsByCountry<T extends Pick<BrandRegistryEntry, "country">>(
  brands: T[],
  countryId: string,
): T[] {
  if (!countryId || countryId === ALL_COUNTRIES_ID) return brands;
  return brands.filter((brand) => countryGroupId(brand.country) === countryId);
}
