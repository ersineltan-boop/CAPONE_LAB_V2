import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runMultibrandAnalysis } from "../analysis/runMultibrandAnalysis";
import { runMultibrandCollection } from "../collector/runMultibrand";
import { collectShopifyCollectionMembership, mergeVerifiedShopifyMembership } from "../collector/shopifyCollectionMembership";
import { FULL_COLLECTION_CRAWL_CAP } from "../collector/fullCoveragePaths";
import { collectLevelShoes, LEVEL_SHOES_ID } from "../collector/levelShoes";
import { collectMarketplaceListing } from "../collector/marketplaceHtml";
import { collectTheWebster, THE_WEBSTER_ID } from "../collector/theWebster";
import { DRIES_BRAND_NAME } from "../collector/driesVanNoten";
import { globalDedupe } from "../collector/dedupe";
import { mergeProductCatalog } from "../collector/mergeProducts";
import { stripConfirmedNonFootwear } from "../collector/stripNonFootwearCatalog";
import type { CollectionReport, PilotProduct, SourceCollectionReport } from "../collector/types";
import { buildModelFamilies } from "../modelFamily/buildFamilies";
import { loadModelFamilies, writeModelFamilies } from "../modelFamily/dataset";
import type { RawAnalyzedProduct } from "../modelFamily/types";
import { loadBrandRegistry } from "../registry/data/index";
import { brandToPilotSourceConfig } from "../registry/collection/brandToCollector";
import { loadMarketplaceRegistry } from "../registry/data/marketplaces";
import { MARKETPLACE_PROBE_CANDIDATES } from "../registry/marketplaceProbe";
import { isNewArrivalsCollectionPath } from "../newArrivals/detectNewness";
import { buildSourceCoverageReport } from "../source/buildCoverageReport";
import {
  brandNeedsCategoryRecrawl,
  buildBrandCategoryCoverage,
} from "../source/categoryCompleteness";
import { brandNeedsImageRecrawl, buildBrandImageCoverage } from "../source/imageCompleteness";
import { filterFamiliesForBrandOfficial } from "../source/sourceProductQuery";
import { buildVisualOtherAudit } from "../visual/digerAudit";
import {
  resolveVisualBasicCategory,
  VISUAL_BASIC_CATEGORIES,
} from "../visual/basicCategories";
import { getVisionEnrichmentMap } from "../taxonomy/vision/cache";
import type { TaxonomyVisionCacheFile } from "../taxonomy/vision/types";

import {
  buildCloudRefreshPlan,
  coverageToSourceStatus,
  marketplacePublishStatus,
  mergeIncomingSourceIntoCatalog,
  preserveUnrefreshedModelFamilies,
  renderCloudRefreshMarkdown,
  summarizeSourceOutcomes,
  type CloudRefreshSummary,
  type CloudSourceOutcome,
} from "./refreshPolicy";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MULTIBRAND_DIR = join(ROOT, "data", "multibrand");
const REGISTRY_DIR = join(ROOT, "data", "registry");
const PRODUCTS_PATH = join(MULTIBRAND_DIR, "products.json");
const COLLECTION_REPORT_PATH = join(MULTIBRAND_DIR, "collection-report.json");
const CLOUD_REPORT_PATH = join(ROOT, "logs", "cloud-refresh-report.json");

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2), "utf-8");
}

