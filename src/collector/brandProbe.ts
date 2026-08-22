import { discoverCollectionPaths, resolveCollectionPaths } from "../collector/discoverPaths";
import { discoverVerifiedFootwearCollections } from "../collector/discoverFootwearCollections";
import { extractJsonLdBlocks, mapSchemaProducts } from "../collector/schemaOrg";
import { fetchJson, fetchText } from "../collector/http";
import type { BrandRegistryEntry, CollectorType } from "../registry/types/brand";
import { brandToPilotSourceConfig } from "../registry/collection/brandToCollector";

export type BrandProbeRecommendation =
  | "READY_AUTOMATIC"
  | "NEEDS_FOOTWEAR_CONFIG"
  | "NEEDS_CUSTOM_ADAPTER"
  | "LINK_ONLY"
  | "FAILED";

export interface BrandProbeResult {
  brand: string;
  officialUrl: string | null;
  detectedCollectorType: CollectorType;
  reachable: boolean;
  productDiscoveryWorks: boolean;
  imagesAvailable: boolean;
  multipleImagesAvailable: boolean;
  sampleProductCount: number;
  sampleProductUrls: string[];
  error: string | null;
  recommendation: BrandProbeRecommendation;
}

interface ShopifyProductsResponse {
  products?: Array<{
    handle?: string;
    images?: Array<{ src?: string }>;
  }>;
}

async function probeShopifyJson(
  baseUrl: string,
  collectionPaths: string[],
): Promise<{
  works: boolean;
  productCount: number;
  productUrls: string[];
  imagesAvailable: boolean;
  multipleImagesAvailable: boolean;
  error: string | null;
}> {
  const paths =
    collectionPaths.length > 0
      ? collectionPaths
      : await discoverCollectionPaths(baseUrl);

  for (const collectionPath of paths.slice(0, 3)) {
    const url = `${baseUrl.replace(/\/$/, "")}${collectionPath}/products.json?limit=5`;
    const result = await fetchJson<ShopifyProductsResponse>(url, 900);
    if (!result.ok || !result.data?.products?.length) {
      continue;
    }

    const products = result.data.products;
    const productUrls = products
      .map((product) =>
        product.handle
          ? `${baseUrl.replace(/\/$/, "")}/products/${product.handle}`
          : null,
      )
      .filter((value): value is string => Boolean(value));

    const imageCounts = products.map((product) => product.images?.length ?? 0);
    const imagesAvailable = imageCounts.some((count) => count > 0);
    const multipleImagesAvailable = imageCounts.some((count) => count > 1);

    return {
      works: productUrls.length > 0,
      productCount: productUrls.length,
      productUrls,
      imagesAvailable,
      multipleImagesAvailable,
      error: null,
    };
  }

  return {
    works: false,
    productCount: 0,
    productUrls: [],
    imagesAvailable: false,
    multipleImagesAvailable: false,
    error: "Shopify products JSON erişilemedi",
  };
}

async function probeStructuredData(
  baseUrl: string,
  collectionPaths: string[],
): Promise<{
  works: boolean;
  productCount: number;
  productUrls: string[];
  imagesAvailable: boolean;
  multipleImagesAvailable: boolean;
  error: string | null;
}> {
  const paths =
    collectionPaths.length > 0
      ? collectionPaths
      : await discoverCollectionPaths(baseUrl);

  for (const collectionPath of paths.slice(0, 2)) {
    const url = `${baseUrl.replace(/\/$/, "")}${collectionPath}`;
    const result = await fetchText(url, { delayMs: 900 });
    if (!result.ok) continue;

    const blocks = extractJsonLdBlocks(result.text);
    if (blocks.length === 0) continue;

    const mapped = mapSchemaProducts(result.text, {
      id: "probe",
      brand: "PROBE",
      baseUrl,
      collectionPaths: paths,
      maxProducts: 5,
    }, new Date().toISOString(), url);

    if (mapped.length === 0) continue;

    return {
      works: true,
      productCount: mapped.length,
      productUrls: mapped.map((product) => product.productUrl),
      imagesAvailable: mapped.some((product) => Boolean(product.imageUrl)),
      multipleImagesAvailable: mapped.some(
        (product) => (product.images?.length ?? 0) > 1,
      ),
      error: null,
    };
  }

  return {
    works: false,
    productCount: 0,
    productUrls: [],
    imagesAvailable: false,
    multipleImagesAvailable: false,
    error: "Structured product data bulunamadı",
  };
}

