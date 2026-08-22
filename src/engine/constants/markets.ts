/** Çin trend pazarı olarak kullanılmaz — yalnızca üretim/kopyalanma sinyali */
export const PRODUCTION_SIGNAL_COUNTRY = "Çin";

const PRODUCTION_SIGNAL_ALIASES = new Set([
  PRODUCTION_SIGNAL_COUNTRY,
  "CN",
  "China",
  "中国",
]);

export function isProductionSignalCountry(country: string): boolean {
  return PRODUCTION_SIGNAL_ALIASES.has(country.trim());
}

/** Trend pazarı doğrulamasına dahil edilebilir ülke mi? */
export function isTrendMarketCountry(country: string): boolean {
  return !isProductionSignalCountry(country);
}