export async function runCloudRefresh(): Promise<CloudRefreshSummary> {
  const startedAt = new Date().toISOString();
  const registry = loadBrandRegistry();
  const plan = buildCloudRefreshPlan({
    brands: registry.all(),
    includeMarketplaces: process.env.CAPONE_REFRESH_MARKETPLACES !== "false",
  });
  const outcomes: CloudSourceOutcome[] = [];

  console.log("=== CAPONE cloud refresh ===");
  console.log(`Registry brands to collect: ${plan.brands.length}`);
  console.log(`Active marketplaces: ${plan.marketplaces.map((item) => item.name).join(", ") || "(none)"}`);
  console.log("Excluded: OpenAI, Vision, taxonomy-vision, Radar");

  const brandReport = await runMultibrandCollection({
    mode: "full",
    brandIds: plan.brands.map((brand) => brand.id),
  });
  for (const source of brandReport.sources) {
    outcomes.push({
      id: source.source,
      name: source.source,
      kind: "brand",
      status: source.status,
      parsedProducts: source.parsedProducts,
      errors: source.errors,
    });
  }

  let products = await readJson<PilotProduct[]>(PRODUCTS_PATH, []);
  const marketplaceReports: SourceCollectionReport[] = [];

  for (const marketplace of plan.marketplaces) {
    const outcome = await collectOneMarketplace(marketplace.id, marketplace.name, products);
    outcomes.push(outcome);
    products = mergeIncomingSourceIntoCatalog({
      existing: products,
      incoming: outcome.incoming,
      status: marketplacePublishStatus(outcome.status),
    });
    marketplaceReports.push({
      source: marketplace.name,
      status:
        outcome.status === "success"
          ? "success"
          : outcome.status === "partial"
            ? "partial"
            : "failed",
      parsedProducts: outcome.parsedProducts,
      discoveredProductLinks: outcome.parsedProducts,
      productsWithImages: outcome.incoming.filter((item) => Boolean(item.imageUrl)).length,
      productsWithMaterial: 0,
      errors: outcome.errors,
    });
    if (outcome.coverage) {
      await writeJson(join(MULTIBRAND_DIR, `${marketplace.id}-coverage.json`), outcome.coverage);
    }
  }

  await writeJson(PRODUCTS_PATH, products);

  for (const brand of plan.membershipBrands) {
    const membership = await refreshBrandMembership(brand.id, brand.brand, products);
    outcomes.push(membership.outcome);
    products = membership.products;
  }

  await writeJson(PRODUCTS_PATH, products);
  await writeDriesCoverage(products, brandReport);
  await appendMarketplaceReports(brandReport, marketplaceReports);

  if (products.length === 0) {
    throw new Error("Cloud refresh aborted: catalog is empty after collection.");
  }

  const stripped = stripConfirmedNonFootwear(products);
  if (stripped.removed.length > 0) {
    console.log(
      `[cloud-refresh] footwear strip removed ${stripped.removed.length} confirmed non-footwear product(s)`,
    );
    products = stripped.kept;
    await writeJson(PRODUCTS_PATH, products);
    await writeJson(join(MULTIBRAND_DIR, "non-footwear-removed.json"), {
      removedAt: new Date().toISOString(),
      count: stripped.removed.length,
      removed: stripped.removed,
    });
  }

  await runMultibrandAnalysis();
  const refreshedBrands = new Set(
    brandReport.sources
      .filter((source) => source.status === "success")
      .map((source) => source.source.trim().toUpperCase()),
  );
  const modelFamilyCount = await rebuildModelFamilies(refreshedBrands);
  await writeCoverageReports();
  await writeNewArrivalsProbeReport();

  const finishedAt = new Date().toISOString();
  const sourceSummary = summarizeSourceOutcomes(
    outcomes.filter((item) => item.kind !== "membership"),
  );
  const summary: CloudRefreshSummary = {
    startedAt,
    finishedAt,
    brandCount: plan.brands.length,
    marketplaceCount: plan.marketplaces.length,
    modelFamilyCount,
    ...sourceSummary,
    dataChanged: undefined,
    testsPassed: null,
    productionBuildPassed: null,
    commitCreated: null,
  };

  await writeJson(CLOUD_REPORT_PATH, summary);
  await writeGithubStepSummary(renderCloudRefreshMarkdown(summary));

  console.log("\n=== CAPONE cloud refresh complete ===");
  console.log(`Brands: ${summary.brandCount}`);
  console.log(`Marketplaces: ${summary.marketplaceCount}`);
  console.log(`Model families: ${summary.modelFamilyCount}`);
  console.log(`Failed sources: ${summary.failedSources.join(", ") || "(none)"}`);
  return summary;
}