export async function probeBrandEntry(
  entry: BrandRegistryEntry,
): Promise<BrandProbeResult> {
  const config = brandToPilotSourceConfig(entry);
  const officialUrl = entry.officialUrl;

  if (!config) {
    return {
      brand: entry.brand,
      officialUrl,
      detectedCollectorType: "LINK_ONLY",
      reachable: false,
      productDiscoveryWorks: false,
      imagesAvailable: false,
      multipleImagesAvailable: false,
      sampleProductCount: 0,
      sampleProductUrls: [],
      error: "officialUrl/collectionUrl eksik",
      recommendation: "LINK_ONLY",
    };
  }

  const homepage = await fetchText(config.baseUrl, { delayMs: 700 });
  if (!homepage.ok) {
    return {
      brand: entry.brand,
      officialUrl,
      detectedCollectorType: "UNSUPPORTED",
      reachable: false,
      productDiscoveryWorks: false,
      imagesAvailable: false,
      multipleImagesAvailable: false,
      sampleProductCount: 0,
      sampleProductUrls: [],
      error: homepage.error ?? `Site erişilemedi: HTTP ${homepage.status}`,
      recommendation: "FAILED",
    };
  }

  const collectionPaths = await resolveCollectionPaths(config);
  const footwearDiscovery = await discoverVerifiedFootwearCollections({
    baseUrl: config.baseUrl,
    existingPaths: collectionPaths,
  });

  const probePaths =
    footwearDiscovery.verifiedPaths.length > 0
      ? footwearDiscovery.verifiedPaths
      : collectionPaths;

  const shopify = await probeShopifyJson(config.baseUrl, probePaths);
  if (shopify.works) {
    if (footwearDiscovery.verifiedPaths.length === 0) {
      return {
        brand: entry.brand,
        officialUrl,
        detectedCollectorType: "SHOPIFY_PUBLIC",
        reachable: true,
        productDiscoveryWorks: true,
        imagesAvailable: shopify.imagesAvailable,
        multipleImagesAvailable: shopify.multipleImagesAvailable,
        sampleProductCount: shopify.productCount,
        sampleProductUrls: shopify.productUrls,
        error: "Shopify erişilebilir ancak footwear collection doğrulanamadı",
        recommendation: "NEEDS_FOOTWEAR_CONFIG",
      };
    }

    return {
      brand: entry.brand,
      officialUrl,
      detectedCollectorType: "SHOPIFY_PUBLIC",
      reachable: true,
      productDiscoveryWorks: true,
      imagesAvailable: shopify.imagesAvailable,
      multipleImagesAvailable: shopify.multipleImagesAvailable,
      sampleProductCount: shopify.productCount,
      sampleProductUrls: shopify.productUrls,
      error: null,
      recommendation: "READY_AUTOMATIC",
    };
  }

  const structured = await probeStructuredData(config.baseUrl, probePaths);
  if (structured.works) {
    return {
      brand: entry.brand,
      officialUrl,
      detectedCollectorType: "STRUCTURED_DATA",
      reachable: true,
      productDiscoveryWorks: true,
      imagesAvailable: structured.imagesAvailable,
      multipleImagesAvailable: structured.multipleImagesAvailable,
      sampleProductCount: structured.productCount,
      sampleProductUrls: structured.productUrls,
      error: structured.error,
      recommendation: "READY_AUTOMATIC",
    };
  }

  return {
    brand: entry.brand,
    officialUrl,
    detectedCollectorType: "UNSUPPORTED",
    reachable: true,
    productDiscoveryWorks: false,
    imagesAvailable: false,
    multipleImagesAvailable: false,
    sampleProductCount: 0,
    sampleProductUrls: [],
    error: shopify.error ?? structured.error ?? "Otomatik collector bulunamadı",
    recommendation: homepage.ok ? "NEEDS_CUSTOM_ADAPTER" : "FAILED",
  };
}

export async function probeBrandEntries(
  entries: BrandRegistryEntry[],
): Promise<BrandProbeResult[]> {
  const results: BrandProbeResult[] = [];
  for (const entry of entries) {
    try {
      results.push(await probeBrandEntry(entry));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        brand: entry.brand,
        officialUrl: entry.officialUrl,
        detectedCollectorType: "UNSUPPORTED",
        reachable: false,
        productDiscoveryWorks: false,
        imagesAvailable: false,
        multipleImagesAvailable: false,
        sampleProductCount: 0,
        sampleProductUrls: [],
        error: message,
        recommendation: "FAILED",
      });
    }
  }
  return results;
}
