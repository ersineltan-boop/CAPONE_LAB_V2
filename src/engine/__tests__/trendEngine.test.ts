import { describe, expect, it } from "vitest";
import {
  computeTrendMetrics,
  createObservation,
  createSourceRegistry,
  deriveCaponeDecisionFromEngine,
  isProductionSignalCountry,
  isTrendMarketCountry,
  scoreCountrySpread,
  scoreIndependentBrandCount,
  scoreSourceQuality,
  seedSources,
  summarizeProductionSignals,
} from "../index";

const sources = createSourceRegistry(seedSources);
const now = new Date("2026-08-18T12:00:00.000Z");

const sampleObservations = [
  createObservation({
    id: "obs-1",
    firstSeen: "2026-07-01",
    observedAt: "2026-08-10",
    country: "Fransa",
    brand: "Jacquemus",
    sourceId: "src-jacquemus",
    confidence: 0.9,
    dimensions: {
      silhouette: "kitten heel",
      category: "pump",
    },
  }),
  createObservation({
    id: "obs-2",
    firstSeen: "2026-06-15",
    observedAt: "2026-08-05",
    country: "İtalya",
    brand: "Milan Footwear Week",
    sourceId: "src-milan-fw",
    confidence: 0.8,
    dimensions: { silhouette: "kitten heel" },
  }),
  createObservation({
    id: "obs-3",
    firstSeen: "2026-05-01",
    observedAt: "2026-07-20",
    country: "Almanya",
    brand: "Mytheresa",
    sourceId: "src-mytheresa",
    confidence: 0.7,
    dimensions: { silhouette: "kitten heel" },
  }),
  createObservation({
    id: "obs-4",
    firstSeen: "2026-04-01",
    observedAt: "2026-06-01",
    country: "Çin",
    brand: "Guangzhou Footwear Cluster",
    sourceId: "src-cn-production",
    confidence: 0.85,
    dimensions: { category: "kopya sinyali" },
  }),
];

describe("market constants", () => {
  it("Çin trend pazarı değildir", () => {
    expect(isProductionSignalCountry("Çin")).toBe(true);
    expect(isTrendMarketCountry("Çin")).toBe(false);
    expect(isTrendMarketCountry("Fransa")).toBe(true);
  });
});

describe("sourceQuality", () => {
  it("0–100 arasında skor üretir", () => {
    const score = scoreSourceQuality({
      observations: sampleObservations,
      sources,
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("PRODUCTION_SIGNAL kaynağını trend skoruna dahil etmez", () => {
    const withoutCn = sampleObservations.filter((o) => o.id !== "obs-4");
    const withCn = sampleObservations;
    expect(
      scoreSourceQuality({ observations: withoutCn, sources }),
    ).toBe(scoreSourceQuality({ observations: withCn, sources }));
  });
});

describe("independentBrandCount", () => {
  it("Çin gözlemlerini saymaz", () => {
    const count = scoreIndependentBrandCount({
      observations: sampleObservations,
      sources,
    });
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(100);
  });
});

describe("countrySpread", () => {
  it("trend pazarı ülkelerini sayar", () => {
    const spread = scoreCountrySpread({
      observations: sampleObservations,
      sources,
    });
    expect(spread).toBeGreaterThan(0);
  });
});

describe("computeTrendScore / computeTrendMetrics", () => {
  it("bileşenleri ve toplam skoru döndürür", () => {
    const result = computeTrendMetrics({
      observations: sampleObservations,
      sources,
      now,
    });

    expect(result.trendStrength).toBeGreaterThanOrEqual(0);
    expect(result.trendStrength).toBeLessThanOrEqual(100);
    expect(result.breakdown.trendStrength.sourceQuality).toBeDefined();
    expect(result.breakdown.momentum).toBeDefined();
    expect(result.breakdown.trendStrength.retailBuyerValidation).toBeDefined();
  });
});

describe("deriveCaponeDecisionFromEngine", () => {
  it("geçerli CAPONE kararı üretir", () => {
    const metrics = computeTrendMetrics({
      observations: sampleObservations,
      sources,
      now,
    });

    const result = deriveCaponeDecisionFromEngine({ metrics });

    expect(["NUMUNEYE GİR", "TAKİP ET", "BEKLE", "GEÇ KALDIK"]).toContain(
      result.decision,
    );
    expect(result.rationale.length).toBeGreaterThan(0);
    expect(result.derivedInputs.evidenceStrength).toBeDefined();
  });
});

describe("productionSignal", () => {
  it("aktif olmayan Çin kaynağında sıfır sinyal", () => {
    const summary = summarizeProductionSignals(sampleObservations, sources);
    expect(summary.observationCount).toBe(0);
  });

  it("aktif PRODUCTION_SIGNAL kaynağında ayrı özet üretir", () => {
    const activeCnSources = createSourceRegistry(
      seedSources.map((s) =>
        s.id === "src-cn-production" ? { ...s, isActive: true } : s,
      ),
    );
    const summary = summarizeProductionSignals(
      sampleObservations,
      activeCnSources,
    );
    expect(summary.observationCount).toBe(1);
    expect(summary.signalStrength).toBeGreaterThan(0);
  });
});
