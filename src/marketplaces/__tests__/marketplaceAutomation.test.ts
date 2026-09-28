import { describe, expect, it } from "vitest";

import type { PilotProduct } from "../../collector/types";
import {
  evaluateMarketplaceCandidate,
  MIN_LAST_GOOD_RETENTION_RATIO,
  replaceVerifiedMarketplaceCatalog,
  type MarketplaceRefreshCandidate,
} from "../automation";

function product(overrides: Partial<PilotProduct> = {}): PilotProduct {
  return {
    source: "the-webster",
    brand: "Aeyde",
    productName: "Uma Pump",
    productUrl: "https://example.com/uma",
    imageUrl: "https://example.com/uma.jpg",
    images: ["https://example.com/uma.jpg"],
    category: "PUMP",
    color: "Black",
    material: "Leather",
    toeShape: null,
    heelType: null,
    heelHeight: null,
    details: "price=490 currency=EUR",
    discoveredAt: "2026-09-26T00:00:00.000Z",
    isNewArrivalsCollection: false,
    hasNewBadge: false,
    variants: [{ title: "Uma Pump", color: "Black", sku: "UMA-BLK" }],
    ...overrides,
  };
}

function products(count: number, source = "the-webster"): PilotProduct[] {
  return Array.from({ length: count }, (_, index) =>
    product({ source, productUrl: `https://example.com/${source}/${index}` }),
  );
}

function candidate(overrides: Partial<MarketplaceRefreshCandidate> = {}): MarketplaceRefreshCandidate {
  const rows = overrides.products ?? [product()];
  return {
    sourceId: "the-webster",
    products: rows,
    coverageStatus: "FULL",
    sourceTotal: rows.length,
    rawCollected: rows.length,
    eligibleTotal: rows.length,
    paginationExhausted: true,
    errors: [],
    ...overrides,
  };
}

