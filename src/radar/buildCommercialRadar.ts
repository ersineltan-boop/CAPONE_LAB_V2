import { labelTagTr } from "../analysis/buildMarketAnalysis";
import type { AnalyzedProduct, MarketAnalysis } from "../types/marketAnalysis";
import { computeTrendMetrics } from "../engine/scoring/v11/computeTrendMetrics";
import { createObservation } from "../engine/observations/helpers";
import type { ChangeReport } from "../history/types";
import { brandCountry, brandSourceId, buildMultibrandSourceRegistry } from "./brandMeta";
import { brandEntries } from "../registry/data/brands";
import {
  mapEngineStageLabel,
  mapEngineToCommercialDecision,
} from "./mapEngineDecision";
import type { ClusterBuildStats, MarketPalette, RadarCluster } from "./clusterTypes";
import {
  buildDistinctiveClusters,
  buildMarketPalette,
  productMatchesRadarCluster,
} from "./distinctiveClusters";
import type { RadarBuildInput } from "./clusterTypes";
import type {
  BrandDiscoveryItem,
  BrandExplorerItem,
  CommercialDecision,
  CommercialStage,
  ProductReference,
  ProductTranslation,
  RadarTopSummary,
  TrendCommercialRadarItem,
} from "../types/commercialRadar";
import { HERO_STAGE_ORDER } from "../types/commercialRadar";

const registryByBrand = new Map(
  brandEntries.map((entry) => [entry.brand.trim().toUpperCase(), entry]),
);

function registryCountryForBrand(brand: string): string {
  const entry = registryByBrand.get(brand.trim().toUpperCase());
  if (entry?.country) return entry.country;
  const legacy = brandCountry(brand);
  return legacy === "Global" ? brand : legacy;
}

function registrySegmentForBrand(brand: string): string {
  return registryByBrand.get(brand.trim().toUpperCase())?.segment ?? "UNCLASSIFIED";
}

function registryClassificationForBrand(
  brand: string,
): "UNREVIEWED" | "REVIEWED" {
  return (
    registryByBrand.get(brand.trim().toUpperCase())?.classificationStatus ?? "UNREVIEWED"
  );
}

const HERO_STAGES: CommercialStage[] = HERO_STAGE_ORDER;

function clusterCategoryLabel(cluster: RadarCluster): string {
  const parts = cluster.attributes.map(
    (attribute) => labelTagTr(attribute.value),
  );
  return parts.join(" · ") || "Ürün Kümesi";
}

function productToReference(
  product: AnalyzedProduct,
  stage: CommercialStage,
): ProductReference {
  return {
    brand: product.brand,
    model: product.productName,
    country: brandCountry(product.brand),
    segment: "PREMIUM",
    commercialStage: stage,
    imageUrl: product.imageUrl,
    externalUrl: product.productUrl,
    observedAt: product.discoveredAt,
    roleLabel: product.brand,
  };
}

function pickHeroProducts(products: AnalyzedProduct[]): AnalyzedProduct[] {
  const withImages = products.filter((product) => product.imageUrl);
  const picked: AnalyzedProduct[] = [];
  const usedBrands = new Set<string>();

  for (const product of withImages) {
    if (usedBrands.has(product.brand)) continue;
    picked.push(product);
    usedBrands.add(product.brand);
    if (picked.length >= 4) break;
  }

  for (const product of withImages) {
    if (picked.length >= 4) break;
    if (picked.some((item) => item.productUrl === product.productUrl)) continue;
    picked.push(product);
  }

  while (picked.length < 4 && products.length > 0) {
    picked.push(products[picked.length % products.length]!);
    if (picked.length >= 4) break;
  }

  return picked.slice(0, 4);
}

function buildHeroReferences(products: AnalyzedProduct[]): TrendCommercialRadarItem["heroReferences"] {
  const heroProducts = pickHeroProducts(products);
  return HERO_STAGES.map((stage, index) =>
    productToReference(heroProducts[index] ?? heroProducts[0]!, stage),
  ) as TrendCommercialRadarItem["heroReferences"];
}

