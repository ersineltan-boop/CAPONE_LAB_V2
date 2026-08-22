import {
  ALL_COUNTRIES_ID,
  buildCountryFilterOptions,
  countryDisplayLabel,
  countryGroupId,
  filterBrandsByCountry,
} from "../brands/countryGrouping";
import type { CatalogBrandSummary, CatalogSummary } from "./types";

export function filterSummaryBrandsByCountry(
  brands: CatalogBrandSummary[],
  countryId: string,
): CatalogBrandSummary[] {
  return filterBrandsByCountry(
    brands.map((brand) => ({ ...brand, country: brand.country })),
    countryId,
  );
}

export function sortSummaryBrands(brands: CatalogBrandSummary[]): CatalogBrandSummary[] {
  return [...brands].sort(
    (a, b) => b.productCount - a.productCount || a.brandName.localeCompare(b.brandName, "tr"),
  );
}

export function brandSummariesForIndex(
  summary: CatalogSummary,
  countryId: string = ALL_COUNTRIES_ID,
): CatalogBrandSummary[] {
  return sortSummaryBrands(filterSummaryBrandsByCountry(summary.brands, countryId));
}

export function countryOptionsFromSummary(summary: CatalogSummary) {
  return buildCountryFilterOptions(summary.brands.map((brand) => ({ country: brand.country })));
}

export function brandCardCountryLabel(brand: CatalogBrandSummary): string {
  return countryDisplayLabel(brand.country);
}

export function brandCardCountryGroup(brand: CatalogBrandSummary): string {
  return countryGroupId(brand.country);
}
