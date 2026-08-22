import type { ModelFamily } from "../modelFamily/types";
import { loadBrandRegistry } from "../registry/data/index";
import type { MarketplaceRegistryEntry } from "../registry/data/marketplaces";
import { loadMarketplaceRegistry } from "../registry/data/marketplaces";
import type { SourceCoverageStatus } from "./types";
import { slugifyBrandId, countVerifiedNewForSource } from "./sourceProductQuery";
import {
  extractSourceCategories,
  filterFamiliesForBrandOfficial,
  filterFamiliesForMarketplaceSource,
} from "./sourceProductQuery";
import {
  coverageDiscrepancyWarning,
  resolveCoverageStatus,
} from "./coverageStatus";

export interface CollectionReportLike {
  sources?: Array<{
    source: string;
    status: string;
    parsedProducts: number;
    errors: string[];
    pagesTraversed?: number;
    rawProductUrlsDiscovered?: number;
    duplicateCount?: number;
    sourceReportedProductCount?: number | null;
    footwearRoots?: string[];
    sourceCategoriesCollected?: string[];
    paginationExhausted?: boolean;
    hitLegacyCap?: boolean;
  }>;
}

export interface SourceCoverageEntry {
  sourceId: string;
  sourceName: string;
  sourceType: "BRAND_OFFICIAL" | "LUXURY_MARKETPLACE";
  country?: string;
  officialUrl: string | null;
  footwearRoots: string[];
  footwearRootDiscovered: boolean;
  footwearCategoryCount: number;
  categoryNames: string[];
  sourceReportedProductCount: number | null;
  rawProductUrlsDiscovered: number;
  productsDiscovered: number;
  uniqueProductsAfterDedupe: number;
  modelFamilyCount: number;
  duplicateCount: number;
  pagesTraversed: number | null;
  paginationStatus: string;
  newArrivalsSourceDiscovered: boolean;
  verifiedNewProductCount: number;
  collectionStatus: string;
  coverageStatus: SourceCoverageStatus;
  errors: string[];
  warnings: string[];
}

