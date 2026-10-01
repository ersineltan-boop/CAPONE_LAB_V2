import { resolveCollectionPaths } from "../../collector/discoverPaths";
import {
  discoverVerifiedFootwearCollections,
  pickPreferredFootwearCollectionPaths,
} from "../../collector/discoverFootwearCollections";
import { collectHtmlListingProducts } from "../../collector/htmlListing";
import { collectSchemaOrgProducts } from "../../collector/schemaOrg";
import {
  collectShopifyCollectionProducts,
  collectShopifyFootwearBackfill,
} from "../../collector/shopify";
import type { CollectionAttemptResult } from "../../collector/collectWithFallback";
import type { CollectionMethod, PilotSourceConfig } from "../../collector/types";
import type { BrandRegistryEntry, CollectorType } from "../types/brand";
import { brandToPilotSourceConfig, resolveBrandBaseUrl } from "./brandToCollector";
import { mergeFullCoverageCollectionPaths, FULL_COLLECTION_CRAWL_CAP } from "../../collector/fullCoveragePaths";
import { isNewArrivalsCollectionPath } from "../../newArrivals/detectNewness";
import { collectDriesVanNoten, DRIES_BRAND_ID } from "../../collector/driesVanNoten";
import { collectZara, ZARA_BRAND_ID } from "../../collector/zara";
import { parseInditexLocale } from "../../onboarding/adapters";
import { collectInditexLikeBrand } from "../../onboarding/inditexLike";
import { defaultOnboardingHttp } from "../../onboarding/http";
import { collectSergioRossi } from "../../collector/sergioRossi";

export interface FootwearCollectionConfigResult {
  config: PilotSourceConfig | null;
  discoveryStatus: BrandRegistryEntry["collectionDiscoveryStatus"] | null;
  footwearCollectionPath: string | null;
  footwearCollectionUrl: string | null;
}

async function resolveFootwearCollectionConfig(
  entry: BrandRegistryEntry,
  config: PilotSourceConfig,
  options?: { fullCoverage?: boolean },
): Promise<FootwearCollectionConfigResult> {
  const preferredPaths = pickPreferredFootwearCollectionPaths(
    entry.footwearCollectionHandles,
    entry.footwearCollectionUrls?.map((url) => {
      try {
        return new URL(url).pathname.replace(/\/$/, "");
      } catch {
        return url;
      }
    }),
    config.collectionPaths,
  );

  const newArrivalPaths = [
    ...(entry.newArrivalUrls ?? []).map((url) => {
      try {
        return new URL(url).pathname.replace(/\/$/, "");
      } catch {
        return url;
      }
    }),
    ...(entry.newArrivalCollectionHandles ?? []).map((handle) =>
      handle.startsWith("/") ? handle : `/collections/${handle}`,
    ),
    ...config.collectionPaths.filter((path) => isNewArrivalsCollectionPath(path)),
  ];

  const hasPersistedDiscovery =
    (entry.collectionDiscoveryStatus === "VERIFIED" ||
      entry.collectionDiscoveryStatus === "AUTO_DISCOVERED") &&
    preferredPaths.length > 0;

  if (hasPersistedDiscovery && !options?.fullCoverage) {
    const paths = preferredPaths;
    return {
      config: {
        ...config,
        collectionPaths: paths,
        verifiedFootwearPaths: paths,
      },
      discoveryStatus: entry.collectionDiscoveryStatus ?? null,
      footwearCollectionPath: paths[0] ?? null,
      footwearCollectionUrl: entry.footwearCollectionUrls?.[0] ?? null,
    };
  }

  const baseUrl = resolveBrandBaseUrl(entry);
  if (!baseUrl) {
    return {
      config: null,
      discoveryStatus: null,
      footwearCollectionPath: null,
      footwearCollectionUrl: null,
    };
  }

  if (options?.fullCoverage) {
    return {
      config: {
        ...config,
        collectionPaths: preferredPaths.length > 0 ? preferredPaths : [...config.collectionPaths],
        verifiedFootwearPaths: preferredPaths,
      },
      discoveryStatus: entry.collectionDiscoveryStatus ?? "UNKNOWN",
      footwearCollectionPath: preferredPaths[0] ?? null,
      footwearCollectionUrl: entry.footwearCollectionUrls?.[0] ?? null,
    };
  }

  const discovered = await discoverVerifiedFootwearCollections({
    baseUrl,
    existingPaths:
      preferredPaths.length > 0
        ? [...preferredPaths, ...config.collectionPaths]
        : await resolveCollectionPaths(config),
    fullCoverage: options?.fullCoverage === true,
    maxCandidates: options?.fullCoverage ? FULL_COLLECTION_CRAWL_CAP : 16,
  });

  const mergedPaths = mergeFullCoverageCollectionPaths({
    persistedPaths: preferredPaths,
    collectionPaths: config.collectionPaths,
    discoveredPaths: discovered.verifiedPaths,
    newArrivalPaths,
  });

  if (mergedPaths.length === 0) {
    return {
      config: null,
      discoveryStatus: discovered.status,
      footwearCollectionPath: null,
      footwearCollectionUrl: null,
    };
  }

  return {
    config: {
      ...config,
      collectionPaths: mergedPaths,
      verifiedFootwearPaths: discovered.verifiedPaths.length > 0
        ? discovered.verifiedPaths
        : preferredPaths,
    },
    discoveryStatus: discovered.status,
    footwearCollectionPath: mergedPaths[0] ?? null,
    footwearCollectionUrl: entry.footwearCollectionUrls?.[0] ?? null,
  };
}

