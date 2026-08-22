import type { PilotProduct } from "../collector/types";
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
    hitCollectionCrawlCap?: boolean;
    collectionsCrawled?: string[];
  }>;
}

export interface SourceCoverageEntry {
  sourceId: string;
  sourceName: string;
  sourceType: "BRAND_OFFICIAL" | "LUXURY_MARKETPLACE";
  country?: string;
  officialUrl: string | null;
  collectorType?: string;
  platform?: string;
  footwearRoots: string[];
  footwearRootDiscovered: boolean;
  footwearCategoryCount: number;
  categoryNames: string[];
  sourceReportedProductCount: number | null;
  observedExpectedProductCount: number | null;
  collectedProductCount: number;
  rawProductUrlsDiscovered: number;
  productsDiscovered: number;
  uniqueProductsAfterDedupe: number;
  modelFamilyCount: number;
  duplicateCount: number;
  estimatedCoveragePercent: number | null;
  sourceCategoryCount: number;
  productsWithCategoryMembership: number;
  galleryCoverage: number | null;
  pagesTraversed: number | null;
  paginationStatus: string;
  newArrivalsSourceDiscovered: boolean;
  verifiedNewProductCount: number;
  verifiedNewCount: number;
  collectionStatus: string;
  coverageStatus: SourceCoverageStatus;
  evidence: string[];
  limitations: string[];
  errors: string[];
  warnings: string[];
}