async function collectOneMarketplace(
  id: string,
  name: string,
  existing: PilotProduct[],
): Promise<CloudSourceOutcome & { incoming: PilotProduct[]; coverage?: unknown }> {
  try {
    if (id === LEVEL_SHOES_ID) {
      const collected = await collectLevelShoes({
        maxPagesPerListing: 80,
        enrichDetails: false,
      });
      const status = coverageToSourceStatus(collected.coverageStatus, collected.products.length);
      return {
        id,
        name,
        kind: "marketplace",
        status,
        coverageStatus: collected.coverageStatus,
        parsedProducts: collected.products.length,
        errors: collected.errors,
        incoming: collected.products,
        coverage: collected,
      };
    }

    if (id === THE_WEBSTER_ID) {
      const collected = await collectTheWebster();
      const status = coverageToSourceStatus(
        collected.coverage.status,
        collected.products.length,
      );
      return {
        id,
        name,
        kind: "marketplace",
        status,
        coverageStatus: collected.coverage.status,
        parsedProducts: collected.products.length,
        errors: collected.coverage.errors,
        incoming: collected.products,
        coverage: collected.coverage,
      };
    }

    const candidate = MARKETPLACE_PROBE_CANDIDATES.find((item) => item.id === id);
    if (!candidate) {
      return {
        id,
        name,
        kind: "marketplace",
        status: "skipped",
        coverageStatus: "NEEDS_PROBE",
        parsedProducts: 0,
        errors: [`No production collector adapter for marketplace ${id}`],
        incoming: [],
      };
    }

    const collected = await collectMarketplaceListing(candidate, { maxPages: 80 });
    const coverageStatus = collected.blocked
      ? "FAILED"
      : collected.products.length === 0
        ? "FAILED"
        : collected.errors.length > 0
          ? "PARTIAL"
          : "PARTIAL";
    const status = coverageToSourceStatus(coverageStatus, collected.products.length);
    return {
      id,
      name,
      kind: "marketplace",
      status,
      coverageStatus,
      parsedProducts: collected.products.length,
      errors: collected.errors,
      incoming: collected.products,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Marketplace ${name} failed; preserving previous products. ${message}`);
    return {
      id,
      name,
      kind: "marketplace",
      status: "failed",
      coverageStatus: "FAILED",
      parsedProducts: existing.filter((product) => product.source === id).length,
      errors: [message],
      incoming: [],
    };
  }
}

async function refreshBrandMembership(
  id: string,
  brand: string,
  catalog: PilotProduct[],
): Promise<{ products: PilotProduct[]; outcome: CloudSourceOutcome }> {
  const registry = loadBrandRegistry();
  const entry = registry.get(id);
  const config = entry ? brandToPilotSourceConfig(entry) : null;
  if (!entry || !config) {
    return {
      products: catalog,
      outcome: {
        id,
        name: brand,
        kind: "membership",
        status: "skipped",
        parsedProducts: 0,
        errors: ["No Shopify membership config"],
      },
    };
  }

  try {
    const known = catalog
      .filter((product) => product.brand.trim().toUpperCase() === brand.trim().toUpperCase())
      .map((product) => product.productUrl);
    console.log(`Refreshing collection membership: ${brand}`);
    const collected = await collectShopifyCollectionMembership(config, {
      knownProductUrls: known,
          maxCollections: FULL_COLLECTION_CRAWL_CAP,
    });
    const status =
      collected.products.length === 0 && collected.errors.length > 0
        ? "failed"
        : collected.errors.length > 0
          ? "partial"
          : "success";
    const products =
      status === "failed"
        ? catalog
        : globalDedupe(mergeVerifiedShopifyMembership(config, catalog, collected));
    return {
      products,
      outcome: {
        id: `${id}:membership`,
        name: `${brand} membership`,
        kind: "membership",
        status,
        parsedProducts: collected.products.length,
        errors: collected.errors,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Membership refresh failed for ${brand}; preserving catalog. ${message}`);
    return {
      products: catalog,
      outcome: {
        id: `${id}:membership`,
        name: `${brand} membership`,
        kind: "membership",
        status: "failed",
        parsedProducts: 0,
        errors: [message],
      },
    };
  }
}

