import { describe, expect, it } from "vitest";

import {
  adaptSourceRefreshPlanToBrandEvidence,
  canonicalizeBrandSourceSlug,
  planBrandUniverseQueue,
  type BrandLastGoodSnapshot,
  type BrandRefreshEvidence,
  type SourceRefreshPlanContract,
} from "../import/brandEvidencePlan";

function completeEvidence(
  overrides: Partial<BrandRefreshEvidence> = {},
): BrandRefreshEvidence {
  return {
    brand: "NAKED WOLFE",
    slug: "naked-wolfe",
    sourceSlug: "naked-wolfe",
    priority: 0,
    sourceUrl: "https://nakedwolfe.com/collections/view-all-womens",
    sourceScope: "OFFICIAL_BRAND",
    status: "SUCCEEDED",
    attemptedAt: "2026-09-17T10:00:00.000Z",
    snapshotId: "naked-wolfe:2026-09-17T10:00:00.000Z",
    productSnapshotId: "naked-wolfe:2026-09-17T10:00:00.000Z",
    womenFootwearOnly: true,
    sourceTotal: 24,
    collected: 24,
    galleryComplete: 24,
    taxonomyPassed: true,
    ...overrides,
  };
}

function lastGood(overrides: Partial<BrandLastGoodSnapshot> = {}): BrandLastGoodSnapshot {
  return {
    slug: "naked-wolfe",
    sourceSlug: "naked-wolfe",
    sourceScope: "OFFICIAL_BRAND",
    sourceUrl: "https://nakedwolfe.com/collections/view-all-womens",
    snapshotId: "naked-wolfe:last-good",
    productSnapshotId: "naked-wolfe:last-good",
    sourceTotal: 100,
    collected: 100,
    succeededAt: "2026-09-16T10:00:00.000Z",
    ...overrides,
  };
}

function refreshPlan(
  overrides: Partial<SourceRefreshPlanContract> = {},
): SourceRefreshPlanContract {
  return {
    status: "SUCCESS",
    health: {
      source_total: 24,
      collected: 24,
      last_attempt_at: "2026-09-17T10:00:00.000Z",
      failure_reason: null,
    },
    proposedLastGood: {
      snapshot: {
        snapshotId: "Naked Wölfe:2026-09-17T10:00:00.000Z",
        sourceId: "Naked Wölfe",
        collectedAt: "2026-09-17T10:00:00.000Z",
        items: Array.from({ length: 24 }),
      },
    },
    publishAllowed: true,
    ...overrides,
  };
}

