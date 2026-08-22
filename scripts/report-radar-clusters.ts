import analyzedProductsJson from "../data/multibrand/analyzed-products.json";
import marketAnalysisJson from "../data/multibrand/market-analysis.json";
import changeReportJson from "../data/history/latest-change-report.json";
import pilotNormalized from "../data/pilot/normalized-products.json";
import type { AnalyzedProduct, MarketAnalysis } from "../src/types/marketAnalysis";
import type { ChangeReport } from "../src/history/types";
import { buildDistinctiveClusters } from "../src/radar/distinctiveClusters";
import {
  buildProvenanceMap,
  canonicalProductKey,
  getProvenance,
} from "../src/radar/productProfile";

const products = analyzedProductsJson as AnalyzedProduct[];
const analysis = marketAnalysisJson as MarketAnalysis;
const changeReport = changeReportJson as ChangeReport;

const provenanceMap = buildProvenanceMap(
  pilotNormalized as Array<{
    productUrl: string;
    analysisCoverage?: { text?: boolean; vision?: boolean };
  }>,
);

for (const product of products) {
  const key = canonicalProductKey(product.productUrl);
  const existing = provenanceMap.get(key) ?? { text: true, vision: false };
  provenanceMap.set(key, { text: true, vision: existing.vision });
}

const totalVisionEligible = products.filter(
  (product) => getProvenance(provenanceMap, product.productUrl).vision,
).length;

const { clusters, stats } = buildDistinctiveClusters({
  products,
  analysis,
  changeReport,
  provenanceMap,
  totalVisionEligible,
});

console.log(
  JSON.stringify(
    {
      clusterCount: clusters.length,
      clusters: clusters.map((cluster) => ({
        labelTr: cluster.labelTr,
        productCount: cluster.productCount,
        brandCount: cluster.brandCount,
        modelFamilyCount: cluster.modelFamilyCount,
        evidenceStrength: cluster.evidenceStrength,
        distinctivenessScore: cluster.distinctivenessScore,
      })),
      rejectedRedundancy: stats.rejectedRedundancy,
      rejectedParentChild: stats.rejectedParentChild,
      rejectedOverlap: stats.rejectedOverlap,
    },
    null,
    2,
  ),
);
