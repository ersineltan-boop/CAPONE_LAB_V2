import { mergeProductRecords, normalizeProductUrl } from "../collector/mergeProducts";
import type { PilotProduct } from "../collector/types";
import {
  isExcludedMarketplaceBrand,
  MARKETPLACE_PRESENTATION_POLICY,
  normalizeMarketplaceSourceId,
} from "./marketplacePolicy";

export const AUTOMATED_MARKETPLACE_IDS = [
  "level-shoes",
  "farfetch",
  "free-people",
  "the-webster",
  "24s",
] as const;

export const MIN_LAST_GOOD_RETENTION_RATIO = 0.6;

export type AutomatedMarketplaceId = (typeof AUTOMATED_MARKETPLACE_IDS)[number];
export type MarketplaceCoverageStatus = "FULL" | "PARTIAL" | "FAILED";

export interface MarketplaceRefreshCandidate {
  sourceId: string;
  products: PilotProduct[];
  coverageStatus: MarketplaceCoverageStatus;
  sourceTotal: number | null;
  rawCollected: number;
  eligibleTotal: number | null;
  paginationExhausted: boolean;
  errors: string[];
  preExcludedByPolicy?: number;
}

export interface MarketplaceGateReport {
  sourceId: string;
  accepted: boolean;
  decision: "PUBLISH_TO_PROPOSAL" | "PRESERVE_LAST_GOOD";
  reasons: string[];
  coverageStatus: MarketplaceCoverageStatus;
  sourceTotal: number | null;
  rawCollected: number;
  eligibleTotal: number | null;
  candidateProducts: number;
  eligibleProducts: number;
  excludedByPolicy: number;
  productsWithImages: number;
  productsWithTaxonomy: number;
  duplicateUrls: number;
  crossSourceUrlCollisions: number;
  baseline: boolean;
  baselineVerifiedNewProducts: number;
  priceHidden: boolean;
  previousLastGoodProducts: number;
  previousPolicyEligibleProducts: number;
  lastGoodRetentionRatio: number | null;
  minimumLastGoodRetentionRatio: number;
  lastGoodPreserved: boolean;
}

export interface MarketplaceGateDecision {
  report: MarketplaceGateReport;
  eligibleProducts: PilotProduct[];
}

const ALLOWED_IDS = new Set<string>(AUTOMATED_MARKETPLACE_IDS);
const CLASSIFIED_FOOTWEAR_CATEGORIES = new Set([
  "BOOT",
  "ANKLE_BOOT",
  "PUMP",
  "SLINGBACK",
  "BALLERINA",
  "MARY_JANE",
  "LOAFER",
  "MULE",
  "SANDAL",
  "THONG",
  "WEDGE",
  "SNEAKER",
]);

function hasImage(product: PilotProduct): boolean {
  return Boolean(product.imageUrl) || (product.images?.length ?? 0) > 0;
}

function hasTaxonomy(product: PilotProduct): boolean {
  return typeof product.category === "string" && CLASSIFIED_FOOTWEAR_CATEGORIES.has(product.category);
}

function policyEligible(products: readonly PilotProduct[]): PilotProduct[] {
  return products.filter((product) => !isExcludedMarketplaceBrand(product.brand));
}

function normalizeBaselineProduct(product: PilotProduct): PilotProduct {
  return { ...product, isNewArrivalsCollection: false, hasNewBadge: false };
}

function duplicateUrlCount(products: readonly PilotProduct[]): number {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const product of products) {
    const key = normalizeProductUrl(product.productUrl);
    if (seen.has(key)) duplicates += 1;
    seen.add(key);
  }
  return duplicates;
}