describe("brand universe evidence queue", () => {
  it("queues complete official evidence and binds its product snapshot without activation", () => {
    const plan = planBrandUniverseQueue({ evidence: [completeEvidence()] });

    expect(plan.stagingQueue).toEqual([
      expect.objectContaining({
        slug: "naked-wolfe",
        sourceSlug: "naked-wolfe",
        sourceScope: "OFFICIAL_BRAND",
        snapshotId: "naked-wolfe:2026-09-17T10:00:00.000Z",
        productSnapshotId: "naked-wolfe:2026-09-17T10:00:00.000Z",
        state: "STAGING_READY",
        missing: 0,
        coverage: 1,
      }),
    ]);
    expect(plan.summary.activationChanges).toBe(0);
  });

  it("canonicalizes brand and source slugs before deduplication and last-good lookup", () => {
    const plan = planBrandUniverseQueue({
      previousLastGood: {
        "NAKED WÖLFE": lastGood({ slug: "NAKED WÖLFE", sourceTotal: 24, collected: 24 }),
      },
      evidence: [
        completeEvidence({ slug: " Naked Wölfe ", sourceSlug: " NAKED_WÖLFE ", priority: 2 }),
        completeEvidence({
          slug: "naked--wolfe",
          sourceSlug: "naked-wolfe",
          attemptedAt: "2026-09-17T09:00:00.000Z",
        }),
      ],
    });

    expect(canonicalizeBrandSourceSlug(" NAKED_WÖLFE ")).toBe("naked-wolfe");
    expect(plan.stagingQueue[0]).toEqual(expect.objectContaining({
      slug: "naked-wolfe",
      sourceSlug: "naked-wolfe",
    }));
    expect(plan.rejectedEvidence).toContainEqual(expect.objectContaining({
      slug: "naked-wolfe",
      reason: "SUPERSEDED_ATTEMPT",
    }));
  });

  it("rejects malformed and merely parseable non-canonical attemptedAt values", () => {
    const plan = planBrandUniverseQueue({
      evidence: [
        completeEvidence({ attemptedAt: "not-a-date" }),
        completeEvidence({
          slug: "second-brand",
          sourceSlug: "second-brand",
          attemptedAt: "2026-09-17T10:00:00Z",
        }),
      ],
    });

    expect(plan.stagingQueue).toHaveLength(0);
    expect(plan.rejectedEvidence.map((item) => item.reason)).toEqual([
      "INVALID_ATTEMPTED_AT",
      "INVALID_ATTEMPTED_AT",
    ]);
  });

  it("blocks snapshot evidence that is not bound to the product snapshot", () => {
    const plan = planBrandUniverseQueue({
      evidence: [completeEvidence({ productSnapshotId: "different-product-snapshot" })],
    });

    expect(plan.reviewQueue).toEqual([
      expect.objectContaining({ state: "BLOCKED", reason: "SNAPSHOT_BINDING_MISMATCH" }),
    ]);
    expect(plan.lastGoodBySlug).toEqual({});
  });

  it("blocks a catastrophic drop against the prior last-good snapshot", () => {
    const previous = lastGood();
    const plan = planBrandUniverseQueue({
      previousLastGood: { "naked-wolfe": previous },
      evidence: [completeEvidence({ sourceTotal: 39, collected: 39, galleryComplete: 39 })],
      maxDropPercent: 40,
    });

    expect(plan.stagingQueue).toHaveLength(0);
    expect(plan.reviewQueue).toEqual([
      expect.objectContaining({
        state: "LAST_GOOD_RETAINED",
        reason: "CATASTROPHIC_CATALOG_DROP",
        dropPercent: 61,
      }),
    ]);
    expect(plan.lastGoodBySlug["naked-wolfe"]).toEqual(previous);
  });

  it("allows a decline exactly at the configured threshold", () => {
    const plan = planBrandUniverseQueue({
      previousLastGood: { "naked-wolfe": lastGood() },
      evidence: [completeEvidence({ sourceTotal: 60, collected: 60, galleryComplete: 60 })],
      maxDropPercent: 40,
    });

    expect(plan.stagingQueue[0]).toEqual(expect.objectContaining({ dropPercent: 40 }));
    expect(plan.reviewQueue).toHaveLength(0);
  });

  it("never mixes marketplace or market-research evidence into the brand queue", () => {
    const plan = planBrandUniverseQueue({
      evidence: [
        completeEvidence({ sourceScope: "MARKETPLACE", sourceSlug: "free-people" }),
        completeEvidence({
          sourceScope: "MARKET_RESEARCH",
          sourceSlug: "papucei",
          slug: "papucei",
        }),
      ],
    });

    expect(plan.stagingQueue).toHaveLength(0);
    expect(plan.rejectedEvidence).toEqual([
      expect.objectContaining({ sourceScope: "MARKETPLACE", sourceSlug: "free-people", reason: "NON_OFFICIAL_SOURCE" }),
      expect.objectContaining({ sourceScope: "MARKET_RESEARCH", sourceSlug: "papucei", reason: "NON_OFFICIAL_SOURCE" }),
    ]);
  });

  it("keeps last-good after a failed refresh and continues with the next brand", () => {
    const previous = lastGood({ sourceTotal: 23, collected: 23 });
    const plan = planBrandUniverseQueue({
      previousLastGood: { "naked-wolfe": previous },
      evidence: [
        completeEvidence({
          status: "FAILED",
          snapshotId: null,
          productSnapshotId: null,
          sourceTotal: null,
          collected: 0,
          galleryComplete: 0,
          taxonomyPassed: false,
          blocker: "HTTP_403",
        }),
        completeEvidence({
          brand: "NEXT OFFICIAL BRAND",
          slug: "next-official-brand",
          sourceSlug: "next-official-brand",
          priority: 1,
          sourceUrl: "https://example.com/collections/womens-shoes",
          snapshotId: "next-1",
          productSnapshotId: "next-1",
        }),
      ],
    });

    expect(plan.reviewQueue[0]).toEqual(expect.objectContaining({
      slug: "naked-wolfe",
      state: "LAST_GOOD_RETAINED",
      reason: "HTTP_403",
    }));
    expect(plan.lastGoodBySlug["naked-wolfe"]).toEqual(previous);
    expect(plan.stagingQueue.map((item) => item.slug)).toEqual(["next-official-brand"]);
  });

  it("separates custom adapters and blocks incomplete coverage", () => {
    const plan = planBrandUniverseQueue({
      evidence: [
        completeEvidence({ customAdapterRequired: true, blocker: "CUSTOM_STOREFRONT" }),
        completeEvidence({
          brand: "PARTIAL BRAND",
          slug: "partial-brand",
          sourceSlug: "partial-brand",
          priority: 1,
          sourceUrl: "https://example.org/collections/womens-shoes",
          snapshotId: "partial-1",
          productSnapshotId: "partial-1",
          sourceTotal: 20,
          collected: 19,
          galleryComplete: 19,
        }),
      ],
    });

    expect(plan.adapterQueue.map((item) => item.slug)).toEqual(["naked-wolfe"]);
    expect(plan.reviewQueue).toEqual([
      expect.objectContaining({ reason: "FULL_CATALOG_COVERAGE_NOT_VERIFIED" }),
    ]);
  });

  it("adapts PR #38's SourceRefreshPlan shape and preserves channel routing", () => {
    const official = adaptSourceRefreshPlanToBrandEvidence({
      brand: "Naked Wölfe",
      slug: "Naked Wölfe",
      priority: 0,
      sourceUrl: "https://nakedwolfe.com/collections/view-all-womens",
      sourceChannel: "official-brand",
      womenFootwearOnly: true,
      galleryComplete: 24,
      taxonomyPassed: true,
    }, refreshPlan());
    const marketplace = adaptSourceRefreshPlanToBrandEvidence({
      brand: "Free People",
      slug: "Free People",
      priority: 1,
      sourceUrl: "https://freepeople.com/shoes",
      sourceChannel: "marketplace",
      womenFootwearOnly: true,
      galleryComplete: 24,
      taxonomyPassed: true,
    }, refreshPlan());

    expect(official).toEqual(expect.objectContaining({
      slug: "naked-wolfe",
      sourceSlug: "naked-wolfe",
      sourceScope: "OFFICIAL_BRAND",
      snapshotId: "Naked Wölfe:2026-09-17T10:00:00.000Z",
      productSnapshotId: "Naked Wölfe:2026-09-17T10:00:00.000Z",
    }));
    expect(marketplace.sourceScope).toBe("MARKETPLACE");
    expect(planBrandUniverseQueue({ evidence: [official, marketplace] }).summary.sourceRejected).toBe(1);
  });

  it("fails closed for an invalid catastrophic-drop threshold", () => {
    expect(() => planBrandUniverseQueue({
      evidence: [completeEvidence()],
      maxDropPercent: 101,
    })).toThrow("maxDropPercent must be between 0 and 100");
  });
});
