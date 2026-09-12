import { liveProductResearchBrandIds } from "../../operator/policies/domains";
import { usableMarketResearchImages } from "../images";
import type {
  MarketResearchBrand,
  MarketResearchBrandCard,
  MarketResearchCountryCatalog,
  MarketResearchCountrySummary,
  MarketResearchModel,
} from "../types";
import { ROMANIA_MARKET_ID, ROMANIA_MARKET_LABEL, isRomaniaVisibleBrandId } from "./scope";
import { ROMANIA_MARKET_RESEARCH_CATALOG } from "./snapshot";

export function sanitizeBrand(brand: MarketResearchBrand): MarketResearchBrand {
  return {
    ...brand,
    models: brand.models.map((model) => ({
      ...model,
      variants: model.variants.map((variant) => ({
        ...variant,
        images: usableMarketResearchImages(variant.images),
      })),
    })),
  };
}

export function visibleRomaniaBrands(
  catalog: MarketResearchCountryCatalog = ROMANIA_MARKET_RESEARCH_CATALOG,
): MarketResearchBrand[] {
  return catalog.brands
    .filter((brand) => brand.availability === "visible")
    .filter((brand) => isRomaniaVisibleBrandId(brand.id))
    .filter((brand) => brand.entityKind === "brand")
    .map(sanitizeBrand);
}

export function romaniaCountrySummary(
  catalog: MarketResearchCountryCatalog = ROMANIA_MARKET_RESEARCH_CATALOG,
): MarketResearchCountrySummary {
  const brands = visibleRomaniaBrands(catalog);
  return {
    id: ROMANIA_MARKET_ID,
    label: ROMANIA_MARKET_LABEL,
    salesMarket: catalog.salesMarket,
    observedAt: catalog.observedAt,
    snapshotNote: catalog.snapshotNote,
    brandCount: brands.length,
  };
}

function modelImages(model: MarketResearchModel): string[] {
  return usableMarketResearchImages(model.variants.flatMap((variant) => variant.images));
}

export function brandCardFromBrand(
  brand: MarketResearchBrand,
  salesMarketLabel: string,
): MarketResearchBrandCard {
  return {
    id: brand.id,
    name: brand.name,
    originCountry: brand.originCountry,
    originCountryLabel: brand.originCountryLabel,
    salesMarket: brand.salesMarket,
    salesMarketLabel,
    soldInSalesMarket: brand.soldInSalesMarket,
    sourceLinks: brand.sourceLinks,
    modelCount: brand.models.length,
    images: usableMarketResearchImages(brand.models.flatMap(modelImages)),
  };
}

export function romaniaBrandCards(
  catalog: MarketResearchCountryCatalog = ROMANIA_MARKET_RESEARCH_CATALOG,
): MarketResearchBrandCard[] {
  return visibleRomaniaBrands(catalog).map((brand) =>
    brandCardFromBrand(brand, catalog.salesMarketLabel),
  );
}

export function findRomaniaBrand(
  brandId: string,
  catalog: MarketResearchCountryCatalog = ROMANIA_MARKET_RESEARCH_CATALOG,
): MarketResearchBrand | null {
  return visibleRomaniaBrands(catalog).find((brand) => brand.id === brandId) ?? null;
}

export function romaniaRetailerIds(
  catalog: MarketResearchCountryCatalog = ROMANIA_MARKET_RESEARCH_CATALOG,
): string[] {
  return catalog.retailers.filter((entry) => entry.showAsBrandCard === false).map((entry) => entry.id);
}

export function romaniaExcludedNames(
  catalog: MarketResearchCountryCatalog = ROMANIA_MARKET_RESEARCH_CATALOG,
): string[] {
  return catalog.excluded.map((entry) => entry.name);
}

export function assertNoProductResearchLeak(
  catalog: MarketResearchCountryCatalog = ROMANIA_MARKET_RESEARCH_CATALOG,
): void {
  const productIds = new Set(liveProductResearchBrandIds());
  for (const brand of catalog.brands) {
    if (productIds.has(brand.id)) {
      throw new Error(`Market Research brand id leaked into Product Research: ${brand.id}`);
    }
  }
}

export function getRomaniaCatalog(): MarketResearchCountryCatalog {
  return ROMANIA_MARKET_RESEARCH_CATALOG;
}
