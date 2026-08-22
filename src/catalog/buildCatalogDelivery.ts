import type { ModelFamily } from "../modelFamily/types";
import type { BrandRegistryEntry } from "../registry/types/brand";
import type { MarketplaceRegistryEntry } from "../registry/data/marketplaces";
import { selectBrandCardImages } from "../brands/brandCardImages";
import {
  countVerifiedNewForSource,
  extractMarketplaceBrands,
  extractSourceCategories,
  filterFamiliesForBrandOfficial,
  filterFamiliesForMarketplaceSource,
  slugifyBrandId,
} from "../source/sourceProductQuery";
import { slimFamilyForDelivery } from "./slimFamily";
import type {
  CatalogIdIndex,
  CatalogShard,
  CatalogSummary,
  FamilyLocator,
} from "./types";
import { MAX_BRAND_CARD_IMAGES } from "./types";

export interface CatalogDeliveryInput {
  families: ModelFamily[];
  brands: Array<Pick<BrandRegistryEntry, "id" | "brand" | "country" | "isActive">>;
  marketplaces: Array<Pick<MarketplaceRegistryEntry, "id" | "name" | "isActive">>;
  generatedAt?: string;
}

export interface CatalogDeliveryArtifacts {
  summary: CatalogSummary;
  brandShards: CatalogShard[];
  marketplaceShards: CatalogShard[];
  idIndex: CatalogIdIndex;
}

export function buildCatalogDelivery(input: CatalogDeliveryInput): CatalogDeliveryArtifacts {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const activeBrands = input.brands.filter((entry) => entry.isActive);
  const marketplaceIds = new Set(input.marketplaces.map((entry) => entry.id));

  const brandShards: CatalogShard[] = activeBrands.map((entry) => {
    const families = filterFamiliesForBrandOfficial(input.families, entry.brand).map(
      slimFamilyForDelivery,
    );
    return { id: entry.id, kind: "brand", families };
  });

  const marketplaceShards: CatalogShard[] = input.marketplaces
    .filter((entry) => entry.isActive)
    .map((entry) => {
      const families = filterFamiliesForMarketplaceSource(input.families, entry.id).map(
        slimFamilyForDelivery,
      );
      return { id: entry.id, kind: "marketplace", families };
    });

  const summary: CatalogSummary = {
    generatedAt,
    brands: activeBrands.map((entry) => {
      const shard = brandShards.find((item) => item.id === entry.id)!;
      return {
        brandId: entry.id,
        brandName: entry.brand,
        country: entry.country,
        productCount: shard.families.length,
        verifiedNewCount: countVerifiedNewForSource(shard.families, slugifyBrandId(entry.brand)),
        images: selectBrandCardImages(shard.families, MAX_BRAND_CARD_IMAGES),
      };
    }),
    marketplaces: marketplaceShards.map((shard) => {
      const entry = input.marketplaces.find((item) => item.id === shard.id)!;
      return {
        sourceId: shard.id,
        name: entry.name,
        productCount: shard.families.length,
        brandCount: extractMarketplaceBrands(shard.families, shard.id).length,
        categoryCount: extractSourceCategories(shard.families, shard.id).length,
        verifiedNewCount: countVerifiedNewForSource(shard.families, shard.id),
        images: selectBrandCardImages(shard.families, MAX_BRAND_CARD_IMAGES),
      };
    }),
  };

  const families: Record<string, FamilyLocator> = {};
  for (const shard of brandShards) {
    for (const family of shard.families) {
      families[family.modelFamilyId] = {
        ...families[family.modelFamilyId],
        brandId: shard.id,
      };
    }
  }
  for (const shard of marketplaceShards) {
    for (const family of shard.families) {
      families[family.modelFamilyId] = {
        ...families[family.modelFamilyId],
        marketplaceId: shard.id,
      };
    }
  }
  for (const family of input.families) {
    if (families[family.modelFamilyId]) continue;
    const marketplaceId = family.sourceSightings?.find((sighting) =>
      marketplaceIds.has(sighting.sourceId),
    )?.sourceId;
    if (marketplaceId) {
      families[family.modelFamilyId] = { marketplaceId };
    }
  }

  return {
    summary,
    brandShards,
    marketplaceShards,
    idIndex: { generatedAt, families },
  };
}