async function writeDriesCoverage(
  products: PilotProduct[],
  collectionReport: CollectionReport,
): Promise<void> {
  const dries = products.filter(
    (product) => product.brand.trim().toUpperCase() === DRIES_BRAND_NAME,
  );
  const source = collectionReport.sources.find(
    (item) => item.source.trim().toUpperCase() === DRIES_BRAND_NAME,
  );
  const categories = new Map<string, number>();
  for (const product of dries) {
    for (const category of product.sourceCategories ?? []) {
      categories.set(category.categoryName, (categories.get(category.categoryName) ?? 0) + 1);
    }
  }
  const uniqueUrls = new Set(dries.map((product) => product.productUrl));
  const verifiedNew = dries.filter((product) => product.isNewArrivalsCollection).length;
  const errors = source?.errors ?? [];
  const coverageStatus =
    dries.length === 0
      ? "FAILED"
      : errors.length > 0 ||
          (source?.sourceReportedProductCount != null &&
            uniqueUrls.size < source.sourceReportedProductCount)
        ? "PARTIAL"
        : source?.status === "success"
          ? "FULL"
          : "PARTIAL";

  await writeJson(join(MULTIBRAND_DIR, "dries-coverage.json"), {
    brand: DRIES_BRAND_NAME,
    collectedAt: new Date().toISOString(),
    footwearRoot: source?.footwearRoots?.[0] ?? "/collections/women-shoes",
    categoriesDiscovered: [...categories.keys()],
    categoryProductCounts: Object.fromEntries(categories),
    pagesTraversed: source?.pagesTraversed ?? null,
    rawProductUrls: source?.rawProductUrlsDiscovered ?? uniqueUrls.size,
    uniqueSourceProducts: uniqueUrls.size,
    verifiedNewProducts: verifiedNew,
    imagesRetained: dries.filter((product) => (product.images?.length ?? 0) > 0).length,
    paginationExhausted: source?.paginationExhausted ?? null,
    sourceReportedProductCount: source?.sourceReportedProductCount ?? null,
    errors,
    method: source?.method ?? "custom-adapter",
    coverageStatus,
    remainingLimitation:
      dries.length === 0
        ? "No accessible women's footwear products were returned."
        : "Dedicated Dries adapter coverage regenerated from the catalog after registry-driven collection.",
  });
}

async function appendMarketplaceReports(
  brandReport: CollectionReport,
  marketplaceReports: SourceCollectionReport[],
): Promise<void> {
  if (marketplaceReports.length === 0) return;
  const merged: CollectionReport = {
    ...brandReport,
    sources: [...brandReport.sources, ...marketplaceReports],
    failedBrands: [
      ...(brandReport.failedBrands ?? []),
      ...marketplaceReports
        .filter((item) => item.status === "failed")
        .map((item) => item.source),
    ],
    successfulBrands: [
      ...(brandReport.successfulBrands ?? []),
      ...marketplaceReports
        .filter((item) => item.status !== "failed")
        .map((item) => item.source),
    ],
    totalProducts: (await readJson<PilotProduct[]>(PRODUCTS_PATH, [])).length,
    runFinishedAt: new Date().toISOString(),
  };
  await writeJson(COLLECTION_REPORT_PATH, merged);
}