function buildReferences(products: AnalyzedProduct[]): ProductReference[] {
  const sorted = [...products].sort((a, b) => {
    if (Boolean(a.imageUrl) !== Boolean(b.imageUrl)) {
      return a.imageUrl ? -1 : 1;
    }
    return a.brand.localeCompare(b.brand, "tr");
  });

  return sorted.slice(0, 24).map((product, index) =>
    productToReference(product, HERO_STAGES[index % HERO_STAGES.length]!),
  );
}

function buildProductTranslation(products: AnalyzedProduct[]): ProductTranslation {
  const colors = [
    ...new Set(
      products
        .map((product) => product.cleaned.color ?? product.color)
        .filter(Boolean) as string[],
    ),
  ].slice(0, 6);

  const materials = [
    ...new Set(products.map((product) => product.normalized.materialFamily)),
  ].filter((value) => value !== "UNKNOWN");

  const categories = [
    ...new Set(
      products
        .map((product) => product.normalized.category)
        .filter(Boolean) as string[],
    ),
  ];

  return {
    form: categories.map((category) => labelTagTr(category)).join(" · ") || "—",
    toe: [
      ...new Set(products.map((product) => product.normalized.toeShape)),
    ]
      .filter((value) => value !== "UNKNOWN")
      .map((value) => labelTagTr(value))
      .join(" · ") || "—",
    upper: "Gerçek vitrin verisi",
    heelSole: [
      ...new Set(products.map((product) => product.normalized.heelType)),
    ]
      .filter((value) => value !== "UNKNOWN")
      .map((value) => labelTagTr(value))
      .join(" · ") || "—",
    material: materials.map((value) => labelTagTr(value)).join(" · ") || "—",
    colors: colors.length > 0 ? colors : ["—"],
    turkeyProduction: "Gerçek veri — üretim yorumu yok",
    chinaNeed: "—",
    commercialRisk: "—",
    recommendedSamples: products.slice(0, 3).map((product) => product.productName),
  };
}

function buildRadarReason(cluster: RadarCluster): string {
  const coveragePct = Math.round(cluster.evidence.evidenceCoverage * 100);
  return [
    `${cluster.brandCount} bağımsız marka · ${cluster.modelFamilyCount} model ailesi`,
    `${cluster.productCount} ürün kanıtı · kanıt kapsamı %${coveragePct}`,
    `Kanıt gücü: ${cluster.evidenceStrength}`,
    `Markalar: ${cluster.brands.join(", ")}`,
  ].join(" · ");
}

function buildFirstMeasurementCopy(
  cluster: RadarCluster,
): {
  decision: CommercialDecision;
  stage: string;
  summary: string;
  whyNow: string;
  caponeRecommendation: string;
} {
  return {
    decision: "VERİ BİRİKİYOR",
    stage: "İLK ÖLÇÜM",
    summary: `${cluster.productCount} ürün · ${cluster.brandCount} bağımsız marka · ${cluster.brands.join(", ")}`,
    whyNow:
      "İlk ölçüm tamamlandı. Zaman içi hareket bir sonraki taramada hesaplanacak.",
    caponeRecommendation: "VERİ BİRİKİYOR",
  };
}

