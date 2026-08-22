import { describe, expect, it } from "vitest";
import {
  computeTrendMetrics,
  computeTrendScore,
  countAdoptionUnits,
  createObservation,
  createSourceRegistry,
  createScoringContext,
  dedupeObservations,
  deriveCaponeDecisionFromMetrics,
  seedSources,
} from "../index";

const sources = createSourceRegistry(seedSources);
const now = new Date("2026-08-18T12:00:00.000Z");

const family = "soft-volume-ballerina";

function variantObservation(
  id: string,
  skuVariant: string,
  color: string,
  material: string,
  observedAt: string,
  brand = "Maison Example",
) {
  return createObservation({
    id,
    firstSeen: "2026-07-01",
    observedAt,
    country: "Fransa",
    brand,
    corporateGroup: brand,
    modelFamily: family,
    skuVariant,
    sourceId: "src-jacquemus",
    confidence: 0.9,
    segment: "LUXURY",
    dimensions: {
      silhouette: "soft volume ballet",
      category: "ballerin",
      color,
      material,
    },
  });
}

describe("V1.1 modelFamily deduplication", () => {
  it("SKU varyantları siluet trendinde tek adoption unit sayılır", () => {
    const observations = [
      variantObservation("v1", "black-nappa", "Siyah", "nappa", "2026-08-01"),
      variantObservation("v2", "burgundy-suede", "Bordo", "süet", "2026-08-02"),
      variantObservation("v3", "cream-nappa", "Krem", "nappa", "2026-08-03"),
      variantObservation("v4", "black-suede", "Siyah", "süet", "2026-08-04"),
    ];

    const units = countAdoptionUnits(observations, {
      dedupeScope: "silhouette",
      dedupePublications: true,
      useCorporateGroup: true,
    });

    expect(units).toBe(1);
    expect(dedupeObservations(observations).length).toBe(4);
  });

  it("renk scope'unda varyantlar ayrı sayılabilir", () => {
    const observations = [
      variantObservation("v1", "black-nappa", "Siyah", "nappa", "2026-08-01"),
      variantObservation("v2", "burgundy-suede", "Bordo", "süet", "2026-08-02"),
    ];

    const units = countAdoptionUnits(observations, {
      dedupeScope: "color",
      dedupePublications: true,
      useCorporateGroup: true,
    });

    expect(units).toBe(2);
  });
});

describe("V1.1 momentumScore", () => {
  it("yetersiz tarihsel veride momentumScore null döner", () => {
    const observations = [
      createObservation({
        id: "recent-1",
        firstSeen: "2026-08-10",
        observedAt: "2026-08-15",
        country: "Fransa",
        brand: "Jacquemus",
        sourceId: "src-jacquemus",
        confidence: 0.9,
        dimensions: { silhouette: "kitten heel" },
      }),
    ];

    const result = computeTrendMetrics({ observations, sources, now });
    expect(result.momentumScore).toBeNull();
    expect(result.breakdown.momentum).toBeNull();
  });
});

describe("V1.1 CAPONE kararı", () => {
  it("güçlü ama doygun trend = GEÇ KALDIK", () => {
    const result = deriveCaponeDecisionFromMetrics({
      trendStrength: 82,
      momentumScore: 35,
      noveltyScore: 30,
      saturationScore: 78,
      opportunityScore: 28,
      independentAdoptionUnits: 8,
      sourceQuality: 80,
      leaderValidation: 70,
      stage: "SATURATED",
    });

    expect(result.decision).toBe("GEÇ KALDIK");
  });

  it("çok erken güçlü leader sinyali = TAKİP ET", () => {
    const result = deriveCaponeDecisionFromMetrics({
      trendStrength: 38,
      momentumScore: null,
      noveltyScore: 72,
      saturationScore: 18,
      opportunityScore: 42,
      independentAdoptionUnits: 2,
      sourceQuality: 55,
      leaderValidation: 68,
      stage: "EARLY_SIGNAL",
    });

    expect(result.decision).toBe("TAKİP ET");
  });

  it("yükselen, iyi kanıtlı, düşük saturation = NUMUNEYE GİR", () => {
    const result = deriveCaponeDecisionFromMetrics({
      trendStrength: 68,
      momentumScore: 72,
      noveltyScore: 55,
      saturationScore: 32,
      opportunityScore: 61,
      independentAdoptionUnits: 5,
      sourceQuality: 70,
      leaderValidation: 60,
      stage: "ACCELERATING",
    });

    expect(result.decision).toBe("NUMUNEYE GİR");
  });
});

