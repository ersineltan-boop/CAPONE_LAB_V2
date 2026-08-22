import { isTrackedModelFamilyDatasetPath } from "../modelFamily/dataset";
import type { BrandRegistryEntry } from "../registry/types/brand";
import {
  brandToPilotSourceConfig,
  getCollectableBrands,
} from "../registry/collection/brandToCollector";
import {
  browsableMarketplaces,
  type MarketplaceRegistryEntry,
} from "../registry/data/marketplaces";
import type { PilotProduct } from "../collector/types";
import { globalDedupe } from "../collector/dedupe";
import { mergeProductCatalog } from "../collector/mergeProducts";

/**
 * Cloud daily refresh sequence. Local text analysis is required for Model Families.
 * OpenAI / Vision / Radar / taxonomy-vision are intentionally excluded.
 *
 * Scalability: `data/multibrand/model-families.json` is already tens of MB.
 * Before CAPONE grows toward hundreds of brands/marketplaces, generated catalog
 * and collector state should move from Git history to durable cloud/object storage.
 * Do not introduce Git LFS in this pipeline.
 */
export const CLOUD_REFRESH_STEPS = [
  "collect-active-brands",
  "collect-active-marketplaces",
  "refresh-source-memberships",
  "local-analyze",
  "rebuild-model-families",
  "regenerate-coverage-reports",
] as const;

export const CLOUD_REFRESH_EXCLUDED_WORKFLOWS = [
  "openai",
  "openai-vision",
  "taxonomy-vision",
  "radar",
] as const;

export const CLOUD_REFRESH_CORE_DATA_PATHS = [
  "data/multibrand/products.json",
  "data/multibrand/analyzed-products.json",
  "data/multibrand/model-families.json",
  "data/multibrand/product-image-galleries.json",
] as const;

export const CLOUD_REFRESH_TRACKED_DATA_PATHS = [
  "data/multibrand/products.json",
  "data/multibrand/collection-report.json",
  "data/multibrand/collect-state.json",
  "data/multibrand/analyzed-products.json",
  "data/multibrand/market-analysis.json",
  "data/multibrand/model-families.json",
  "data/multibrand/model-family-report.json",
  "data/multibrand/dries-coverage.json",
  "data/multibrand/level-shoes-coverage.json",
  "data/multibrand/product-image-galleries.json",
  "data/registry/source-coverage-report.json",
  "data/registry/source-category-coverage-report.json",
  "data/registry/product-image-coverage-report.json",
  "data/registry/visual-other-audit.json",
  "data/registry/new-arrivals-probe-report.json",
] as const;

const BLOCKED_STAGE_PREFIXES = [
  "public/data/catalog/",
  "dist/",
  "node_modules/",
  "logs/",
] as const;

const BLOCKED_STAGE_FILES = new Set([".env", ".env.local"]);

export type CloudSourceStatus = "success" | "partial" | "failed" | "skipped";

export interface CloudSourceOutcome {
  id: string;
  name: string;
  kind: "brand" | "marketplace" | "membership";
  status: CloudSourceStatus;
  coverageStatus?: "FULL" | "PARTIAL" | "FAILED" | "NEEDS_PROBE";
  parsedProducts: number;
  errors: string[];
}

export interface CloudRefreshSummary {
  startedAt: string;
  finishedAt: string;
  brandCount: number;
  marketplaceCount: number;
  modelFamilyCount: number;
  successfulSources: string[];
  partialSources: string[];
  failedSources: string[];
  skippedSources: string[];
  dataChanged?: boolean;
  testsPassed?: boolean | null;
  productionBuildPassed?: boolean | null;
  commitCreated?: boolean | null;
}

export interface CloudRefreshPlan {
  steps: typeof CLOUD_REFRESH_STEPS;
  excludedWorkflows: typeof CLOUD_REFRESH_EXCLUDED_WORKFLOWS;
  brands: BrandRegistryEntry[];
  marketplaces: MarketplaceRegistryEntry[];
  membershipBrands: BrandRegistryEntry[];
}

export function getCloudRefreshBrands(
  entries: readonly BrandRegistryEntry[],
): BrandRegistryEntry[] {
  return getCollectableBrands(entries);
}

export function getCloudRefreshMarketplaces(
  entries: readonly MarketplaceRegistryEntry[] = browsableMarketplaces(),
): MarketplaceRegistryEntry[] {
  return entries.filter(
    (entry) =>
      entry.isActive &&
      (entry.discoveryStatus === "ACTIVE" || entry.discoveryStatus === "PARTIAL"),
  );
}

export function getMembershipRefreshBrands(
  entries: readonly BrandRegistryEntry[],
): BrandRegistryEntry[] {
  return getCollectableBrands(entries).filter((entry) => {
    if (entry.collectorType !== "SHOPIFY_PUBLIC" && entry.collectorType !== "SHOPIFY_JSON") {
      return false;
    }
    return brandToPilotSourceConfig(entry) !== null;
  });
}

