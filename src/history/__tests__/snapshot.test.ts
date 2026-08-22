import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSnapshotProducts,
  buildSnapshotSummary,
  canonicalUrl,
} from "../buildSnapshot";
import {
  buildInitialChangeReport,
  compareSnapshotData,
} from "../compareSnapshots";
import { formatSnapshotId, resolveUniqueSnapshotId } from "../listSnapshots";
import type { SnapshotProduct, SnapshotSummary } from "../types";
import type { AnalyzedProduct } from "../../analysis/types";

function analyzedProduct(overrides: Partial<AnalyzedProduct> = {}): AnalyzedProduct {
  return {
    source: "test",
    brand: "SCHUTZ",
    productName: "Test Shoe",
    productUrl: "https://example.com/products/a",
    imageUrl: "https://example.com/a.jpg",
    category: "PUMP",
    color: "Black",
    material: "Leather",
    toeShape: null,
    heelType: null,
    heelHeight: null,
    details: null,
    discoveredAt: "2026-08-18T10:00:00.000Z",
    cleaned: { color: "Black", heelHeight: null },
    normalized: {
      category: "PUMP",
      colorFamily: "BLACK",
      materialFamily: "LEATHER",
      heelType: "STILETTO",
      heelHeightGroup: "HIGH",
      toeShape: "POINTED",
      details: ["BUCKLE"],
      construction: ["CLOSED_TOE"],
    },
    ...overrides,
  };
}

function snapshotSummary(
  snapshotId: string,
  products: SnapshotProduct[],
  collectedAt: string,
): SnapshotSummary {
  return buildSnapshotSummary(snapshotId, collectedAt, products);
}

describe("snapshot creation", () => {
  it("marks all products as new on first snapshot", () => {
    const collectedAt = "2026-08-18T12:00:00.000Z";
    const products = buildSnapshotProducts(
      [analyzedProduct()],
      collectedAt,
      new Map(),
    );

    expect(products[0]?.isNew).toBe(true);
    expect(products[0]?.firstSeen).toBe(collectedAt);
    expect(products[0]?.lastSeen).toBe(collectedAt);
  });

  it("preserves firstSeen for previously seen productUrl", () => {
    const firstSeen = "2026-08-18T10:00:00.000Z";
    const collectedAt = "2026-08-18T12:00:00.000Z";
    const previousSeen = new Map([
      [canonicalUrl("https://example.com/products/a"), { firstSeen, lastSeen: firstSeen }],
    ]);

    const products = buildSnapshotProducts(
      [analyzedProduct()],
      collectedAt,
      previousSeen,
    );

    expect(products[0]?.isNew).toBe(false);
    expect(products[0]?.firstSeen).toBe(firstSeen);
    expect(products[0]?.lastSeen).toBe(collectedAt);
  });

  it("does not overwrite snapshot id when minute collision exists", async () => {
    const date = new Date("2026-08-18T12:34:00.000Z");
    const historyRoot = await mkdtemp(join(tmpdir(), "capone-history-"));
    const baseId = formatSnapshotId(date);

    try {
      await mkdir(join(historyRoot, baseId), { recursive: true });
      const nextId = await resolveUniqueSnapshotId(historyRoot, date);
      expect(nextId).toBe(`${baseId}-1`);
    } finally {
      await rm(historyRoot, { recursive: true, force: true });
    }
  });
});