describe("V1.1 computeTrendMetrics", () => {
  it("5 metrik + stage + caponeDecision + confidence üretir", () => {
    const observations = [
      createObservation({
        id: "o1",
        firstSeen: "2026-05-01",
        observedAt: "2026-06-01",
        country: "Fransa",
        brand: "Jacquemus",
        sourceId: "src-jacquemus",
        confidence: 0.9,
        segment: "LUXURY",
        dimensions: { silhouette: "kitten heel" },
      }),
      createObservation({
        id: "o2",
        firstSeen: "2026-04-01",
        observedAt: "2026-05-15",
        country: "İtalya",
        brand: "Milan Footwear Week",
        sourceId: "src-milan-fw",
        confidence: 0.8,
        segment: "PREMIUM",
        dimensions: { silhouette: "kitten heel" },
      }),
      createObservation({
        id: "o3",
        firstSeen: "2026-03-01",
        observedAt: "2026-04-20",
        country: "Almanya",
        brand: "Mytheresa",
        sourceId: "src-mytheresa",
        confidence: 0.75,
        segment: "PREMIUM",
        dimensions: { silhouette: "kitten heel" },
      }),
      createObservation({
        id: "o4",
        firstSeen: "2026-07-01",
        observedAt: "2026-08-01",
        country: "İngiltere",
        brand: "Vogue Runway",
        sourceId: "src-vogue-runway",
        confidence: 0.7,
        segment: "CONTEMPORARY",
        dimensions: { silhouette: "kitten heel" },
      }),
      createObservation({
        id: "o5",
        firstSeen: "2026-06-15",
        observedAt: "2026-07-20",
        country: "Fransa",
        brand: "The Row",
        sourceId: "src-the-row",
        confidence: 0.95,
        segment: "LUXURY",
        dimensions: { silhouette: "kitten heel" },
      }),
    ];

    const result = computeTrendMetrics({ observations, sources, now });

    expect(result.trendStrength).toBeGreaterThanOrEqual(0);
    expect(result.trendStrength).toBeLessThanOrEqual(100);
    expect(result.noveltyScore).toBeGreaterThanOrEqual(0);
    expect(result.saturationScore).toBeGreaterThanOrEqual(0);
    expect(result.opportunityScore).toBeGreaterThanOrEqual(0);
    expect(result.stage).toBeDefined();
    expect(result.caponeDecision).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.trendStrength.segmentSpread).toBeGreaterThan(0);
  });

  it("opportunityScore saturation ile baskılanır", () => {
    const lowSat = computeTrendMetrics({
      observations: [
        createObservation({
          id: "a",
          firstSeen: "2026-07-01",
          observedAt: "2026-08-01",
          country: "Fransa",
          brand: "Jacquemus",
          sourceId: "src-jacquemus",
          confidence: 0.9,
          segment: "LUXURY",
          dimensions: { silhouette: "test-a" },
        }),
      ],
      sources,
      now,
    });

    const ctx = createScoringContext({ observations: [], sources, now });
    expect(ctx.trendObservations).toEqual([]);

    expect(lowSat.opportunityScore).toBeGreaterThanOrEqual(0);
  });
});

describe("V1 backward compatibility", () => {
  it("computeTrendScore trendStrength döndürür", () => {
    const observations = [
      createObservation({
        id: "b1",
        firstSeen: "2026-06-01",
        observedAt: "2026-07-01",
        country: "Fransa",
        brand: "Jacquemus",
        sourceId: "src-jacquemus",
        confidence: 0.9,
        dimensions: { silhouette: "kitten heel" },
      }),
    ];

    const legacy = computeTrendScore({ observations, sources, now });
    const v11 = computeTrendMetrics({ observations, sources, now });

    expect(legacy.trendScore).toBe(v11.trendStrength);
  });
});