async function rebuildModelFamilies(refreshedBrands: ReadonlySet<string>): Promise<number> {
  const products = await readJson<RawAnalyzedProduct[]>(
    join(MULTIBRAND_DIR, "analyzed-products.json"),
    [],
  );
  const productImageGalleries = await readJson<Record<string, string[]>>(
    join(MULTIBRAND_DIR, "product-image-galleries.json"),
    {},
  );
  const priorFamilies = await loadModelFamilies();
  const visionCacheRaw = await readJson<TaxonomyVisionCacheFile | null>(
    join(MULTIBRAND_DIR, "taxonomy-vision-cache.json"),
    null,
  );
  const visionEnrichments = getVisionEnrichmentMap(
    visionCacheRaw ?? { version: 1, promptVersion: "taxonomy-v1-1", records: {} },
  );

  const { families, report } = buildModelFamilies(products, {
    productImageGalleries,
    priorFamilies,
    visionEnrichments,
  });

  if (families.length === 0) {
    throw new Error("Cloud refresh aborted: Model Family rebuild produced zero families.");
  }

  // A daily crawl only refreshes a subset of the registry. Preserve last-good
  // families for brands that were not successfully collected this time.
  const deliveryFamilies = preserveUnrefreshedModelFamilies(families, priorFamilies, refreshedBrands);
  const preservedCount = deliveryFamilies.length - families.length;
  report.modelFamilyCount = deliveryFamilies.length;
  report.totalVariants = deliveryFamilies.reduce((sum, family) => sum + family.variantCount, 0);
  report.multiVariantFamilyCount = deliveryFamilies.filter((family) => family.variantCount > 1).length;
  report.collapsedVariantProducts = report.totalVariants - deliveryFamilies.length;
  report.reductionPercent = report.totalVariants === 0
    ? 0
    : Math.round((report.collapsedVariantProducts / report.totalVariants) * 1000) / 10;
  await writeModelFamilies(deliveryFamilies);
  await writeJson(join(MULTIBRAND_DIR, "model-family-report.json"), report);
  console.log(`Model families rebuilt: ${families.length}; last-good preserved: ${preservedCount}`);
  return report.modelFamilyCount;
}

async function writeCoverageReports(): Promise<void> {
  const families = await loadModelFamilies();
  const products = await readJson<PilotProduct[]>(PRODUCTS_PATH, []);
  const collectionReport = await readJson<CollectionReport | null>(COLLECTION_REPORT_PATH, null);
  const coverage = buildSourceCoverageReport(families, collectionReport, products);
  await writeJson(join(REGISTRY_DIR, "source-coverage-report.json"), coverage);

  const registry = loadBrandRegistry();
  const productsByBrand = new Map<string, PilotProduct[]>();
  for (const product of products) {
    const key = product.brand.trim().toUpperCase();
    const list = productsByBrand.get(key) ?? [];
    list.push(product);
    productsByBrand.set(key, list);
  }

  const categoryEntries = [];
  const imageEntries = [];
  for (const brand of registry.all().filter((entry) => entry.isActive)) {
    const brandProducts = productsByBrand.get(brand.brand.trim().toUpperCase()) ?? [];
    const brandFamilies = filterFamiliesForBrandOfficial(families, brand.brand);
    const crawled = [
      ...(brand.footwearCollectionUrls ?? []),
      ...(brand.collectionPaths ?? []).map(
        (path) => `${(brand.officialUrl ?? "").replace(/\/$/, "")}${path}`,
      ),
    ].filter(Boolean);
    const category = buildBrandCategoryCoverage({
      brandId: brand.id,
      brandName: brand.brand,
      products: brandProducts,
      families: brandFamilies,
      crawledCollectionUrls: crawled,
      discoveredCollectionUrls: crawled,
    });
    categoryEntries.push({
      ...category,
      needsRecrawl: brandNeedsCategoryRecrawl(category),
    });
    const image = buildBrandImageCoverage({
      brandId: brand.id,
      brandName: brand.brand,
      products: brandProducts,
      families: brandFamilies,
    });
    imageEntries.push({
      ...image,
      needsRecrawl: brandNeedsImageRecrawl(image),
    });
  }

  const visualBefore = Object.fromEntries(
    VISUAL_BASIC_CATEGORIES.map((item) => [
      item.id,
      item.id === "tumu"
        ? families.length
        : families.filter((family) => resolveVisualBasicCategory(family) === item.id).length,
    ]),
  );
  const digerAudit = buildVisualOtherAudit(families);

  await writeJson(join(REGISTRY_DIR, "source-category-coverage-report.json"), {
    generatedAt: new Date().toISOString(),
    brands: categoryEntries,
  });
  await writeJson(join(REGISTRY_DIR, "product-image-coverage-report.json"), {
    generatedAt: new Date().toISOString(),
    brands: imageEntries,
  });
  await writeJson(join(REGISTRY_DIR, "visual-other-audit.json"), {
    ...digerAudit,
    visualCounts: visualBefore,
  });
}

