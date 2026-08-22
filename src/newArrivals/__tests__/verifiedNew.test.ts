import { describe, expect, it } from "vitest";

import {
  buildNewnessFromProductHints,
  isNewArrivalsCollectionPath,
  mergeSourceNewness,
} from "../detectNewness";
import { createNotVerifiedNewness, isVerifiedNew } from "../newness";
import { queryDiscoveredNewArrivals } from "../discoveredQuery";
import { queryVerifiedNewArrivals } from "../verifiedQuery";
import type { ModelFamily } from "../../modelFamily/types";

function baseFamily(overrides: Partial<ModelFamily> = {}): ModelFamily {
  return {
    modelFamilyId: "test--model",
    brand: "TEST",
    canonicalName: "Test Pump",
    category: "PUMP",
    primaryCategory: "PUMP",
    representativeProductId: "https://example.com/p",
    representativeImage: null,
    representativeImages: [],
    variantCount: 1,
    variants: [],
    allImages: [],
    sourceProductIds: ["https://example.com/p"],
    groupingConfidence: "HIGH",
    groupingReason: "test",
    modelFamilyFirstSeenAt: "2026-08-19T00:00:00.000Z",
    sourceSightings: [
      {
        sourceId: "test",
        sourceLabel: "TEST",
        firstSeenAt: "2026-08-19T00:00:00.000Z",
        lastSeenAt: "2026-08-19T00:00:00.000Z",
        newness: createNotVerifiedNewness(),
      },
    ],
    ...overrides,
  };
}