export function buildSourceCoverageReport(
  families: ModelFamily[],
  collectionReport?: CollectionReportLike | null,
  products: readonly PilotProduct[] = [],
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
    const brandProducts = products.filter(
      (product) => product.brand.trim().toUpperCase() === brand.brand.trim().toUpperCase(),
    );
    const uniqueProducts =
      brandProducts.length > 0
        ? brandProducts.length
        : sourceReport?.parsedProducts ?? brandFamilies.length;
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
    if (sourceReport?.hitCollectionCrawlCap) {
      warnings.push("Collection crawl safety ceiling reached — remaining footwear collections were not visited");
    }

    const footwearRoots =
      sourceReport?.collectionsCrawled ??
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

    const stats = productCompletenessStats(brandProducts);
    const coverageStatus = resolveCoverageStatus({
      uniqueProductCount: uniqueProducts,
      sourceReportedProductCount: sourceReported,
      paginationExhausted: sourceReport?.paginationExhausted,
      hitLegacyCap: sourceReport?.hitLegacyCap,
      hitCollectionCrawlCap: sourceReport?.hitCollectionCrawlCap,
      collectionStatus: brand.collectionStatus,
      errors,
      footwearRootDiscovered: footwearRoots.length > 0 || categories.length > 0,
    });
    const evidence = [
      sourceReport?.paginationExhausted ? "Pagination exhausted" : "Pagination not proven exhausted",
      `${footwearRoots.length} footwear collection path(s) crawled`,
      `${stats.withCategory} / ${stats.total} products have source category membership`,
    ];
    const limitations = [...warnings];
    if (coverageStatus !== "FULL") {
      limitations.push("FULL requires exhausted pagination and agreement with the source women's footwear total");
    }

    entries.push({
      sourceId,
      sourceName: brand.brand,
      sourceType: "BRAND_OFFICIAL",
      country: brand.country,
      officialUrl: brand.officialUrl,
      collectorType: brand.collectorType,
      platform: brand.collectorType,
      footwearRoots,
      footwearRootDiscovered:
        footwearRoots.length > 0 ||
        categories.length > 0 ||
        (brand.footwearCollectionHandles?.length ?? 0) > 0,
      footwearCategoryCount: categories.length,
      categoryNames: categories.map((c) => c.categoryName),
      sourceReportedProductCount: sourceReported,
      observedExpectedProductCount: sourceReported,
      collectedProductCount: uniqueProducts,
      rawProductUrlsDiscovered:
        sourceReport?.rawProductUrlsDiscovered ?? uniqueProducts,
      productsDiscovered: uniqueProducts,
      uniqueProductsAfterDedupe: uniqueProducts,
      modelFamilyCount: brandFamilies.length,
      duplicateCount: sourceReport?.duplicateCount ?? Math.max(0, uniqueProducts - brandFamilies.length),
      estimatedCoveragePercent: coveragePercent(uniqueProducts, sourceReported),
      sourceCategoryCount: categories.length,
      productsWithCategoryMembership: stats.withCategory,
      galleryCoverage: stats.galleryCoverage,
      pagesTraversed: sourceReport?.pagesTraversed ?? null,
      paginationStatus: sourceReport?.status ?? brand.collectionStatus,
      newArrivalsSourceDiscovered: Boolean(
        brand.newArrivalCollectionHandles?.length ||
          brand.newArrivalUrls?.length ||
          categories.some((c) => /new/i.test(c.categoryName)),
      ),
      verifiedNewProductCount: countVerifiedNewForSource(families, sourceId),
      verifiedNewCount: stats.verifiedNew,
      collectionStatus: brand.collectionStatus,
      coverageStatus,
      evidence,
      limitations,
      errors,
      warnings,
    });
  }

  for (const marketplace of marketplaces) {
    const mpFamilies = filterFamiliesForMarketplaceSource(families, marketplace.id);
    const mpProducts = products.filter((product) => product.source === marketplace.id);
    const categories = extractSourceCategories(families, marketplace.id);
    const errors: string[] = [];
    const warnings: string[] = [];
    if (marketplace.newArrivalDiscoveryStatus === "NEEDS_PROBE") {
      warnings.push("Yeni Gelenler keşfi doğrulanmadı");
    }
    if (mpFamilies.length === 0 && mpProducts.length === 0) {
      warnings.push("Henüz toplanmış ürün yok");
    } else if (marketplace.discoveryStatus === "ACTIVE") {
      warnings.push("Marketplace collector did not prove full catalog exhaustion");
    }
    const stats = productCompletenessStats(mpProducts);
    const collected = mpProducts.length > 0 ? mpProducts.length : mpFamilies.length;

    entries.push({
      sourceId: marketplace.id,
      sourceName: marketplace.name,
      sourceType: "LUXURY_MARKETPLACE",
      country: marketplace.country,
      officialUrl: marketplace.officialUrl,
      collectorType: "MARKETPLACE_ADAPTER",
      platform: "MARKETPLACE_ADAPTER",
      footwearRoots: [],
      footwearRootDiscovered: categories.length > 0 || collected > 0,
      footwearCategoryCount: categories.length,
      categoryNames: categories.map((c) => c.categoryName),
      sourceReportedProductCount: null,
      observedExpectedProductCount: null,
      collectedProductCount: collected,
      rawProductUrlsDiscovered: collected,
      productsDiscovered: collected,
      uniqueProductsAfterDedupe: collected,
      modelFamilyCount: mpFamilies.length,
      duplicateCount: Math.max(0, collected - mpFamilies.length),
      estimatedCoveragePercent: null,
      sourceCategoryCount: categories.length,
      productsWithCategoryMembership: stats.withCategory,
      galleryCoverage: stats.galleryCoverage,
      pagesTraversed: null,
      paginationStatus: marketplace.discoveryStatus,
      newArrivalsSourceDiscovered:
        marketplace.newArrivalDiscoveryStatus === "VERIFIED" ||
        categories.some((c) => /new/i.test(c.categoryName)),
      verifiedNewProductCount: countVerifiedNewForSource(families, marketplace.id),
      verifiedNewCount: stats.verifiedNew,
      collectionStatus: marketplace.discoveryStatus,
      coverageStatus: resolveMarketplaceCoverage(marketplace, collected, errors),
      evidence: [
        `${collected} source products`,
        `${mpFamilies.length} model families`,
        marketplace.newArrivalDiscoveryStatus === "VERIFIED"
          ? "New In membership verified"
          : "New In not fully verified",
      ],
      limitations: warnings,
      errors,
      warnings,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    entries,
  };
}

function productCompletenessStats(products: readonly PilotProduct[]): {
  total: number;
  withCategory: number;
  galleryCoverage: number | null;
  verifiedNew: number;
} {
  const total = products.length;
  if (total === 0) {
    return { total: 0, withCategory: 0, galleryCoverage: null, verifiedNew: 0 };
  }
  const withCategory = products.filter(
    (product) =>
      (product.sourceCategories?.length ?? 0) > 0 || Boolean(product.sourceCategoryName),
  ).length;
  const withGallery = products.filter((product) => (product.images?.length ?? 0) >= 2).length;
  const verifiedNew = products.filter(
    (product) => product.isNewArrivalsCollection || product.hasNewBadge,
  ).length;
  return {
    total,
    withCategory,
    galleryCoverage: Math.round((withGallery / total) * 1000) / 10,
    verifiedNew,
  };
}

function coveragePercent(collected: number, expected: number | null): number | null {
  if (expected == null || expected <= 0) return null;
  return Math.min(100, Math.round((collected / expected) * 1000) / 10);
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