function emptyResult(errors: string[] = []): CollectionAttemptResult {
  return {
    products: [],
    discoveredLinks: new Set<string>(),
    errors,
    method: "none",
  };
}

async function collectStructuredOnly(
  config: PilotSourceConfig,
): Promise<CollectionAttemptResult> {
  const collectionPaths = await resolveCollectionPaths(config);
  if (collectionPaths.length === 0) {
    return emptyResult([`No collection paths discovered for ${config.brand}`]);
  }

  const resolvedConfig: PilotSourceConfig = { ...config, collectionPaths };
  const schema = await collectSchemaOrgProducts(resolvedConfig, collectionPaths);
  if (schema.products.length > 0) {
    return { ...schema, method: "schema-org" };
  }

  const listing = await collectHtmlListingProducts(resolvedConfig, collectionPaths);
  if (listing.products.length > 0) {
    return { ...listing, method: "html-listing" };
  }

  return emptyResult([
    ...schema.errors,
    ...listing.errors,
    `Structured collection returned zero footwear products for ${config.brand}`,
  ]);
}

export async function collectBrandByCollectorType(
  entry: BrandRegistryEntry,
  options: { mode?: "legacy" | "backfill" | "incremental" | "full" } = {},
): Promise<
  CollectionAttemptResult & {
    discoveryStatus?: BrandRegistryEntry["collectionDiscoveryStatus"] | null;
    footwearCollectionPath?: string | null;
    footwearCollectionUrl?: string | null;
    hitBackfillLimit?: boolean;
    catalogFootwearCount?: number;
    pagesTraversed?: number;
    rawProductUrlsDiscovered?: number;
    duplicateCount?: number;
    paginationExhausted?: boolean;
    sourceReportedProductCount?: number | null;
    hitCollectionCrawlCap?: boolean;
    collectionsCrawled?: string[];
  }
