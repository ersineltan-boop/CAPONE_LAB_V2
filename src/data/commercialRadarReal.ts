import { analyzedProducts } from "./analyzedProducts";
import { changeReport } from "./changeReport";
import { marketAnalysis } from "./marketAnalysis";
import { modelFamilies } from "./modelFamilies";
import pilotNormalized from "../../data/pilot/normalized-products.json";
import { buildMasterRadar } from "../radar/master/buildMasterRadar";
import { mapMasterRadarItems } from "../radar/master/mapToUi";
import {
  buildBrandDiscoveryItems,
  buildBrandExplorerCountries,
  buildBrandExplorerItems,
  buildMarketPalette,
  buildRadarMeta,
  buildRadarTopSummary,
} from "../radar/buildCommercialRadar";
import {
  buildProvenanceMap,
  canonicalProductKey,
  getProvenance,
} from "../radar/productProfile";

const snapshotSummaries = import.meta.glob("../../data/history/*/summary.json", {
  eager: true,
}) as Record<string, { default: { collectedAt: string; snapshotId: string } }>;

function resolveCollectedAt(): string {
  const snapshotId = changeReport.currentSnapshotId;
  if (snapshotId) {
    const match = Object.entries(snapshotSummaries).find(([path]) =>
      path.includes(`/${snapshotId}/`),
    );
    if (match?.[1]?.default?.collectedAt) {
      return match[1].default.collectedAt;
    }
  }

  return changeReport.generatedAt;
}

const provenanceMap = buildProvenanceMap(
  pilotNormalized as Array<{
    productUrl: string;
    analysisCoverage?: { text?: boolean; vision?: boolean };
  }>,
);

for (const product of analyzedProducts) {
  const key = canonicalProductKey(product.productUrl);
  const existing = provenanceMap.get(key) ?? { text: true, vision: false };
  provenanceMap.set(key, { text: true, vision: existing.vision });
}

const totalVisionEligible = analyzedProducts.filter(
  (product) => getProvenance(provenanceMap, product.productUrl).vision,
).length;

const collectedAt = resolveCollectedAt();

const radarMeta = buildRadarMeta({
  comparisonAvailable: changeReport.comparisonAvailable,
  collectedAt,
  totalProducts: marketAnalysis.totalProducts,
  totalBrands: marketAnalysis.totalBrands,
});

export const masterRadar = buildMasterRadar({
  products: analyzedProducts,
  families: modelFamilies,
  changeReport,
  provenanceMap,
  collectedAt,
});

export const commercialRadarItems = mapMasterRadarItems(masterRadar);

export const radarClusterStats = {
  totalSignals: masterRadar.allSignals.length,
  categoriesWithSignals: masterRadar.categories.filter(
    (slice) => slice.earlySignals.length > 0 || slice.commercialSignals.length > 0,
  ).length,
  totalVisionEligible,
};

export const marketPalette = buildMarketPalette(marketAnalysis);

export const radarTopSummary = buildRadarTopSummary({
  analysis: marketAnalysis,
  changeReport,
  meta: radarMeta,
});

export const brandDiscoveryItems = buildBrandDiscoveryItems(
  changeReport,
  analyzedProducts,
);

export const brandExplorerItems = buildBrandExplorerItems(
  analyzedProducts,
  marketAnalysis,
);

export const brandExplorerCountries = buildBrandExplorerCountries(brandExplorerItems);

export { radarMeta };