export function evaluateMarketplaceCandidate(input: {
  candidate: MarketplaceRefreshCandidate;
  previousLastGood: readonly PilotProduct[];
}): MarketplaceGateDecision {
  const sourceId = normalizeMarketplaceSourceId(input.candidate.sourceId);
  const previous = input.previousLastGood.filter(
    (product) => normalizeMarketplaceSourceId(product.source) === sourceId,
  );
  const previousEligible = policyEligible(previous);
  const baseline = previousEligible.length === 0;
  const sourceProducts = input.candidate.products.filter(
    (product) => normalizeMarketplaceSourceId(product.source) === sourceId,
  );
  const wrongSourceCount = input.candidate.products.length - sourceProducts.length;
  const filtered = policyEligible(sourceProducts);
  const excludedByPolicy =
    (input.candidate.preExcludedByPolicy ?? 0) + sourceProducts.length - filtered.length;
  const eligibleProducts = (baseline
    ? filtered.map(normalizeBaselineProduct)
    : filtered
  ).sort((left, right) =>
    normalizeProductUrl(left.productUrl).localeCompare(normalizeProductUrl(right.productUrl)),
  );
  const productsWithImages = eligibleProducts.filter(hasImage).length;
  const productsWithTaxonomy = eligibleProducts.filter(hasTaxonomy).length;
  const duplicates = duplicateUrlCount(eligibleProducts);
  const otherSourceUrls = new Set(
    input.previousLastGood
      .filter((product) => normalizeMarketplaceSourceId(product.source) !== sourceId)
      .map((product) => normalizeProductUrl(product.productUrl)),
  );
  const crossSourceUrlCollisions = eligibleProducts.filter((product) =>
    otherSourceUrls.has(normalizeProductUrl(product.productUrl)),
  ).length;
  const lastGoodRetentionRatio = baseline
    ? null
    : eligibleProducts.length / previousEligible.length;
  const reasons: string[] = [];

  if (!ALLOWED_IDS.has(sourceId)) reasons.push("source is not on the approved adapter allow-list");
  if (wrongSourceCount > 0) reasons.push(`${wrongSourceCount} product(s) belong to another source`);
  if (input.candidate.coverageStatus !== "FULL") {
    reasons.push(`coverage is ${input.candidate.coverageStatus}, not FULL`);
  }
  if (!input.candidate.paginationExhausted) reasons.push("pagination is not exhausted");
  if (input.candidate.sourceTotal === null) reasons.push("source total is unavailable");
  if (input.candidate.eligibleTotal === null) reasons.push("eligible source total is unavailable");
  if (
    input.candidate.sourceTotal !== null &&
    input.candidate.rawCollected < input.candidate.sourceTotal
  ) {
    reasons.push(`raw source coverage is ${input.candidate.rawCollected}/${input.candidate.sourceTotal}`);
  }
  if (
    input.candidate.eligibleTotal !== null &&
    eligibleProducts.length !== input.candidate.eligibleTotal
  ) {
    reasons.push(`eligible coverage is ${eligibleProducts.length}/${input.candidate.eligibleTotal}`);
  }
  if (eligibleProducts.length === 0) reasons.push("eligible catalog is empty");
  if (productsWithImages !== eligibleProducts.length) {
    reasons.push(`image coverage is ${productsWithImages}/${eligibleProducts.length}`);
  }
  if (productsWithTaxonomy !== eligibleProducts.length) {
    reasons.push(`taxonomy coverage is ${productsWithTaxonomy}/${eligibleProducts.length}`);
  }
  if (duplicates > 0) reasons.push(`catalog contains ${duplicates} duplicate URL(s)`);
  if (crossSourceUrlCollisions > 0) {
    reasons.push(`catalog collides with ${crossSourceUrlCollisions} other-source URL(s)`);
  }
  if (
    lastGoodRetentionRatio !== null &&
    lastGoodRetentionRatio < MIN_LAST_GOOD_RETENTION_RATIO
  ) {
    reasons.push(
      `catastrophic drop: retained ${(lastGoodRetentionRatio * 100).toFixed(1)}% of policy-eligible last-good`,
    );
  }
  if (input.candidate.errors.length > 0) {
    reasons.push(`collector reported ${input.candidate.errors.length} error(s)`);
  }
  if (MARKETPLACE_PRESENTATION_POLICY.showPrice !== false) {
    reasons.push("marketplace price presentation is not disabled");
  }

  const baselineVerifiedNewProducts = baseline
    ? eligibleProducts.filter(
        (product) => product.isNewArrivalsCollection || product.hasNewBadge,
      ).length
    : 0;
  if (baselineVerifiedNewProducts > 0) {
    reasons.push(`baseline contains ${baselineVerifiedNewProducts} NEW product(s)`);
  }

  const accepted = reasons.length === 0;
  return {
    eligibleProducts,
    report: {
      sourceId,
      accepted,
      decision: accepted ? "PUBLISH_TO_PROPOSAL" : "PRESERVE_LAST_GOOD",
      reasons,
      coverageStatus: input.candidate.coverageStatus,
      sourceTotal: input.candidate.sourceTotal,
      rawCollected: input.candidate.rawCollected,
      eligibleTotal: input.candidate.eligibleTotal,
      candidateProducts: input.candidate.products.length,
      eligibleProducts: eligibleProducts.length,
      excludedByPolicy,
      productsWithImages,
      productsWithTaxonomy,
      duplicateUrls: duplicates,
      crossSourceUrlCollisions,
      baseline,
      baselineVerifiedNewProducts,
      priceHidden: MARKETPLACE_PRESENTATION_POLICY.showPrice === false,
      previousLastGoodProducts: previous.length,
      previousPolicyEligibleProducts: previousEligible.length,
      lastGoodRetentionRatio,
      minimumLastGoodRetentionRatio: MIN_LAST_GOOD_RETENTION_RATIO,
      lastGoodPreserved: !accepted,
    },
  };
}

export function replaceVerifiedMarketplaceCatalog(input: {
  existing: readonly PilotProduct[];
  sourceId: string;
  verified: readonly PilotProduct[];
}): PilotProduct[] {
  const sourceId = normalizeMarketplaceSourceId(input.sourceId);
  const existingSource = input.existing.filter(
    (product) => normalizeMarketplaceSourceId(product.source) === sourceId,
  );
  const verifiedByUrl = new Map(
    input.verified.map((product) => [normalizeProductUrl(product.productUrl), product]),
  );
  const refreshed: PilotProduct[] = [];

  for (const previous of existingSource) {
    const key = normalizeProductUrl(previous.productUrl);
    const incoming = verifiedByUrl.get(key);
    if (!incoming) continue;
    refreshed.push(mergeProductRecords(previous, incoming));
    verifiedByUrl.delete(key);
  }
  for (const incoming of input.verified) {
    const key = normalizeProductUrl(incoming.productUrl);
    if (!verifiedByUrl.has(key)) continue;
    refreshed.push(incoming);
    verifiedByUrl.delete(key);
  }

  const firstSourceIndex = input.existing.findIndex(
    (product) => normalizeMarketplaceSourceId(product.source) === sourceId,
  );
  const withoutSource = input.existing.filter(
    (product) => normalizeMarketplaceSourceId(product.source) !== sourceId,
  );
  const insertionIndex = firstSourceIndex < 0 ? withoutSource.length : firstSourceIndex;
  return [
    ...withoutSource.slice(0, insertionIndex),
    ...refreshed,
    ...withoutSource.slice(insertionIndex),
  ];
}