function buildComparedCopy(
  cluster: RadarCluster,
  matchingProducts: AnalyzedProduct[],
): {
  decision: CommercialDecision;
  stage: string;
  summary: string;
  whyNow: string;
  caponeRecommendation: string;
  engineMetrics: TrendCommercialRadarItem["engineMetrics"];
} {
  const brands = [...new Set(matchingProducts.map((product) => product.brand))];
  const sources = buildMultibrandSourceRegistry(brands);
  const observations = matchingProducts.map((product) =>
    createObservation({
      id: product.productUrl,
      firstSeen: product.discoveredAt,
      observedAt: product.discoveredAt,
      country: brandCountry(product.brand),
      brand: product.brand,
      sourceId: brandSourceId(product.brand),
      confidence: 0.85,
      modelFamily: product.productName,
      segment: "PREMIUM",
      dimensions: {
        category: product.normalized.category,
        heelType: product.normalized.heelType,
        material: product.normalized.materialFamily,
        color: product.normalized.colorFamily,
        detail: product.normalized.details[0] ?? null,
      },
    }),
  );

  const engine = computeTrendMetrics({ observations, sources });
  const decision = mapEngineToCommercialDecision(engine.caponeDecision);

  const deltaParts: string[] = [];
  if (cluster.productDelta !== undefined) {
    deltaParts.push(`${cluster.productDelta >= 0 ? "+" : ""}${cluster.productDelta} ürün`);
  }
  if (cluster.brandDelta !== undefined) {
    deltaParts.push(`${cluster.brandDelta >= 0 ? "+" : ""}${cluster.brandDelta} marka`);
  }
  if (cluster.newlySeenBrands && cluster.newlySeenBrands.length > 0) {
    deltaParts.push(`Yeni markalar: ${cluster.newlySeenBrands.join(", ")}`);
  }

  return {
    decision,
    stage: mapEngineStageLabel(engine.stage),
    summary:
      deltaParts.length > 0
        ? `${cluster.labelTr}: ${deltaParts.join(" · ")}`
        : `${cluster.productCount} ürün · ${cluster.brandCount} marka · ${cluster.brands.join(", ")}`,
    whyNow:
      deltaParts.length > 0
        ? deltaParts.join(" · ")
        : "Karşılaştırma mevcut; bu kümede anlamlı delta yok.",
    caponeRecommendation: decision,
    engineMetrics: {
      trendStrength: engine.trendStrength,
      momentumScore: engine.momentumScore,
      noveltyScore: engine.noveltyScore,
      saturationScore: engine.saturationScore,
      opportunityScore: engine.opportunityScore,
    },
  };
}

function clusterToRadarItem(
  cluster: RadarCluster,
  products: AnalyzedProduct[],
  changeReport: ChangeReport,
  collectedAt: string,
): TrendCommercialRadarItem {
  const matchingProducts = products.filter((product) =>
    productMatchesRadarCluster(product, cluster),
  );
  const compared = changeReport.comparisonAvailable
    ? buildComparedCopy(cluster, matchingProducts)
    : null;
  const copy = compared ?? buildFirstMeasurementCopy(cluster);

  const marketCountries = [
    ...new Set(cluster.brands.map((brand) => brandCountry(brand))),
  ];

  return {
    id: cluster.id,
    title: cluster.labelTr,
    category: clusterCategoryLabel(cluster),
    decision: copy.decision,
    stage: copy.stage,
    summary: copy.summary,
    whyNow: copy.whyNow,
    marketFit: marketCountries.slice(0, 6).map((market) => ({
      market,
      level: "Orta" as const,
    })),
    production: `${cluster.brandCount} marka vitrin kanıtı`,
    seasonFit: "Gerçek multibrand ölçüm",
    caponeRecommendation: copy.caponeRecommendation,
    heroReferences: buildHeroReferences(matchingProducts),
    references: buildReferences(matchingProducts),
    reverseSeasonReferences: [],
    reverseSeasonLabel: "",
    productTranslation: buildProductTranslation(matchingProducts),
    engineMetrics: compared?.engineMetrics,
    radarReason: buildRadarReason(cluster),
    updatedAt: collectedAt,
  };
}

export function buildCommercialRadarItems(input: {
  products: AnalyzedProduct[];
  analysis: MarketAnalysis;
  changeReport: ChangeReport;
  meta: RadarBuildInput;
  provenanceMap: Map<string, import("./clusterTypes").ProductProvenance>;
  totalVisionEligible: number;
}): TrendCommercialRadarItem[] {
  const { clusters } = buildDistinctiveClusters({
    products: input.products,
    analysis: input.analysis,
    changeReport: input.changeReport,
    provenanceMap: input.provenanceMap,
    totalVisionEligible: input.totalVisionEligible,
  });

  return clusters.map((cluster) =>
    clusterToRadarItem(
      cluster,
      input.products,
      input.changeReport,
      input.meta.collectedAt,
    ),
  );
}

