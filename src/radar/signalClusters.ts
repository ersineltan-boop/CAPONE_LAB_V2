import { labelTagTr } from "../analysis/buildMarketAnalysis";
import type { AnalyzedProduct, MarketAnalysis, TagCount } from "../types/marketAnalysis";
import type { SignalDimension } from "../history/types";
import type { RadarSignalDimension, RealSignalCluster } from "./types";

const MIN_BRAND_COUNT = 2;
const SKIP_TAGS = new Set(["UNKNOWN", "OTHER", "OTHER_FOOTWEAR"]);

const DIMENSION_MAP: Record<RadarSignalDimension, SignalDimension> = {
  CATEGORY: "category",
  COLOR: "colorFamily",
  MATERIAL: "materialFamily",
  HEEL: "heelType",
  DETAIL: "details",
  CONSTRUCTION: "construction",
};

const RADAR_DIMENSION_LABEL: Record<RadarSignalDimension, string> = {
  CATEGORY: "Kategori",
  COLOR: "Renk",
  MATERIAL: "Materyal",
  HEEL: "Topuk",
  DETAIL: "Detay",
  CONSTRUCTION: "Konstrüksiyon",
};

export function radarDimensionLabel(dimension: RadarSignalDimension): string {
  return RADAR_DIMENSION_LABEL[dimension];
}

export function toHistoryDimension(
  dimension: RadarSignalDimension,
): SignalDimension {
  return DIMENSION_MAP[dimension];
}

function tagCountsFromMarket(
  analysis: MarketAnalysis,
): Array<{ dimension: RadarSignalDimension; counts: TagCount[] }> {
  return [
    { dimension: "CATEGORY", counts: analysis.categories },
    { dimension: "COLOR", counts: analysis.colors },
    { dimension: "MATERIAL", counts: analysis.materials },
    { dimension: "HEEL", counts: analysis.heelTypes },
    { dimension: "DETAIL", counts: analysis.details },
    { dimension: "CONSTRUCTION", counts: analysis.constructions },
  ];
}

export function productMatchesCluster(
  product: AnalyzedProduct,
  dimension: RadarSignalDimension,
  tag: string,
): boolean {
  switch (dimension) {
    case "CATEGORY":
      return (product.normalized.category ?? "UNKNOWN") === tag;
    case "COLOR":
      return product.normalized.colorFamily === tag;
    case "MATERIAL":
      return product.normalized.materialFamily === tag;
    case "HEEL":
      return product.normalized.heelType === tag;
    case "DETAIL":
      return product.normalized.details.includes(tag as never);
    case "CONSTRUCTION":
      return product.normalized.construction.includes(tag as never);
    default:
      return false;
  }
}

export function buildRealSignalClusters(
  products: AnalyzedProduct[],
  analysis: MarketAnalysis,
): RealSignalCluster[] {
  const clusters: RealSignalCluster[] = [];

  for (const { dimension, counts } of tagCountsFromMarket(analysis)) {
    for (const count of counts) {
      if (count.brandCount < MIN_BRAND_COUNT) continue;
      if (SKIP_TAGS.has(count.tag)) continue;

      const matching = products.filter((product) =>
        productMatchesCluster(product, dimension, count.tag),
      );

      clusters.push({
        id: `${dimension.toLowerCase()}-${count.tag.toLowerCase()}`,
        title: labelTagTr(count.tag),
        dimension,
        tag: count.tag,
        productCount: count.productCount,
        brandCount: count.brandCount,
        brands: count.brands,
        exampleProductUrls: matching.slice(0, 12).map((product) => product.productUrl),
      });
    }
  }

  return clusters.sort(
    (a, b) =>
      b.productCount - a.productCount ||
      b.brandCount - a.brandCount ||
      a.title.localeCompare(b.title, "tr"),
  );
}

export function selectRadarClusters(clusters: RealSignalCluster[]): RealSignalCluster[] {
  const selected: RealSignalCluster[] = [];
  const perDimension = new Map<RadarSignalDimension, number>();

  for (const cluster of clusters) {
    const used = perDimension.get(cluster.dimension) ?? 0;
    if (used >= 3) continue;
    selected.push(cluster);
    perDimension.set(cluster.dimension, used + 1);
    if (selected.length >= 12) break;
  }

  return selected;
}

export function topCategoryMix(
  products: AnalyzedProduct[],
): string {
  const counts = new Map<string, number>();
  for (const product of products) {
    const category = product.normalized.category ?? "OTHER";
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([category, count]) => `${labelTagTr(category)} (${count})`)
    .join(" · ");
}