> {
  const config = brandToPilotSourceConfig(entry);
  if (!config) {
    return emptyResult([`${entry.brand}: officialUrl/collectionUrl missing`]);
  }

  const mode = options.mode ?? config.collectMode ?? "legacy";

  if (entry.id === "casadei" || entry.id === "jil-sander") {
    const { collectOfficialSalesforce } = await import("../../collector/salesforceCommerce/integration");
    return collectOfficialSalesforce(config);
  }

  if (entry.id === "margaux") {
    const { collectMargaux } = await import("../../collector/margaux");
    return collectMargaux(config);
  }

  if (entry.id === "jw-anderson") {
    const { collectJwAnderson } = await import("../../collector/jwAnderson");
    return collectJwAnderson(config);
  }

  if (entry.id === "sergio-rossi") {
    return collectSergioRossi(config);
  }

  const { officialWaveScope, collectOfficialBrandWave } = await import("../../collector/officialBrandWave");
  if (officialWaveScope(entry.id)) return collectOfficialBrandWave(config);
  if (entry.id === DRIES_BRAND_ID) {
    const collected = await collectDriesVanNoten(entry);
    return {
      ...collected,
      hitBackfillLimit: false,
    };
  }

  if (entry.id === ZARA_BRAND_ID) {
    const collected = await collectZara(entry);
    return {
      ...collected,
      hitBackfillLimit: false,
    };
  }

  const inditexLocale = parseInditexLocale(entry.notes);
  if (inditexLocale && entry.id !== ZARA_BRAND_ID && entry.id !== DRIES_BRAND_ID) {
    const collected = await collectInditexLikeBrand(entry, defaultOnboardingHttp, inditexLocale);
    return {
      ...collected,
      hitBackfillLimit: false,
    };
  }

  switch (entry.collectorType) {
    case "SHOPIFY_PUBLIC":
    case "SHOPIFY_JSON":
    case "UNKNOWN": {
      const resolved = await resolveFootwearCollectionConfig(entry, config, {
        fullCoverage: mode === "full",
      });
      if (!resolved.config) {
        return {
          ...emptyResult([
            `${entry.brand}: güvenilir footwear collection bulunamadı (${resolved.discoveryStatus ?? "NEEDS_FOOTWEAR_CONFIG"})`,
          ]),
          discoveryStatus: resolved.discoveryStatus,
          footwearCollectionPath: resolved.footwearCollectionPath,
          footwearCollectionUrl: resolved.footwearCollectionUrl,
        };
      }

      if (mode === "backfill" || mode === "incremental" || mode === "full") {
        const resolvedConfig =
          mode === "full"
            ? { ...resolved.config, collectMode: "full" as const }
            : resolved.config;
        const backfill = await collectShopifyFootwearBackfill(resolvedConfig);
        if (backfill.products.length > 0) {
          return {
            ...backfill,
            method: "shopify",
            discoveryStatus: resolved.discoveryStatus,
            footwearCollectionPath: resolved.footwearCollectionPath,
            footwearCollectionUrl: resolved.footwearCollectionUrl,
            hitBackfillLimit: backfill.hitBackfillLimit,
            catalogFootwearCount: backfill.catalogFootwearCount,
          };
        }
        const structured = await collectStructuredOnly(resolved.config);
        return {
          ...structured,
          discoveryStatus: resolved.discoveryStatus,
          footwearCollectionPath: resolved.footwearCollectionPath,
          footwearCollectionUrl: resolved.footwearCollectionUrl,
        };
      }

      const shopify = await collectShopifyCollectionProducts(resolved.config);
      if (shopify.products.length > 0) {
        return {
          ...shopify,
          method: "shopify",
          discoveryStatus: resolved.discoveryStatus,
          footwearCollectionPath: resolved.footwearCollectionPath,
          footwearCollectionUrl: resolved.footwearCollectionUrl,
        };
      }

      const structured = await collectStructuredOnly(resolved.config);
      return {
        ...structured,
        discoveryStatus: resolved.discoveryStatus,
        footwearCollectionPath: resolved.footwearCollectionPath,
        footwearCollectionUrl: resolved.footwearCollectionUrl,
      };
    }
    case "STRUCTURED_DATA":
      return collectStructuredOnly(config);
    case "CUSTOM_ADAPTER":
      return emptyResult([
        `${entry.brand}: CUSTOM_ADAPTER — otomatik collector yok`,
      ]);
    case "LINK_ONLY":
      return emptyResult([`${entry.brand}: LINK_ONLY — scrape yapılmıyor`]);
    case "UNSUPPORTED":
      return emptyResult([`${entry.brand}: UNSUPPORTED collector`]);
    default:
      return emptyResult([`${entry.brand}: bilinmeyen collectorType`]);
  }
}

export function collectorTypeLabel(type: CollectorType): string {
  return type;
}

export function resolveMethodLabel(method: CollectionMethod): string {
  return method;
}

export { resolveFootwearCollectionConfig };
