import { describe, expect, it } from "vitest";

import {
  planBrandUniverseQueue,
  type BrandLastGoodSnapshot,
  type BrandRefreshEvidence,
} from "../import/brandEvidencePlan";

function completeEvidence(
  overrides: Partial<BrandRefreshEvidence> = {},
): BrandRefreshEvidence {
  return {
    brand: "NAKED WOLFE",
    slug: "naked-wolfe",
    priority: 0,
    sourceUrl: "https://nakedwolfe.com/collections/view-all-womens",
    sourceScope: "OFFICIAL_BRAND",
    status: "SUCCEEDED",
    attemptedAt: "2026-09-17T10:00:00.000Z",
    snapshotId: "naked-wolfe-2026-09-17",
    womenFootwearOnly: true,
    sourceTotal: 24,
    collected: 24,
    galleryComplete: 24,
    taxonomyPassed: true,
    ...overrides,
  };
}

describe("brand universe evidence queue", () => {
  it("queues complete official women's footwear evidence for staging without activation", () => {
    const plan = planBrandUniverseQueue({ evidence: [completeEvidence()] });

    expect(plan.stagingQueue).toEqual([
      expect.objectContaining({
        slug: "naked-wolfe",
        state: "STAGING_READY",
        sourceTotal: 24,
        collected: 24,
        missing: 0,
        coverage: 1,
      }),
    ]);
    expect(plan.lastGoodBySlug["naked-wolfe"]?.snapshotId).toBe(
      "naked-wolfe-2026-09-17",
    );
    expect(plan.summary.activationChanges).toBe(0);
  });

  it("never mixes marketplace or market-research evidence into the brand queue", () => {
    const plan = planBrandUniverseQueue({
      evidence: [
        completeEvidence({ sourceScope: "MARKETPLACE" }),
        completeEvidence({ sourceScope: "MARKET_RESEARCH" }),
      ],
    });

    expect(plan.stagingQueue).toHaveLength(0);
    expect(plan.lastGoodBySlug).toEqual({});
    expect(plan.rejectedEvidence).toHaveLength(2);
    expect(plan.rejectedEvidence.every((item) => item.reason === "NON_OFFICIAL_SOURCE")).toBe(
      true,
    );
  });

  it("keeps last-good after a failed refresh and continues with the next brand", () => {
    const lastGood: BrandLastGoodSnapshot = {
      slug: "naked-wolfe",
      sourceUrl: "https://nakedwolfe.com/collections/view-all-womens",
      snapshotId: "naked-wolfe-last-good",
      sourceTotal: 23,
      collected: 23,
      succeededAt: "2026-09-16T10:00:00.000Z",
    };
    const plan = planBrandUniverseQueue({
      previousLastGood: { "naked-wolfe": lastGood },
      evidence: [
        completeEvidence({
          status: "FAILED",
          snapshotId: null,
          sourceTotal: null,
          collected: 0,
          galleryComplete: 0,
          taxonomyPassed: false,
          blocker: "HTTP_403",
        }),
        completeEvidence({
          brand: "NEXT OFFICIAL BRAND",
          slug: "next-official-brand",
          priority: 1,
          sourceUrl: "https://example.com/collections/womens-shoes",
          snapshotId: "next-1",
        }),
      ],
    });

    expect(plan.reviewQueue[0]).toEqual(
      expect.objectContaining({
        slug: "naked-wolfe",
        state: "LAST_GOOD_RETAINED",
        lastGoodRetained: true,
        reason: "HTTP_403",
      }),
    );
    expect(plan.lastGoodBySlug["naked-wolfe"]).toEqual(lastGood);
    expect(plan.stagingQueue.map((item) => item.slug)).toEqual(["next-official-brand"]);
  });

  it("separates custom adapters and blocks incomplete coverage/gallery evidence", () => {
    const plan = planBrandUniverseQueue({
      evidence: [
        completeEvidence({ customAdapterRequired: true, blocker: "CUSTOM_STOREFRONT" }),
        completeEvidence({
          brand: "PARTIAL BRAND",
          slug: "partial-brand",
          priority: 1,
          sourceUrl: "https://example.org/collections/womens-shoes",
          snapshotId: "partial-1",
          sourceTotal: 20,
          collected: 19,
          galleryComplete: 19,
        }),
      ],
    });

    expect(plan.adapterQueue.map((item) => item.slug)).toEqual(["naked-wolfe"]);
    expect(plan.reviewQueue).toEqual([
      expect.objectContaining({
        slug: "partial-brand",
        state: "BLOCKED",
        reason: "FULL_CATALOG_COVERAGE_NOT_VERIFIED",
      }),
    ]);
    expect(plan.stagingQueue).toHaveLength(0);
  });
});