export function buildCloudRefreshPlan(input: {
  brands: readonly BrandRegistryEntry[];
  marketplaces?: readonly MarketplaceRegistryEntry[];
}): CloudRefreshPlan {
  const brands = getCloudRefreshBrands(input.brands);
  const marketplaces = getCloudRefreshMarketplaces(
    input.marketplaces ?? browsableMarketplaces(),
  );
  return {
    steps: CLOUD_REFRESH_STEPS,
    excludedWorkflows: CLOUD_REFRESH_EXCLUDED_WORKFLOWS,
    brands,
    marketplaces,
    membershipBrands: getMembershipRefreshBrands(input.brands),
  };
}

export function normalizeRepoPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

export function isDatedHistorySnapshotPath(path: string): boolean {
  const normalized = normalizeRepoPath(path);
  return /^data\/history\/[^/]+\//.test(normalized);
}

export function isCloudRefreshCoreDataPath(path: string): boolean {
  return (CLOUD_REFRESH_CORE_DATA_PATHS as readonly string[]).includes(normalizeRepoPath(path));
}

export function shouldStageCloudRefreshPath(path: string): boolean {
  const normalized = normalizeRepoPath(path);
  if (!normalized) return false;
  if (BLOCKED_STAGE_FILES.has(normalized.split("/").pop() ?? "")) return false;
  if (normalized.startsWith(".env")) return false;
  if (BLOCKED_STAGE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
  if (normalized.endsWith(".log")) return false;
  if (normalized.includes("/products.pre-")) return false;
  if (isDatedHistorySnapshotPath(normalized)) return false;
  if (normalized.startsWith("data/history/") && normalized !== "data/history/latest-change-report.json") {
    return false;
  }
  return (CLOUD_REFRESH_TRACKED_DATA_PATHS as readonly string[]).includes(normalized);
}

export function coverageToSourceStatus(
  coverage: "FULL" | "PARTIAL" | "FAILED" | "NEEDS_PROBE" | string,
  parsedProducts: number,
): CloudSourceStatus {
  if (coverage === "NEEDS_PROBE" || coverage === "NEEDS_CUSTOM_ADAPTER") return "skipped";
  if (coverage === "FAILED" || parsedProducts === 0) return "failed";
  if (coverage === "PARTIAL") return "partial";
  if (coverage === "FULL") return "success";
  if (parsedProducts > 0) return "partial";
  return "failed";
}

export function mergeIncomingSourceIntoCatalog(input: {
  existing: readonly PilotProduct[];
  incoming: readonly PilotProduct[];
  status: CloudSourceStatus;
}): PilotProduct[] {
  if (input.status === "failed" || input.status === "skipped") {
    return [...input.existing];
  }
  return globalDedupe(mergeProductCatalog(input.existing, input.incoming));
}

export function summarizeSourceOutcomes(
  outcomes: readonly CloudSourceOutcome[],
): Pick<
  CloudRefreshSummary,
  "successfulSources" | "partialSources" | "failedSources" | "skippedSources"
> {
  const collection = outcomes.filter(
    (item) => item.kind === "brand" || item.kind === "marketplace",
  );
  return {
    successfulSources: collection
      .filter((item) => item.status === "success")
      .map((item) => item.name),
    partialSources: collection
      .filter((item) => item.status === "partial")
      .map((item) => item.name),
    failedSources: collection
      .filter((item) => item.status === "failed")
      .map((item) => item.name),
    skippedSources: collection
      .filter((item) => item.status === "skipped")
      .map((item) => item.name),
  };
}

export function renderCloudRefreshMarkdown(summary: CloudRefreshSummary): string {
  const lines = [
    "## CAPONE cloud daily refresh",
    "",
    `- Start: ${summary.startedAt}`,
    `- End: ${summary.finishedAt}`,
    `- Successful sources: ${summary.successfulSources.length ? summary.successfulSources.join(", ") : "(none)"}`,
    `- Partial sources: ${summary.partialSources.length ? summary.partialSources.join(", ") : "(none)"}`,
    `- Failed sources: ${summary.failedSources.length ? summary.failedSources.join(", ") : "(none)"}`,
    `- Brand count: ${summary.brandCount}`,
    `- Marketplace count: ${summary.marketplaceCount}`,
    `- Model Family count: ${summary.modelFamilyCount}`,
    `- Data changed: ${formatGate(summary.dataChanged)}`,
    `- Tests passed: ${formatGate(summary.testsPassed)}`,
    `- Production build passed: ${formatGate(summary.productionBuildPassed)}`,
    `- Commit/push created: ${formatGate(summary.commitCreated)}`,
    "",
  ];
  return lines.join("\n");
}

function formatGate(value: boolean | null | undefined): string {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "pending";
}
