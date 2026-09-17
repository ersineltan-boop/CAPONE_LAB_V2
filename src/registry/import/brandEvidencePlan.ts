export const BRAND_EVIDENCE_SCOPES = [
  "OFFICIAL_BRAND",
  "MARKETPLACE",
  "MARKET_RESEARCH",
] as const;

export type BrandEvidenceScope = (typeof BRAND_EVIDENCE_SCOPES)[number];
export type BrandAttemptStatus = "SUCCEEDED" | "FAILED" | "UNAVAILABLE";

export interface BrandRefreshEvidence {
  brand: string;
  slug: string;
  priority: number;
  sourceUrl: string;
  sourceScope: BrandEvidenceScope;
  status: BrandAttemptStatus;
  attemptedAt: string;
  snapshotId: string | null;
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
  sourceUrl: string;
  snapshotId: string;
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
  priority: number;
  sourceUrl: string;
  state: BrandQueueState;
  sourceTotal: number | null;
  collected: number;
  missing: number | null;
  coverage: number | null;
  lastGoodRetained: boolean;
  reason: string | null;
}

export interface RejectedBrandEvidence {
  brand: string;
  slug: string;
  sourceScope: BrandEvidenceScope;
  reason: "NON_OFFICIAL_SOURCE" | "SUPERSEDED_ATTEMPT";
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

function finiteNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && Number.isFinite(value) && value >= 0;
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

function sortQueue(items: BrandEvidenceQueueItem[]): BrandEvidenceQueueItem[] {
  return items.sort((left, right) =>
    left.priority === right.priority
      ? left.slug.localeCompare(right.slug)
      : left.priority - right.priority,
  );
}

function planItem(
  evidence: BrandRefreshEvidence,
  state: BrandQueueState,
  lastGoodRetained: boolean,
  reason: string | null,
): BrandEvidenceQueueItem {
  const missing =
    evidence.sourceTotal === null
      ? null
      : Math.max(0, evidence.sourceTotal - evidence.collected);
  return {
    brand: evidence.brand,
    slug: evidence.slug,
    priority: evidence.priority,
    sourceUrl: evidence.sourceUrl,
    state,
    sourceTotal: evidence.sourceTotal,
    collected: evidence.collected,
    missing,
    coverage: coverageFor(evidence),
    lastGoodRetained,
    reason,
  };
}

function evidenceBlocker(evidence: BrandRefreshEvidence): string | null {
  if (!sourceUrlIsHttps(evidence.sourceUrl)) return "OFFICIAL_URL_MUST_BE_HTTPS";
  if (!evidence.snapshotId?.trim()) return "MISSING_SNAPSHOT_ID";
  if (!evidence.womenFootwearOnly) return "WOMENS_FOOTWEAR_SCOPE_NOT_VERIFIED";
  if (evidence.sourceTotal === null || !finiteNonNegativeInteger(evidence.sourceTotal)) {
    return "SOURCE_TOTAL_NOT_VERIFIED";
  }
  if (!finiteNonNegativeInteger(evidence.collected)) return "INVALID_COLLECTED_COUNT";
  if (evidence.sourceTotal === 0 || evidence.collected !== evidence.sourceTotal) {
    return "FULL_CATALOG_COVERAGE_NOT_VERIFIED";
  }
  if (!finiteNonNegativeInteger(evidence.galleryComplete)) {
    return "INVALID_GALLERY_COUNT";
  }
  if (evidence.galleryComplete !== evidence.collected) return "GALLERY_QA_INCOMPLETE";
  if (!evidence.taxonomyPassed) return "TAXONOMY_QA_FAILED";
  return null;
}

function latestOfficialAttempts(
  evidence: readonly BrandRefreshEvidence[],
  rejectedEvidence: RejectedBrandEvidence[],
): BrandRefreshEvidence[] {
  const bySlug = new Map<string, BrandRefreshEvidence>();
  for (const item of evidence) {
    if (item.sourceScope !== "OFFICIAL_BRAND") {
      rejectedEvidence.push({
        brand: item.brand,
        slug: item.slug,
        sourceScope: item.sourceScope,
        reason: "NON_OFFICIAL_SOURCE",
      });
      continue;
    }

    const previous = bySlug.get(item.slug);
    if (!previous || item.attemptedAt > previous.attemptedAt) {
      if (previous) {
        rejectedEvidence.push({
          brand: previous.brand,
          slug: previous.slug,
          sourceScope: previous.sourceScope,
          reason: "SUPERSEDED_ATTEMPT",
        });
      }
      bySlug.set(item.slug, item);
    } else {
      rejectedEvidence.push({
        brand: item.brand,
        slug: item.slug,
        sourceScope: item.sourceScope,
        reason: "SUPERSEDED_ATTEMPT",
      });
    }
  }
  return [...bySlug.values()];
}

export function planBrandUniverseQueue(input: {
  evidence: readonly BrandRefreshEvidence[];
  previousLastGood?: Readonly<Record<string, BrandLastGoodSnapshot>>;
}): BrandUniverseQueuePlan {
  const lastGoodBySlug: Record<string, BrandLastGoodSnapshot> = {
    ...(input.previousLastGood ?? {}),
  };
  const stagingQueue: BrandEvidenceQueueItem[] = [];
  const adapterQueue: BrandEvidenceQueueItem[] = [];
  const reviewQueue: BrandEvidenceQueueItem[] = [];
  const rejectedEvidence: RejectedBrandEvidence[] = [];
  const officialAttempts = latestOfficialAttempts(input.evidence, rejectedEvidence);

  for (const evidence of officialAttempts) {
    const hasLastGood = lastGoodBySlug[evidence.slug] !== undefined;

    if (evidence.customAdapterRequired) {
      adapterQueue.push(
        planItem(
          evidence,
          "CUSTOM_ADAPTER_REQUIRED",
          hasLastGood,
          evidence.blocker ?? "CUSTOM_ADAPTER_REQUIRED",
        ),
      );
      continue;
    }

    if (evidence.status !== "SUCCEEDED") {
      reviewQueue.push(
        planItem(
          evidence,
          hasLastGood ? "LAST_GOOD_RETAINED" : "BLOCKED",
          hasLastGood,
          evidence.blocker ?? `REFRESH_${evidence.status}`,
        ),
      );
      continue;
    }

    const blocker = evidenceBlocker(evidence);
    if (blocker) {
      reviewQueue.push(
        planItem(
          evidence,
          hasLastGood ? "LAST_GOOD_RETAINED" : "BLOCKED",
          hasLastGood,
          blocker,
        ),
      );
      continue;
    }

    const sourceTotal = evidence.sourceTotal as number;
    const snapshotId = evidence.snapshotId as string;
    lastGoodBySlug[evidence.slug] = {
      slug: evidence.slug,
      sourceUrl: evidence.sourceUrl,
      snapshotId,
      sourceTotal,
      collected: evidence.collected,
      succeededAt: evidence.attemptedAt,
    };
    stagingQueue.push(planItem(evidence, "STAGING_READY", false, null));
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
      sourceRejected: rejectedEvidence.filter(
        (item) => item.reason === "NON_OFFICIAL_SOURCE",
      ).length,
      activationChanges: 0,
    },
  };
}
