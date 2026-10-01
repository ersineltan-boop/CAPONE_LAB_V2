import { collectBrandByCollectorType } from "../registry/collection/collectByType";
import { collectShopifyFootwearBackfill } from "../collector/shopify";
import { collectSchemaOrgProducts } from "../collector/schemaOrg";
import { collectHtmlListingProducts } from "../collector/htmlListing";
import { resolveCollectionPaths } from "../collector/discoverPaths";
import type { CollectionAttemptResult } from "../collector/collectWithFallback";
import type { BrandRegistryEntry } from "../registry/types/brand";
import type { PilotSourceConfig } from "../collector/types";
import { collectInditexLikeBrand } from "./inditexLike";
import { collectFromProductUrls, discoverSitemapProductUrls } from "./sitemap";
import { defaultOnboardingHttp, type OnboardingHttp } from "./http";
import type { ProbeResult } from "./types";
import type { PilotProduct } from "../collector/types";
import { collectJwAnderson } from "../collector/jwAnderson";
import { collectMargaux } from "../collector/margaux";

function syntheticEntry(
  slug: string,
  brand: string,
  sourceUrl: string,
  probe: ProbeResult,
): BrandRegistryEntry {
  return {
    id: slug,
    brand,
    country: "UNCLASSIFIED",
    segment: "UNCLASSIFIED",
    role: "UNCLASSIFIED",
    footwearInfluence: 0,
    directionalInfluence: 0,
    commercialInfluence: 0,
    trackingPriority: "P2",
    officialUrl: sourceUrl,
    collectionPaths: probe.collectionPaths,
    footwearCollectionHandles: probe.footwearPaths.map((path) => path.replace(/^\/collections\//, "")),
    collectionDiscoveryStatus: probe.footwearPaths.length > 0 ? "AUTO_DISCOVERED" : "UNKNOWN",
    collectorType:
      probe.strategy === "shopify-public"
        ? "SHOPIFY_PUBLIC"
        : probe.strategy === "structured-data"
          ? "STRUCTURED_DATA"
          : "CUSTOM_ADAPTER",
    collectionStatus: "READY_AUTOMATIC",
    productLimit: 200,
    backfillLimit: 200,
    supportsMultipleImages: true,
    discoverySources: ["onboarding"],
    isActive: false,
    notes: "onboarding staging",
    classificationStatus: "UNREVIEWED",
    radarEligible: false,
  };
}

export async function collectCandidateToStaging(input: {
  slug: string;
  brand: string;
  sourceUrl: string;
  probe: ProbeResult;
  http?: OnboardingHttp;
}): Promise<CollectionAttemptResult> {
  const http = input.http ?? defaultOnboardingHttp;
  const entry = syntheticEntry(input.slug, input.brand, input.sourceUrl, input.probe);

  if ((input.slug === "casadei" || input.slug === "jil-sander") && input.probe.strategy === "salesforce-public") {
    const { collectOfficialSalesforce } = await import("../collector/salesforceCommerce/integration");
    return collectOfficialSalesforce({ id: input.slug, brand: input.brand, baseUrl: input.sourceUrl, collectionPaths: input.probe.footwearPaths, maxProducts: 200, collectMode: "full" }, http);
  }

  if (input.slug === "margaux" && input.probe.strategy === "shopify-public") {
    return collectMargaux({ id: input.slug, brand: input.brand, baseUrl: input.sourceUrl,
      collectionPaths: input.probe.footwearPaths, maxProducts: 200, collectMode: "full" }, http);
  }

  if (input.slug === "jw-anderson" && input.probe.strategy === "shopify-public") {
    return collectJwAnderson({ id: input.slug, brand: input.brand, baseUrl: input.sourceUrl,
      collectionPaths: input.probe.footwearPaths, maxProducts: 200, collectMode: "full" }, http);
  }

  if (input.probe.strategy === "inditex-like-catalog") {
    return collectInditexLikeBrand(entry, http, input.probe.locale ?? "us/en");
  }

  if (input.probe.strategy === "shopify-public") {
    const collected = await collectBrandByCollectorType(entry, { mode: "full" });
    if (collected.products.length > 0) return collected;
    const config: PilotSourceConfig = {
      id: input.slug,
      brand: input.brand,
      baseUrl: input.sourceUrl.replace(/\/$/, ""),
      collectionPaths: input.probe.footwearPaths,
      verifiedFootwearPaths: input.probe.footwearPaths,
      maxProducts: 200,
      backfillLimit: 200,
      collectMode: "full",
    };
    const backfill = await collectShopifyFootwearBackfill(config);
    return { ...backfill, method: "shopify" as const };
  }

  if (input.probe.strategy === "sitemap-product-crawl") {
    const urls = await discoverSitemapProductUrls(http, input.sourceUrl);
    const samples = await collectFromProductUrls(
      http,
      urls,
      { id: input.slug, name: input.brand, baseUrl: input.sourceUrl.replace(/\/$/, "") },
      40,
    );
    const products: PilotProduct[] = samples.map((sample) => ({
      source: input.slug,
      brand: input.brand,
      productName: sample.productName,
      productUrl: sample.productUrl,
      imageUrl: sample.imageUrl,
      images: sample.images,
      category: null,
      color: sample.color,
      material: null,
      toeShape: null,
      heelType: null,
      heelHeight: null,
      details: null,
      discoveredAt: new Date().toISOString(),
      variants: [
        {
          title: sample.productName,
          color: sample.color,
          sku: sample.sku,
          imageUrl: sample.imageUrl,
          images: sample.images,
        },
      ],
    }));
    return {
      products,
      discoveredLinks: new Set(products.map((product) => product.productUrl)),
      errors: [],
      method: "schema-org",
    };
  }

  if (input.probe.strategy === "structured-data") {
    const config: PilotSourceConfig = {
      id: input.slug,
      brand: input.brand,
      baseUrl: input.sourceUrl.replace(/\/$/, ""),
      collectionPaths: input.probe.collectionPaths,
      maxProducts: 80,
    };
    const paths = await resolveCollectionPaths(config);
    const schema = await collectSchemaOrgProducts({ ...config, collectionPaths: paths }, paths);
    if (schema.products.length > 0) return { ...schema, method: "schema-org" };
    const html = await collectHtmlListingProducts({ ...config, collectionPaths: paths }, paths);
    return { ...html, method: html.products.length > 0 ? "html-listing" : "none" };
  }

  return {
    products: [],
    discoveredLinks: new Set(),
    errors: [`No collectable strategy for ${input.brand}`],
    method: "none",
  };
}
