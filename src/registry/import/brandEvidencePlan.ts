export const BRAND_EVIDENCE_SCOPES = [
  "OFFICIAL_BRAND",
  "MARKETPLACE",
  "MARKET_RESEARCH",
] as const;

export type BrandEvidenceScope = (typeof BRAND_EVIDENCE_SCOPES)[number];
export type BrandAttemptStatus = "SUCCEEDED" | "FAILED" | "UNAVAILABLE";
export type BrandSourceChannel = "official-brand" | "marketplace" | "market-research";

export const BRAND_SOURCE_SCOPE_BY_CHANNEL: Readonly<Record<BrandSourceChannel, BrandEvidenceScope>> = {
  "official-brand": "OFFICIAL_BRAND",
  marketplace: "MARKETPLACE",
  "market-research": "MARKET_RESEARCH",
};

export interface BrandRefreshEvidence {
  brand: string;
  /** Brand identity. It is canonicalized before deduplication and output. */
  slug: string;
  /** Collector/source identity. It is canonicalized independently from the brand. */
  sourceSlug: string;
  priority: number;
  sourceUrl: string;
  sourceScope: BrandEvidenceScope;
  status: BrandAttemptStatus;
  attemptedAt: string;
  /** Snapshot asserted by the evidence record. */
  snapshotId: string | null;
  /** Snapshot emitted by the product refresh plan; must equal snapshotId. */
  productSnapshotId: string | null;
  womenFootwearOnly: boolean;
  sourceTotal: number | null;
  collected: number;
  galleryComplete: number;
  taxonomyPassed: boolean;
  customAdapterRequired?: boolean;
  blocker?: string | null;
}

export interface BrandLastGoodSnapshot {
  slug: string;
  sourceSlug: string;
  sourceScope: "OFFICIAL_BRAND";
  sourceUrl: string;
  snapshotId: string;
  productSnapshotId: string;
  sourceTotal: number;
  collected: number;
  succeededAt: string;
}

export type BrandQueueState =
  | "STAGING_READY"
  | "CUSTOM_ADAPTER_REQUIRED"
  | "BLOCKED"
  | "LAST_GOOD_RETAINED";

export interface BrandEvidenceQueueItem {
  brand: string;
  slug: string;
  sourceSlug: string;
  sourceScope: BrandEvidenceScope;
  priority: number;
  sourceUrl: string;
  snapshotId: string | null;
  productSnapshotId: string | null;
  state: BrandQueueState;
  sourceTotal: number | null;
  collected: number;
  missing: number | null;
  coverage: number | null;
  dropPercent: number | null;
  lastGoodRetained: boolean;
  reason: string | null;
}

export type RejectedBrandEvidenceReason =
  | "NON_OFFICIAL_SOURCE"
  | "INVALID_ATTEMPTED_AT"
  | "INVALID_BRAND_SLUG"
  | "INVALID_SOURCE_SLUG"
  | "SUPERSEDED_ATTEMPT";

export interface RejectedBrandEvidence {
  brand: string;
  slug: string;
  sourceSlug: string;
  sourceScope: BrandEvidenceScope;
  reason: RejectedBrandEvidenceReason;
}

export interface BrandUniverseQueuePlan {
  stagingQueue: BrandEvidenceQueueItem[];
  adapterQueue: BrandEvidenceQueueItem[];
  reviewQueue: BrandEvidenceQueueItem[];
  rejectedEvidence: RejectedBrandEvidence[];
  lastGoodBySlug: Record<string, BrandLastGoodSnapshot>;
  summary: {
    attempted: number;
    officialAttempts: number;
    succeeded: number;
    failed: number;
    unavailable: number;
    stagingReady: number;
    adapterQueue: number;
    blocked: number;
    sourceRejected: number;
    activationChanges: 0;
  };
}

/**
 * Structural subset of PR #38's SourceRefreshPlan. Keeping this contract local lets
 * this branch remain unstacked; replace it with a type-only import after #38 lands.
 */