describe("marketplace automation gate", () => {
  it("publishes verified rows and quarantines unclassified rows without dropping last-good", () => {
    const good = product({productUrl: "https://example.com/good"});
    const pending = product({productUrl: "https://example.com/pending", category: "OTHER_FOOTWEAR"});
    const previous = product({productUrl: pending.productUrl});
    const decision = evaluateMarketplaceCandidate({candidate: candidate({products:[good,pending]}), previousLastGood:[previous]});
    expect(decision.report.accepted).toBe(true);
    expect(decision.report.publicationCoverage).toBe("PARTIAL");
    expect(decision.quarantined).toHaveLength(1);
    expect(decision.eligibleProducts).toEqual([good]);
    const merged = replaceVerifiedMarketplaceCatalog({existing:[previous], sourceId:"the-webster", verified:decision.eligibleProducts, preserveMissing:true});
    expect(merged).toContainEqual(previous);
    expect(merged).toContainEqual(good);
  });
  it("still rejects interrupted collection even with some valid products", () => {
    const decision = evaluateMarketplaceCandidate({candidate:candidate({products:[product(),product({productUrl:"https://example.com/pending",category:null})], errors:["timeout"],paginationExhausted:false}),previousLastGood:[]});
    expect(decision.report.accepted).toBe(false);
  });

  it("accepts exact FULL coverage with images, taxonomy and hidden prices", () => {
    const decision = evaluateMarketplaceCandidate({
      candidate: candidate(),
      previousLastGood: [product()],
    });
    expect(decision.report.accepted).toBe(true);
    expect(decision.report.priceHidden).toBe(true);
  });

  it("preserves last-good for incomplete or unclassified runs", () => {
    for (const refresh of [
      candidate({ coverageStatus: "PARTIAL" }),
      candidate({ sourceTotal: null, eligibleTotal: null }),
      candidate({ products: [product({ imageUrl: null, images: [] })] }),
      candidate({ products: [product({ category: null })] }),
      candidate({ products: [product({ category: "UNCLASSIFIED" as never })] }),
      candidate({ products: [product({ category: "OTHER_FOOTWEAR" })] }),
    ]) {
      const decision = evaluateMarketplaceCandidate({
        candidate: refresh,
        previousLastGood: [product()],
      });
      expect(decision.report.accepted).toBe(false);
      expect(decision.report.lastGoodPreserved).toBe(true);
    }
  });

  it("rejects 59% catastrophic retention but accepts the exact 60% boundary", () => {
    const previous = products(100);
    const rejected = evaluateMarketplaceCandidate({
      candidate: candidate({ products: products(59), sourceTotal: 59, rawCollected: 59, eligibleTotal: 59 }),
      previousLastGood: previous,
    });
    const accepted = evaluateMarketplaceCandidate({
      candidate: candidate({ products: products(60), sourceTotal: 60, rawCollected: 60, eligibleTotal: 60 }),
      previousLastGood: previous,
    });
    expect(MIN_LAST_GOOD_RETENTION_RATIO).toBe(0.6);
    expect(rejected.report.accepted).toBe(false);
    expect(rejected.report.reasons.join(" ")).toContain("catastrophic drop");
    expect(accepted.report.accepted).toBe(true);
  });

  it("uses policy-eligible last-good as the catastrophic-drop denominator", () => {
    const previous = [
      ...products(60),
      ...products(40).map((row, index) => ({
        ...row,
        brand: "Nike",
        productUrl: `https://example.com/nike/${index}`,
      })),
    ];
    const decision = evaluateMarketplaceCandidate({
      candidate: candidate({ products: products(36), sourceTotal: 36, rawCollected: 36, eligibleTotal: 36 }),
      previousLastGood: previous,
    });
    expect(decision.report.previousLastGoodProducts).toBe(100);
    expect(decision.report.previousPolicyEligibleProducts).toBe(60);
    expect(decision.report.lastGoodRetentionRatio).toBe(0.6);
    expect(decision.report.accepted).toBe(true);
  });

  it("filters sports collaborations and blocks unapproved sources", () => {
    const discovery = evaluateMarketplaceCandidate({
      candidate: candidate({ sourceId: "random-marketplace" }),
      previousLastGood: [],
    });
    expect(discovery.report.accepted).toBe(false);

    const filtered = evaluateMarketplaceCandidate({
      candidate: candidate({
        products: [product({ brand: "MM6 Maison Margiela x Salomon" }), product({ productUrl: "https://example.com/clean" })],
        sourceTotal: 2,
        rawCollected: 2,
        eligibleTotal: 1,
      }),
      previousLastGood: [product()],
    });
    expect(filtered.report.accepted).toBe(true);
    expect(filtered.report.excludedByPolicy).toBe(1);
  });

  it("turns a first catalog into a baseline with zero NEW products", () => {
    const decision = evaluateMarketplaceCandidate({
      candidate: candidate({ products: [product({ isNewArrivalsCollection: true, hasNewBadge: true })] }),
      previousLastGood: [],
    });
    expect(decision.report.accepted).toBe(true);
    expect(decision.report.baselineVerifiedNewProducts).toBe(0);
    expect(decision.eligibleProducts[0]?.isNewArrivalsCollection).toBe(false);
  });

  it("detects a cross-source URL added earlier in the same run", () => {
    const first = evaluateMarketplaceCandidate({
      candidate: candidate({ sourceId: "level-shoes", products: [product({ source: "level-shoes" })] }),
      previousLastGood: [],
    });
    expect(first.report.accepted).toBe(true);
    const catalog = replaceVerifiedMarketplaceCatalog({
      existing: [],
      sourceId: "level-shoes",
      verified: first.eligibleProducts,
    });
    const second = evaluateMarketplaceCandidate({
      candidate: candidate(),
      previousLastGood: catalog,
    });
    expect(second.report.accepted).toBe(false);
    expect(second.report.crossSourceUrlCollisions).toBe(1);
  });

  it("replaces a FULL snapshot while preserving every other source", () => {
    const other = product({ source: "brand-official", productUrl: "https://brand.example/keep" });
    const old = product({ productUrl: "https://example.com/old" });
    const retained = product({ productUrl: "https://example.com/retained", discoveredAt: "2026-09-01T00:00:00.000Z" });
    const refreshed = product({ productUrl: "https://example.com/retained" });
    const added = product({ productUrl: "https://example.com/added" });
    const result = replaceVerifiedMarketplaceCatalog({
      existing: [other, old, retained],
      sourceId: "the-webster",
      verified: [refreshed, added],
    });
    expect(result.map((item) => item.productUrl)).toEqual([other.productUrl, retained.productUrl, added.productUrl]);
    expect(result[1]?.discoveredAt).toBe("2026-09-01T00:00:00.000Z");
  });
});