describe("true new arrivals", () => {
  it("CAPONE firstSeen alone does not create VERIFIED_NEW", () => {
    const family = baseFamily();
    expect(queryVerifiedNewArrivals([family], { scope: { type: "ALL" }, period: "90D" })).toHaveLength(0);
  });

  it("NEW_ARRIVALS_COLLECTION evidence creates VERIFIED_NEW", () => {
    const newness = buildNewnessFromProductHints(
      {
        collectionPath: "/collections/new-arrivals",
        isNewArrivalsCollection: true,
        productUrl: "https://example.com/p",
      },
      "2026-08-21T00:00:00.000Z",
    );
    expect(isVerifiedNew(newness)).toBe(true);
    expect(newness.evidenceType).toBe("NEW_ARRIVALS_COLLECTION");
  });

  it("NEW badge evidence creates VERIFIED_NEW", () => {
    const newness = buildNewnessFromProductHints(
      { hasNewBadge: true, productUrl: "https://example.com/p" },
      "2026-08-21T00:00:00.000Z",
    );
    expect(isVerifiedNew(newness)).toBe(true);
    expect(newness.evidenceType).toBe("NEW_BADGE");
  });

  it("explicit release date works with NEW badge context", () => {
    const newness = buildNewnessFromProductHints(
      {
        hasNewBadge: true,
        publishedAt: "2026-08-01T00:00:00.000Z",
        productUrl: "https://example.com/p",
      },
      "2026-08-21T00:00:00.000Z",
    );
    expect(newness.evidenceType).toBe("NEW_BADGE");
    expect(newness.effectiveNewAt).toBe("2026-08-01T00:00:00.000Z");
  });

  it("discovered query uses modelFamilyFirstSeenAt", () => {
    const results = queryDiscoveredNewArrivals(
      [baseFamily()],
      { scope: { type: "ALL" }, period: "90D", referenceDate: "2026-08-20T00:00:00.000Z" },
    );
    expect(results).toHaveLength(1);
  });

  it("preserves FORMERLY_NEW when evidence disappears", () => {
    const verified = buildNewnessFromProductHints(
      { hasNewBadge: true, productUrl: "https://example.com/p" },
      "2026-08-01T00:00:00.000Z",
    );
    const merged = mergeSourceNewness(verified, createNotVerifiedNewness(), "2026-08-21T00:00:00.000Z");
    expect(merged.status).toBe("FORMERLY_NEW");
    expect(merged.firstVerifiedAt).toBe(verified.firstVerifiedAt);
  });

  it("global verified new dedupes same model family", () => {
    const family = baseFamily({
      sourceSightings: [
        {
          sourceId: "brand-a",
          sourceLabel: "Brand A",
          firstSeenAt: "2026-08-01T00:00:00.000Z",
          lastSeenAt: "2026-08-21T00:00:00.000Z",
          newness: buildNewnessFromProductHints(
            { hasNewBadge: true, productUrl: "https://a.com/p" },
            "2026-08-01T00:00:00.000Z",
          ),
        },
        {
          sourceId: "brand-b",
          sourceLabel: "Brand B",
          firstSeenAt: "2026-08-20T00:00:00.000Z",
          lastSeenAt: "2026-08-21T00:00:00.000Z",
          newness: buildNewnessFromProductHints(
            { hasNewBadge: true, productUrl: "https://b.com/p" },
            "2026-08-20T00:00:00.000Z",
          ),
        },
      ],
    });
    expect(
      queryVerifiedNewArrivals([family], {
        scope: { type: "ALL" },
        period: "90D",
        referenceDate: "2026-08-21T00:00:00.000Z",
      }),
    ).toHaveLength(1);
  });

  it("source-specific verified dates may differ", () => {
    const family = baseFamily({
      sourceSightings: [
        {
          sourceId: "ugg",
          sourceLabel: "UGG",
          firstSeenAt: "2026-08-01T00:00:00.000Z",
          lastSeenAt: "2026-08-21T00:00:00.000Z",
          newness: buildNewnessFromProductHints(
            { hasNewBadge: true, productUrl: "https://ugg.com/p" },
            "2026-08-01T00:00:00.000Z",
          ),
        },
        {
          sourceId: "mytheresa",
          sourceLabel: "Mytheresa",
          firstSeenAt: "2026-08-20T00:00:00.000Z",
          lastSeenAt: "2026-08-21T00:00:00.000Z",
          newness: buildNewnessFromProductHints(
            { hasNewBadge: true, productUrl: "https://mytheresa.com/p" },
            "2026-08-20T00:00:00.000Z",
          ),
        },
      ],
    });
    const ugg = queryVerifiedNewArrivals([family], {
      scope: { type: "SOURCE", sourceId: "ugg" },
      period: "90D",
      referenceDate: "2026-08-21T00:00:00.000Z",
    })[0];
    const mytheresa = queryVerifiedNewArrivals([family], {
      scope: { type: "SOURCE", sourceId: "mytheresa" },
      period: "90D",
      referenceDate: "2026-08-21T00:00:00.000Z",
    })[0];
    expect(Date.parse(ugg.effectiveNewAt)).toBeLessThan(Date.parse(mytheresa.effectiveNewAt));
  });

  it("clears false EXPLICIT_DATE backfill on merge", () => {
    const prior = {
      status: "VERIFIED_NEW" as const,
      evidenceType: "EXPLICIT_DATE" as const,
      firstVerifiedAt: "2026-08-19T00:00:00.000Z",
      lastVerifiedAt: "2026-08-19T00:00:00.000Z",
      effectiveNewAt: "2026-06-09T00:00:00.000Z",
    };
    const merged = mergeSourceNewness(prior, createNotVerifiedNewness(), "2026-08-21T00:00:00.000Z");
    expect(merged.status).toBe("NOT_VERIFIED");
  });

  it("detects new-arrivals collection paths", () => {
    expect(isNewArrivalsCollectionPath("/collections/new-arrivals")).toBe(true);
    expect(isNewArrivalsCollectionPath("/collections/all-shoes")).toBe(false);
    expect(isNewArrivalsCollectionPath("/women/shoes/new.html")).toBe(true);
    expect(isNewArrivalsCollectionPath("/women/shoes.html")).toBe(false);
  });
});