export interface SourceRefreshPlanContract {
  status:
    | "RUNNER_NOT_STARTED"
    | "SOURCE_UNAVAILABLE"
    | "COLLECT_FAILED"
    | "VALIDATION_FAILED"
    | "PUBLISH_FAILED"
    | "SUCCESS";
  health: {
    source_total: number;
    collected: number;
    last_attempt_at: string;
    failure_reason: string | null;
  };
  proposedLastGood: {
    snapshot: {
      snapshotId: string;
      sourceId: string;
      collectedAt: string;
      items: readonly unknown[];
    };
  } | null;
  publishAllowed: boolean;
}

export interface BrandRefreshAdapterMetadata {
  brand: string;
  slug: string;
  priority: number;
  sourceUrl: string;
  sourceChannel: BrandSourceChannel;
  womenFootwearOnly: boolean;
  galleryComplete: number;
  taxonomyPassed: boolean;
  customAdapterRequired?: boolean;
  blocker?: string | null;
}

const round = (value: number): number => Math.round(value * 100) / 100;

export function canonicalizeBrandSourceSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function canonicalBrandName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function strictIsoInstant(value: string): boolean {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function finiteNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && Number.isFinite(value) && value >= 0;
}

function normalizedEvidence(item: BrandRefreshEvidence): BrandRefreshEvidence {
  return {
    ...item,
    brand: canonicalBrandName(item.brand),
    slug: canonicalizeBrandSourceSlug(item.slug || item.brand),
    sourceSlug: canonicalizeBrandSourceSlug(item.sourceSlug),
  };
}

function coverageFor(evidence: BrandRefreshEvidence): number | null {
  if (!evidence.sourceTotal || evidence.sourceTotal <= 0) return null;
  return evidence.collected / evidence.sourceTotal;
}

