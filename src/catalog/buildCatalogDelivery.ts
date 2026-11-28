import type { ModelFamily } from "../modelFamily/types";
import type { SourceSighting } from "../taxonomy/types";
import type { BrandRegistryEntry } from "../registry/types/brand";
import type { MarketplaceRegistryEntry } from "../registry/data/marketplaces";
import { selectBrandCardImages } from "../brands/brandCardImages";
import {
  countVerifiedNewForSource,
  extractMarketplaceBrands,
  filterFamiliesForBrandOfficial,
  filterFamiliesForMarketplaceSource,
  isOfficialChannelSighting,
  slugifyBrandId,
} from "../source/sourceProductQuery";
import { slimFamilyForDelivery } from "./slimFamily";
import { normalizeMarketplaceSourceId } from "../marketplaces/marketplacePolicy";
import type {
  BrandUpdateEvidence,
  CatalogIdIndex,
  CatalogShard,
  CatalogSourceFreshness,
  CatalogSummary,
  FamilyLocator,
} from "./types";
import { MAX_BRAND_CARD_IMAGES } from "./types";
import { countFamiliesByBasicCategory } from "../visual/basicCategories";

export interface CatalogDeliveryInput {
  families: ModelFamily[];
  brands: Array<Pick<BrandRegistryEntry, "id" | "brand" | "country" | "isActive">>;
  marketplaces: Array<Pick<MarketplaceRegistryEntry, "id" | "name" | "isActive">>;
  brandUpdates?: ReadonlyMap<string, BrandUpdateEvidence>;
  marketplaceCoverage?: ReadonlyMap<string, NonNullable<CatalogShard["coverage"]>>;
  generatedAt?: string;
}

export interface CatalogDeliveryArtifacts {
  summary: CatalogSummary;
  brandShards: CatalogShard[];
  marketplaceShards: CatalogShard[];
  idIndex: CatalogIdIndex;
}

function latestProductCheckAt(
  families: readonly ModelFamily[],
  matchesSource: (family: ModelFamily, sighting: SourceSighting) => boolean,
): string | undefined {
  let latestCheckAt: string | undefined;
  let latestCheck = -Infinity;
  for (const family of families) {
    for (const sighting of family.sourceSightings ?? []) {
      const checked = Date.parse(sighting.lastSeenAt);
      if (checked > latestCheck && matchesSource(family, sighting)) {
        latestCheckAt = sighting.lastSeenAt;
        latestCheck = checked;
      }
    }
  }
  return latestCheckAt;
}

function resolveBrandFreshness(
  families: readonly ModelFamily[],
  evidence: BrandUpdateEvidence | undefined,
): CatalogSourceFreshness | undefined {
  const latestCheckAt = latestProductCheckAt(families, isOfficialChannelSighting);
  const coverageDate = evidence?.coverage?.lastVerifiedAt;
  const archiveDate = evidence?.verifiedAt;
  // A last-good collector export must be backed by evidence in the shipped catalog.
  const archiveTime = Date.parse(archiveDate ?? "");
  const coverageTime = Date.parse(coverageDate ?? "");
  const verifiedAt = archiveDate && archiveTime <= Date.parse(latestCheckAt ?? "") &&
    (!Number.isFinite(coverageTime) || archiveTime > coverageTime)
    ? archiveDate
    : coverageDate;

  if (verifiedAt && Number.isFinite(Date.parse(verifiedAt))) {
    return { kind: "verified-update", at: verifiedAt };
  }
  if (latestCheckAt) return { kind: "official-product-check", at: latestCheckAt };
}

function resolveMarketplaceFreshness(
  sourceId: string,
  families: readonly ModelFamily[],
  coverage: CatalogShard["coverage"],
): CatalogSourceFreshness | undefined {
  const verifiedAt = coverage?.lastVerifiedAt;
  if (verifiedAt && Number.isFinite(Date.parse(verifiedAt))) {
    return { kind: "verified-update", at: verifiedAt };
  }
  const canonicalId = normalizeMarketplaceSourceId(sourceId);
  const lastCheckAt = latestProductCheckAt(families, (_family, sighting) =>
    sighting.sourceKind !== "BRAND_OFFICIAL" &&
    normalizeMarketplaceSourceId(sighting.sourceId) === canonicalId,
  );
  if (lastCheckAt) return { kind: "official-product-check", at: lastCheckAt };
}

export function buildCatalogDelivery(input: CatalogDeliveryInput): CatalogDeliveryArtifacts {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const activeBrands = input.brands.filter((entry) => entry.isActive);
  const marketplaceIds = new Set(input.marketplaces.map((entry) => entry.id));

  const brandShards: CatalogShard[] = activeBrands.map((entry) => {
    const evidence = input.brandUpdates?.get(entry.id);
    const families = filterFamiliesForBrandOfficial(input.families, entry.brand).map(
      slimFamilyForDelivery,
    );
    return {
      id: entry.id,
      kind: "brand",
      families,
      coverage: evidence?.coverage,
      brandFreshness: resolveBrandFreshness(families, evidence),
    };
  });

  const marketplaceShards: CatalogShard[] = input.marketplaces
    .filter((entry) => entry.isActive)
    .map((entry) => {
      const coverage = input.marketplaceCoverage?.get(entry.id);
      const families = filterFamiliesForMarketplaceSource(input.families, entry.id).map(
        slimFamilyForDelivery,
      );
      return {
        id: entry.id,
        kind: "marketplace",
        families,
        coverage,
        marketplaceFreshness: resolveMarketplaceFreshness(entry.id, families, coverage),
      };
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
        categoryCount: countFamiliesByBasicCategory(shard.families).filter(
          (item) => item.id !== "tumu" && item.count > 0,
        ).length,
        verifiedNewCount: countVerifiedNewForSource(shard.families, shard.id),
        images: selectBrandCardImages(shard.families, MAX_BRAND_CARD_IMAGES),
        marketplaceFreshness: shard.marketplaceFreshness,
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
