import { resolveCollectionPaths } from "./discoverPaths";
import { collectHtmlListingProducts } from "./htmlListing";
import { collectSchemaOrgProducts } from "./schemaOrg";
import { collectShopifyCollectionProducts } from "./shopify";
import type { CollectionMethod, PilotProduct, PilotSourceConfig } from "./types";

export interface CollectionAttemptResult {
  products: PilotProduct[];
  discoveredLinks: Set<string>;
  errors: string[];
  method: CollectionMethod;
  pagesTraversed?: number;
  rawProductUrlsDiscovered?: number;
  duplicateCount?: number;
  paginationExhausted?: boolean;
  sourceReportedProductCount?: number | null;
}

function mergeAttempt(
  current: CollectionAttemptResult,
  next: Omit<CollectionAttemptResult, "method">,
  method: CollectionMethod,
): CollectionAttemptResult {
  if (next.products.length === 0) {
    return {
      products: current.products,
      discoveredLinks: new Set([...current.discoveredLinks, ...next.discoveredLinks]),
      errors: [...current.errors, ...next.errors],
      method: current.method,
    };
  }

  return {
    products: next.products,
    discoveredLinks: new Set([...current.discoveredLinks, ...next.discoveredLinks]),
    errors: next.errors,
    method,
  };
}

export async function collectWithFallback(
  config: PilotSourceConfig,
): Promise<CollectionAttemptResult> {
  const collectionPaths = await resolveCollectionPaths(config);
  const resolvedConfig: PilotSourceConfig = {
    ...config,
    collectionPaths,
  };

  const empty: CollectionAttemptResult = {
    products: [],
    discoveredLinks: new Set<string>(),
    errors: [],
    method: "none",
  };

  if (collectionPaths.length === 0) {
    return {
      ...empty,
      errors: [`No collection paths discovered for ${config.brand}`],
    };
  }

  const shopify = await collectShopifyCollectionProducts(resolvedConfig);
  if (shopify.products.length > 0) {
    return {
      ...shopify,
      method: "shopify",
    };
  }

  let result = mergeAttempt(empty, shopify, "none");

  const schema = await collectSchemaOrgProducts(resolvedConfig, collectionPaths);
  if (schema.products.length > 0) {
    return mergeAttempt(result, schema, "schema-org");
  }
  result = mergeAttempt(result, schema, result.method);

  const listing = await collectHtmlListingProducts(resolvedConfig, collectionPaths);
  if (listing.products.length > 0) {
    return mergeAttempt(result, listing, "html-listing");
  }
  result = mergeAttempt(result, listing, result.method);

  if (result.products.length === 0 && result.errors.length === 0) {
    result.errors.push(
      `All collection strategies returned zero footwear products for ${config.brand}`,
    );
  }

  return result;
}