async function writeNewArrivalsProbeReport(): Promise<void> {
  const brands = loadBrandRegistry().all();
  const marketplaces = loadMarketplaceRegistry();

  const brandProbes = brands.map((entry) => {
    const candidateHandles = [
      ...(entry.newArrivalCollectionHandles ?? []),
      ...(entry.footwearCollectionHandles ?? []).filter(isNewArrivalsCollectionPath),
      ...(entry.collectionPaths ?? []).filter(isNewArrivalsCollectionPath),
    ];
    const candidateUrls = [
      ...(entry.newArrivalUrls ?? []),
      ...(entry.footwearCollectionUrls ?? []).filter((url) => isNewArrivalsCollectionPath(url)),
    ];
    const verified =
      entry.newArrivalDiscoveryStatus === "VERIFIED" ||
      candidateHandles.length > 0 ||
      candidateUrls.length > 0;
    return {
      sourceId: entry.id,
      sourceLabel: entry.brand,
      sourceType: "BRAND" as const,
      discoveryStatus: entry.collectionDiscoveryStatus ?? "UNKNOWN",
      newArrivalDiscoveryStatus: entry.newArrivalDiscoveryStatus ?? "NEEDS_PROBE",
      candidateUrls: [...new Set(candidateUrls)],
      candidateHandles: [...new Set(candidateHandles)],
      verified,
      evidenceStrategy: verified ? "NEW_ARRIVALS_COLLECTION" : null,
    };
  });

  const marketplaceProbes = marketplaces.map((entry) => ({
    sourceId: entry.id,
    sourceLabel: entry.name,
    sourceType: "MARKETPLACE" as const,
    discoveryStatus: entry.discoveryStatus,
    newArrivalDiscoveryStatus: entry.newArrivalDiscoveryStatus,
    candidateUrls: [...(entry.newArrivalUrls ?? [])],
    candidateHandles: [...(entry.newArrivalCollectionHandles ?? [])],
    verified: entry.newArrivalDiscoveryStatus === "VERIFIED",
    evidenceStrategy:
      entry.newArrivalDiscoveryStatus === "VERIFIED" ? "NEW_ARRIVALS_COLLECTION" : null,
  }));

  await writeJson(join(REGISTRY_DIR, "new-arrivals-probe-report.json"), {
    generatedAt: new Date().toISOString(),
    brandCount: brandProbes.length,
    marketplaceCount: marketplaceProbes.length,
    verifiedBrandSources: brandProbes.filter((entry) => entry.verified).length,
    verifiedMarketplaceSources: marketplaceProbes.filter((entry) => entry.verified).length,
    brands: brandProbes,
    marketplaces: marketplaceProbes,
  });
}

async function writeGithubStepSummary(markdown: string): Promise<void> {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  await appendFile(summaryPath, markdown, "utf-8");
}