describe("snapshot comparison", () => {
  it("returns comparisonAvailable=false for initial report", () => {
    const report = buildInitialChangeReport("2026-08-18_12-00", "2026-08-18T12:00:00.000Z");
    expect(report.comparisonAvailable).toBe(false);
    expect(report.signalChanges).toHaveLength(0);
    expect(report.newProducts).toHaveLength(0);
  });

  it("computes productDelta and brandDelta on second snapshot", () => {
    const collectedAtPrev = "2026-08-18T10:00:00.000Z";
    const collectedAtCurr = "2026-08-18T12:00:00.000Z";

    const previousProducts = buildSnapshotProducts(
      [
        analyzedProduct({
          brand: "SCHUTZ",
          normalized: {
            category: "PUMP",
            colorFamily: "BROWN",
            materialFamily: "LEATHER",
            heelType: "STILETTO",
            heelHeightGroup: "HIGH",
            toeShape: "POINTED",
            details: ["BUCKLE"],
            construction: ["CLOSED_TOE"],
          },
        }),
      ],
      collectedAtPrev,
      new Map(),
    );

    const currentProducts = buildSnapshotProducts(
      [
        analyzedProduct({
          brand: "SCHUTZ",
          normalized: {
            category: "PUMP",
            colorFamily: "BROWN",
            materialFamily: "LEATHER",
            heelType: "STILETTO",
            heelHeightGroup: "HIGH",
            toeShape: "POINTED",
            details: ["BUCKLE"],
            construction: ["CLOSED_TOE"],
          },
        }),
        analyzedProduct({
          brand: "ST. AGNI",
          productUrl: "https://example.com/products/b",
          normalized: {
            category: "PUMP",
            colorFamily: "BROWN",
            materialFamily: "LEATHER",
            heelType: "STILETTO",
            heelHeightGroup: "HIGH",
            toeShape: "POINTED",
            details: ["BUCKLE"],
            construction: ["CLOSED_TOE"],
          },
        }),
        analyzedProduct({
          brand: "TONY BIANCO",
          productUrl: "https://example.com/products/c",
          normalized: {
            category: "PUMP",
            colorFamily: "BROWN",
            materialFamily: "LEATHER",
            heelType: "STILETTO",
            heelHeightGroup: "HIGH",
            toeShape: "POINTED",
            details: ["BOW"],
            construction: ["CLOSED_TOE"],
          },
        }),
      ],
      collectedAtCurr,
      new Map([
        [
          canonicalUrl("https://example.com/products/a"),
          { firstSeen: collectedAtPrev, lastSeen: collectedAtPrev },
        ],
      ]),
    );

    const report = compareSnapshotData({
      previousSnapshotId: "2026-08-18_10-00",
      currentSnapshotId: "2026-08-18_12-00",
      previousSummary: snapshotSummary("2026-08-18_10-00", previousProducts, collectedAtPrev),
      currentSummary: snapshotSummary("2026-08-18_12-00", currentProducts, collectedAtCurr),
      previousProducts,
      currentProducts,
      generatedAt: collectedAtCurr,
    });

    const brown = report.signalChanges.find(
      (change) => change.dimension === "colorFamily" && change.tag === "BROWN",
    );
    expect(brown?.productDelta).toBe(2);
    expect(brown?.brandDelta).toBe(2);
    expect(brown?.newlySeenBrands).toEqual(["ST. AGNI", "TONY BIANCO"]);
  });

  it("does not count same productUrl as new product", () => {
    const collectedAt = "2026-08-18T10:00:00.000Z";
    const products = buildSnapshotProducts([analyzedProduct()], collectedAt, new Map());

    const report = compareSnapshotData({
      previousSnapshotId: "prev",
      currentSnapshotId: "curr",
      previousSummary: snapshotSummary("prev", products, collectedAt),
      currentSummary: snapshotSummary("curr", products, collectedAt),
      previousProducts: products,
      currentProducts: products,
      generatedAt: collectedAt,
    });

    expect(report.newProducts).toHaveLength(0);
    expect(report.removedProducts).toHaveLength(0);
    expect(report.signalChanges.every((change) => change.productDelta === 0)).toBe(true);
  });

  it("does not invent momentum when counts are unchanged", () => {
    const collectedAt = "2026-08-18T10:00:00.000Z";
    const products = buildSnapshotProducts([analyzedProduct()], collectedAt, new Map());
    const report = compareSnapshotData({
      previousSnapshotId: "prev",
      currentSnapshotId: "curr",
      previousSummary: snapshotSummary("prev", products, collectedAt),
      currentSummary: snapshotSummary("curr", products, collectedAt),
      previousProducts: products,
      currentProducts: products,
      generatedAt: collectedAt,
    });

    expect(report.topChanges).toHaveLength(0);
  });
});