function sourceUrlIsHttps(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function dropPercentFor(
  evidence: BrandRefreshEvidence,
  previous: BrandLastGoodSnapshot | undefined,
): number | null {
  if (!previous || previous.collected <= 0 || !finiteNonNegativeInteger(evidence.collected)) {
    return null;
  }
  return round(((previous.collected - evidence.collected) / previous.collected) * 100);
}

function sortQueue(items: BrandEvidenceQueueItem[]): BrandEvidenceQueueItem[] {
  return items.sort((left, right) =>
    left.priority === right.priority
      ? left.slug.localeCompare(right.slug)
      : left.priority - right.priority,
  );
}

function planItem(
  evidence: BrandRefreshEvidence,
  previous: BrandLastGoodSnapshot | undefined,
  state: BrandQueueState,
  lastGoodRetained: boolean,
  reason: string | null,
): BrandEvidenceQueueItem {
  const missing = evidence.sourceTotal === null
    ? null
    : Math.max(0, evidence.sourceTotal - evidence.collected);
  return {
    brand: evidence.brand,
    slug: evidence.slug,
    sourceSlug: evidence.sourceSlug,
    sourceScope: evidence.sourceScope,
    priority: evidence.priority,
    sourceUrl: evidence.sourceUrl,
    snapshotId: evidence.snapshotId,
    productSnapshotId: evidence.productSnapshotId,
    state,
    sourceTotal: evidence.sourceTotal,
    collected: evidence.collected,
    missing,
    coverage: coverageFor(evidence),
    dropPercent: dropPercentFor(evidence, previous),
    lastGoodRetained,
    reason,
  };
}

function evidenceBlocker(
  evidence: BrandRefreshEvidence,
  previous: BrandLastGoodSnapshot | undefined,
  maxDropPercent: number,
): string | null {
  if (!strictIsoInstant(evidence.attemptedAt)) return "INVALID_ATTEMPTED_AT";
  if (!sourceUrlIsHttps(evidence.sourceUrl)) return "OFFICIAL_URL_MUST_BE_HTTPS";
  if (!evidence.snapshotId?.trim()) return "MISSING_SNAPSHOT_ID";
  if (!evidence.productSnapshotId?.trim()) return "MISSING_PRODUCT_SNAPSHOT_ID";
  if (evidence.snapshotId !== evidence.productSnapshotId) return "SNAPSHOT_BINDING_MISMATCH";
  if (!evidence.womenFootwearOnly) return "WOMENS_FOOTWEAR_SCOPE_NOT_VERIFIED";
  if (evidence.sourceTotal === null || !finiteNonNegativeInteger(evidence.sourceTotal)) {
    return "SOURCE_TOTAL_NOT_VERIFIED";
  }
  if (!finiteNonNegativeInteger(evidence.collected)) return "INVALID_COLLECTED_COUNT";
  if (evidence.sourceTotal === 0 || evidence.collected !== evidence.sourceTotal) {
    return "FULL_CATALOG_COVERAGE_NOT_VERIFIED";
  }
  const dropPercent = dropPercentFor(evidence, previous);
  if (dropPercent !== null && dropPercent > maxDropPercent) {
    return "CATASTROPHIC_CATALOG_DROP";
  }
  if (!finiteNonNegativeInteger(evidence.galleryComplete)) return "INVALID_GALLERY_COUNT";
  if (evidence.galleryComplete !== evidence.collected) return "GALLERY_QA_INCOMPLETE";
  if (!evidence.taxonomyPassed) return "TAXONOMY_QA_FAILED";
  return null;
}

function reject(
  item: BrandRefreshEvidence,
  reason: RejectedBrandEvidenceReason,
): RejectedBrandEvidence {
  return {
    brand: item.brand,
    slug: item.slug,
    sourceSlug: item.sourceSlug,
    sourceScope: item.sourceScope,
    reason,
  };
}

function latestOfficialAttempts(
  evidence: readonly BrandRefreshEvidence[],
  rejectedEvidence: RejectedBrandEvidence[],
): BrandRefreshEvidence[] {
  const bySlug = new Map<string, BrandRefreshEvidence>();
  for (const rawItem of evidence) {
    const item = normalizedEvidence(rawItem);
    if (!item.slug) {
      rejectedEvidence.push(reject(item, "INVALID_BRAND_SLUG"));
      continue;
    }
    if (!item.sourceSlug) {
      rejectedEvidence.push(reject(item, "INVALID_SOURCE_SLUG"));
      continue;
    }
    if (!strictIsoInstant(item.attemptedAt)) {
      rejectedEvidence.push(reject(item, "INVALID_ATTEMPTED_AT"));
      continue;
    }
    if (item.sourceScope !== "OFFICIAL_BRAND") {
      rejectedEvidence.push(reject(item, "NON_OFFICIAL_SOURCE"));
      continue;
    }

    const previous = bySlug.get(item.slug);
    if (!previous || Date.parse(item.attemptedAt) > Date.parse(previous.attemptedAt)) {
      if (previous) rejectedEvidence.push(reject(previous, "SUPERSEDED_ATTEMPT"));
      bySlug.set(item.slug, item);
    } else {
      rejectedEvidence.push(reject(item, "SUPERSEDED_ATTEMPT"));
    }
  }
  return [...bySlug.values()];
}

function normalizeLastGood(
  previous: Readonly<Record<string, BrandLastGoodSnapshot>> | undefined,
): Record<string, BrandLastGoodSnapshot> {
  const result: Record<string, BrandLastGoodSnapshot> = {};
  for (const [key, snapshot] of Object.entries(previous ?? {})) {
    const slug = canonicalizeBrandSourceSlug(snapshot.slug || key);
    const sourceSlug = canonicalizeBrandSourceSlug(snapshot.sourceSlug);
    if (!slug || !sourceSlug) continue;
    result[slug] = { ...snapshot, slug, sourceSlug, sourceScope: "OFFICIAL_BRAND" };
  }
  return result;
}

export function adaptSourceRefreshPlanToBrandEvidence(
  metadata: BrandRefreshAdapterMetadata,
  plan: SourceRefreshPlanContract,
): BrandRefreshEvidence {
  const snapshot = plan.proposedLastGood?.snapshot ?? null;
  const succeeded = plan.status === "SUCCESS" && plan.publishAllowed && snapshot !== null;
  const status: BrandAttemptStatus = succeeded
    ? "SUCCEEDED"
    : plan.status === "SOURCE_UNAVAILABLE"
      ? "UNAVAILABLE"
      : "FAILED";
  const productSnapshotId = snapshot?.snapshotId ?? null;

  return normalizedEvidence({
    brand: metadata.brand,
    slug: metadata.slug,
    sourceSlug: snapshot?.sourceId ?? metadata.slug,
    priority: metadata.priority,
    sourceUrl: metadata.sourceUrl,
    sourceScope: BRAND_SOURCE_SCOPE_BY_CHANNEL[metadata.sourceChannel],
    status,
    attemptedAt: plan.health.last_attempt_at,
    snapshotId: productSnapshotId,
    productSnapshotId,
    womenFootwearOnly: metadata.womenFootwearOnly,
    sourceTotal: Number.isInteger(plan.health.source_total) ? plan.health.source_total : null,
    collected: plan.health.collected,
    galleryComplete: metadata.galleryComplete,
    taxonomyPassed: metadata.taxonomyPassed,
    customAdapterRequired: metadata.customAdapterRequired,
    blocker: metadata.blocker ?? plan.health.failure_reason,
  });
}

export function planBrandUniverseQueue(input: {
  evidence: readonly BrandRefreshEvidence[];
  previousLastGood?: Readonly<Record<string, BrandLastGoodSnapshot>>;
  /** Maximum accepted decline from previous last-good collected count. Default: 40%. */
  maxDropPercent?: number;
}): BrandUniverseQueuePlan {
  const maxDropPercent = input.maxDropPercent ?? 40;
  if (!Number.isFinite(maxDropPercent) || maxDropPercent < 0 || maxDropPercent > 100) {
    throw new RangeError("maxDropPercent must be between 0 and 100");
  }

  const lastGoodBySlug = normalizeLastGood(input.previousLastGood);
  const stagingQueue: BrandEvidenceQueueItem[] = [];
  const adapterQueue: BrandEvidenceQueueItem[] = [];
  const reviewQueue: BrandEvidenceQueueItem[] = [];
  const rejectedEvidence: RejectedBrandEvidence[] = [];
  const officialAttempts = latestOfficialAttempts(input.evidence, rejectedEvidence);

  for (const evidence of officialAttempts) {
    const previous = lastGoodBySlug[evidence.slug];
    const hasLastGood = previous !== undefined;

    if (evidence.customAdapterRequired) {
      adapterQueue.push(planItem(
        evidence,
        previous,
        "CUSTOM_ADAPTER_REQUIRED",
        hasLastGood,
        evidence.blocker ?? "CUSTOM_ADAPTER_REQUIRED",
      ));
      continue;
    }

    if (evidence.status !== "SUCCEEDED") {
      reviewQueue.push(planItem(
        evidence,
        previous,
        hasLastGood ? "LAST_GOOD_RETAINED" : "BLOCKED",
        hasLastGood,
        evidence.blocker ?? `REFRESH_${evidence.status}`,
      ));
      continue;
    }

    const blocker = evidenceBlocker(evidence, previous, maxDropPercent);
    if (blocker) {
      reviewQueue.push(planItem(
        evidence,
        previous,
        hasLastGood ? "LAST_GOOD_RETAINED" : "BLOCKED",
        hasLastGood,
        blocker,
      ));
      continue;
    }

    const sourceTotal = evidence.sourceTotal as number;
    const snapshotId = evidence.snapshotId as string;
    const productSnapshotId = evidence.productSnapshotId as string;
    lastGoodBySlug[evidence.slug] = {
      slug: evidence.slug,
      sourceSlug: evidence.sourceSlug,
      sourceScope: "OFFICIAL_BRAND",
      sourceUrl: evidence.sourceUrl,
      snapshotId,
      productSnapshotId,
      sourceTotal,
      collected: evidence.collected,
      succeededAt: evidence.attemptedAt,
    };
    stagingQueue.push(planItem(evidence, previous, "STAGING_READY", false, null));
  }

  return {
    stagingQueue: sortQueue(stagingQueue),
    adapterQueue: sortQueue(adapterQueue),
    reviewQueue: sortQueue(reviewQueue),
    rejectedEvidence,
    lastGoodBySlug,
    summary: {
      attempted: input.evidence.length,
      officialAttempts: officialAttempts.length,
      succeeded: officialAttempts.filter((item) => item.status === "SUCCEEDED").length,
      failed: officialAttempts.filter((item) => item.status === "FAILED").length,
      unavailable: officialAttempts.filter((item) => item.status === "UNAVAILABLE").length,
      stagingReady: stagingQueue.length,
      adapterQueue: adapterQueue.length,
      blocked: reviewQueue.length,
      sourceRejected: rejectedEvidence.filter((item) => item.reason === "NON_OFFICIAL_SOURCE").length,
      activationChanges: 0,
    },
  };
}