export function buildSourceCoverageReport(
  families: ModelFamily[],
  collectionReport?: CollectionReportLike | null,
): { generatedAt: string; entries: SourceCoverageEntry[] } {
  const brandRegistry = loadBrandRegistry();
  const marketplaces = loadMarketplaceRegistry();
  const entries: SourceCoverageEntry[] = [];

  for (const brand of brandRegistry.all().filter((entry) => entry.isActive)) {
    const sourceId = slugifyBrandId(brand.brand);
    const brandFamilies = filterFamiliesForBrandOfficial(families, brand.brand);
    const categories = extractSourceCategories(families, sourceId);
    const sourceReport = collectionReport?.sources?.find(
      (item) => item.source.trim().toUpperCase() === brand.brand.trim().toUpperCase(),
    );
    const errors = sourceReport?.errors ?? [];
    const warnings: string[] = [];
    const sourceReported = sourceReport?.sourceReportedProductCount ?? null;
    const uniqueProducts =
      sourceReport?.parsedProducts ?? brandFamilies.length;
    const discrepancy = coverageDiscrepancyWarning(uniqueProducts, sourceReported);
    if (discrepancy) warnings.push(discrepancy);
    if (brand.collectionStatus !== "READY_AUTOMATIC") {
      warnings.push(`Registry status: ${brand.collectionStatus}`);
    }
    if ((brand.footwearCollectionHandles?.length ?? 0) === 0 && categories.length === 0) {
      warnings.push("Kaynak ayakkabı kategorisi keşfedilemedi");
    }
    if (sourceReport?.hitLegacyCap) {
      warnings.push("Eski collector üst sınırı hâlâ etkili");
    }

    const footwearRoots =
      sourceReport?.footwearRoots ??
      [
        ...(brand.footwearCollectionUrls ?? []).map((url) => {
          try {
            return new URL(url).pathname;
          } catch {
            return url;
          }
        }),
        ...brand.collectionPaths,
      ];

    entries.push({
      sourceId,
      sourceName: brand.brand,
      sourceType: "BRAND_OFFICIAL",
      country: brand.country,
      officialUrl: brand.officialUrl,
      footwearRoots,
      footwearRootDiscovered:
        footwearRoots.length > 0 ||
        categories.length > 0 ||
        (brand.footwearCollectionHandles?.length ?? 0) > 0,
      footwearCategoryCount: categories.length,
      categoryNames: categories.map((c) => c.categoryName),
      sourceReportedProductCount: sourceReported,
      rawProductUrlsDiscovered:
        sourceReport?.rawProductUrlsDiscovered ?? uniqueProducts,
      productsDiscovered: uniqueProducts,
      uniqueProductsAfterDedupe: uniqueProducts,
      modelFamilyCount: brandFamilies.length,
      duplicateCount: sourceReport?.duplicateCount ?? Math.max(0, uniqueProducts - brandFamilies.length),
      pagesTraversed: sourceReport?.pagesTraversed ?? null,
      paginationStatus: sourceReport?.status ?? brand.collectionStatus,
      newArrivalsSourceDiscovered: Boolean(
        brand.newArrivalCollectionHandles?.length ||
          brand.newArrivalUrls?.length ||
          categories.some((c) => /new/i.test(c.categoryName)),
      ),
      verifiedNewProductCount: countVerifiedNewForSource(families, sourceId),
      collectionStatus: brand.collectionStatus,
      coverageStatus: resolveCoverageStatus({
        uniqueProductCount: uniqueProducts,
        sourceReportedProductCount: sourceReported,
        paginationExhausted: sourceReport?.paginationExhausted,
        hitLegacyCap: sourceReport?.hitLegacyCap,
        collectionStatus: brand.collectionStatus,
        errors,
        footwearRootDiscovered: footwearRoots.length > 0 || categories.length > 0,
      }),
      errors,
      warnings,
    });
  }

  for (const marketplace of marketplaces) {
    const mpFamilies = filterFamiliesForMarketplaceSource(families, marketplace.id);
    const categories = extractSourceCategories(families, marketplace.id);
    const errors: string[] = [];
    const warnings: string[] = [];
    if (marketplace.newArrivalDiscoveryStatus === "NEEDS_PROBE") {
      warnings.push("Yeni Gelenler keşfi doğrulanmadı");
    }
    if (mpFamilies.length === 0) {
      warnings.push("Henüz toplanmış ürün yok");
    } else if (marketplace.discoveryStatus === "ACTIVE") {
      warnings.push("HTML listing collector did not prove full catalog exhaustion");
    }

    entries.push({
      sourceId: marketplace.id,
      sourceName: marketplace.name,
      sourceType: "LUXURY_MARKETPLACE",
      country: marketplace.country,
      officialUrl: marketplace.officialUrl,
      footwearRoots: [],
      footwearRootDiscovered: categories.length > 0,
      footwearCategoryCount: categories.length,
      categoryNames: categories.map((c) => c.categoryName),
      sourceReportedProductCount: null,
      rawProductUrlsDiscovered: mpFamilies.length,
      productsDiscovered: mpFamilies.length,
      uniqueProductsAfterDedupe: mpFamilies.length,
      modelFamilyCount: mpFamilies.length,
      duplicateCount: 0,
      pagesTraversed: null,
      paginationStatus: marketplace.discoveryStatus,
      newArrivalsSourceDiscovered:
        marketplace.newArrivalDiscoveryStatus === "VERIFIED" ||
        categories.some((c) => /new/i.test(c.categoryName)),
      verifiedNewProductCount: countVerifiedNewForSource(families, marketplace.id),
      collectionStatus: marketplace.discoveryStatus,
      coverageStatus: resolveMarketplaceCoverage(marketplace, mpFamilies.length, errors),
      errors,
      warnings,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    entries,
  };
}

function resolveMarketplaceCoverage(
  entry: MarketplaceRegistryEntry,
  productCount: number,
  errors: string[],
): SourceCoverageStatus {
  if (entry.discoveryStatus === "BLOCKED" && productCount === 0) {
    return "FAILED";
  }
  return resolveCoverageStatus({
    uniqueProductCount: productCount,
    collectionStatus:
      entry.discoveryStatus === "NEEDS_PROBE" ? "NEEDS_PROBE" : entry.discoveryStatus,
    errors,
    footwearRootDiscovered: productCount > 0,
    paginationExhausted: false,
  });
}