export function buildRadarClusterStats(input: {
  products: AnalyzedProduct[];
  analysis: MarketAnalysis;
  changeReport: ChangeReport;
  provenanceMap: Map<string, import("./clusterTypes").ProductProvenance>;
  totalVisionEligible: number;
}): ClusterBuildStats {
  return buildDistinctiveClusters(input).stats;
}

export { buildMarketPalette };

export function buildRadarTopSummary(input: {
  analysis: MarketAnalysis;
  changeReport: ChangeReport;
  meta: RadarBuildInput;
}): RadarTopSummary {
  return {
    lastUpdated: input.meta.collectedAt,
    brandsChecked: input.meta.totalBrands,
    newProducts: input.changeReport.comparisonAvailable
      ? input.changeReport.newProducts.length
      : 0,
    significantMovements: input.changeReport.comparisonAvailable
      ? input.changeReport.topChanges.length
      : 0,
  };
}

export function buildBrandDiscoveryItems(
  changeReport: ChangeReport,
  products: AnalyzedProduct[],
): BrandDiscoveryItem[] {
  if (!changeReport.comparisonAvailable) return [];

  const brandMap = new Map<string, BrandDiscoveryItem>();

  for (const entry of changeReport.newProducts) {
    const brand = entry.brand;
    const existing = brandMap.get(brand);

    if (!existing) {
      brandMap.set(brand, {
        id: brandSourceId(brand),
        country: brandCountry(brand),
        brand,
        segment: "PREMIUM",
        whyNotable: "Son taramada yeni ürün",
        images: [
          {
            alt: entry.productName,
            url: entry.imageUrl,
          },
        ],
      });
      continue;
    }

    if (existing.images.length < 3 && entry.imageUrl) {
      existing.images.push({ alt: entry.productName, url: entry.imageUrl });
    }
  }

  for (const change of changeReport.signalChanges) {
    for (const brand of change.newlySeenBrands) {
      if (brandMap.has(brand)) continue;
      const sample = products.find((product) => product.brand === brand);
      brandMap.set(brand, {
        id: brandSourceId(brand),
        country: brandCountry(brand),
        brand,
        segment: "PREMIUM",
        whyNotable: `${labelTagTr(change.tag)} sinyalinde yeni marka`,
        images: sample?.imageUrl
          ? [{ alt: sample.productName, url: sample.imageUrl }]
          : [{ alt: brand, url: null }],
      });
    }
  }

  return [...brandMap.values()].slice(0, 8);
}

export function buildBrandExplorerItems(
  products: AnalyzedProduct[],
  analysis: MarketAnalysis,
): BrandExplorerItem[] {
  return analysis.brandBreakdown.map((entry) => {
    const brandProducts = products
      .filter((product) => product.brand === entry.brand && product.imageUrl)
      .slice(0, 3);

    return {
      id: brandSourceId(entry.brand),
      brand: entry.brand,
      country: registryCountryForBrand(entry.brand),
      segment: registrySegmentForBrand(entry.brand),
      classificationStatus: registryClassificationForBrand(entry.brand),
      footwearInfluence: entry.productCount,
      recentSignalCount: entry.topCategories[0]?.productCount ?? entry.productCount,
      images: brandProducts.map((product) => ({
        alt: product.productName,
        url: product.imageUrl,
      })),
    };
  });
}

export function buildBrandExplorerCountries(items: BrandExplorerItem[]): string[] {
  const countries = [
    ...new Set(
      items
        .map((item) => item.country.trim())
        .filter((country) => country.length > 0 && country.toLowerCase() !== "global"),
    ),
  ].sort((a, b) => a.localeCompare(b, "tr"));

  return ["Tümü", ...countries];
}

export function formatBrandExplorerSubtitle(item: BrandExplorerItem): string {
  if (item.classificationStatus === "REVIEWED" && item.segment !== "UNCLASSIFIED") {
    return `${item.country} · ${item.segment}`;
  }
  return item.country;
}

export function buildRadarMeta(input: RadarBuildInput) {
  return input;
}

export type { ClusterBuildStats, MarketPalette, RadarCluster };
