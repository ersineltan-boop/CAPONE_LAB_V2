import { liveProductResearchBrandIds } from "../../operator/policies/domains";
import { usableMarketResearchImages } from "../images";
import type {
  MarketResearchBrand,
  MarketResearchBrandCard,
  MarketResearchCountryCatalog,
  MarketResearchCountrySummary,
  MarketResearchModel,
  MarketResearchVariant,
  MarketResearchVisualStatus,
} from "../types";
import {
  ROMANIA_BRAND_VISUAL_FAILURES,
  ROMANIA_OBSERVED_VARIANT_IMAGES,
  ROMANIA_VARIANT_VISUAL_FAILURES,
} from "./observedImages";
import { ROMANIA_MARKET_ID, ROMANIA_MARKET_LABEL, isRomaniaVisibleBrandId } from "./scope";
import { ROMANIA_MARKET_RESEARCH_CATALOG } from "./snapshot";

function resolveVariantVisual(variant: MarketResearchVariant): MarketResearchVariant {
  const observed = ROMANIA_OBSERVED_VARIANT_IMAGES[variant.id];
  const failure = ROMANIA_VARIANT_VISUAL_FAILURES[variant.id];
  const images = usableMarketResearchImages(observed?.images ?? variant.images);
  const visualStatus: MarketResearchVisualStatus = images.length
    ? "has_images"
    : (failure?.status ?? "model_unavailable");
  return {
    ...variant,
    productUrl: observed?.productUrl ?? variant.productUrl,
    color: observed?.color ?? variant.color,
    images,
    visualStatus,
    visualNote: images.length ? undefined : failure?.reason,
  };
}

export function sanitizeBrand(brand: MarketResearchBrand): MarketResearchBrand {
  const models = brand.models.map((model) => ({
    ...model,
    variants: model.variants.map(resolveVariantVisual),
  }));
  const images = usableMarketResearchImages(
    models.flatMap((model) => model.variants.flatMap((variant) => variant.images)),
  );
  const brandFailure = ROMANIA_BRAND_VISUAL_FAILURES[brand.id];
  const visualStatus: MarketResearchVisualStatus = images.length
    ? "has_images"
    : brandFailure?.status ?? (models.length === 0 ? "no_models" : "model_unavailable");
  return {
    ...brand,
    models,
    visualStatus,
    visualNote: images.length ? undefined : brandFailure?.reason,
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
    visualStatus: brand.visualStatus ?? (brand.models.length === 0 ? "no_models" : "model_unavailable"),
    visualNote: brand.visualNote,
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

export function romaniaImageCoverage(
  catalog: MarketResearchCountryCatalog = ROMANIA_MARKET_RESEARCH_CATALOG,
): Array<{
  brandId: string;
  brandName: string;
  visualStatus: MarketResearchVisualStatus;
  modelsWithImages: number;
  modelsMissingImages: number;
  variantsWithGallery: number;
  note?: string;
}> {
  return visibleRomaniaBrands(catalog).map((brand) => {
    const modelsWithImages = brand.models.filter((model) =>
      model.variants.some((variant) => variant.images.length > 0),
    ).length;
    const variantsWithGallery = brand.models.flatMap((model) => model.variants).filter(
      (variant) => variant.images.length > 1,
    ).length;
    return {
      brandId: brand.id,
      brandName: brand.name,
      visualStatus: brand.visualStatus ?? "model_unavailable",
      modelsWithImages,
      modelsMissingImages: brand.models.length - modelsWithImages,
      variantsWithGallery,
      note: brand.visualNote,
    };
  });
}

export function getRomaniaCatalog(): MarketResearchCountryCatalog {
  return {
    ...ROMANIA_MARKET_RESEARCH_CATALOG,
    brands: ROMANIA_MARKET_RESEARCH_CATALOG.brands.map((brand) =>
      isRomaniaVisibleBrandId(brand.id) ? sanitizeBrand(brand) : brand,
    ),
  };
}
