import type { ChangeReport } from "../../history/types";
import type { AnalyzedProduct } from "../../types/marketAnalysis";
import type { ModelFamily } from "../../modelFamily/types";
import { FOOTWEAR_CATEGORIES } from "../../types/pilotProduct";
import type { ProductProvenance } from "../clusterTypes";
import { discoverCategoryDirections } from "./discoverDirections";
import { buildFamilyIndex, groupFamiliesByCategory } from "./familyIndex";
import type {
  CategoryRadarSlice,
  MasterRadarBuildResult,
  RadarSignalAuditReport,
} from "./types";

export function buildMasterRadar(input: {
  products: AnalyzedProduct[];
  families: ModelFamily[];
  changeReport: ChangeReport;
  provenanceMap: Map<string, ProductProvenance>;
  collectedAt: string;
}): MasterRadarBuildResult & { excludedGlobal: import("./types").ExcludedCandidate[] } {
  const productByUrl = new Map(
    input.products.map((product) => [product.productUrl, product]),
  );
  const indexedFamilies = buildFamilyIndex(input.families, productByUrl);
  const grouped = groupFamiliesByCategory(indexedFamilies);
  const excludedGlobal: import("./types").ExcludedCandidate[] = [];

  const categories: CategoryRadarSlice[] = FOOTWEAR_CATEGORIES.map((category) => {
    const families = grouped.get(category) ?? [];
    const { earlySignals, commercialSignals, excluded } = discoverCategoryDirections({
      category,
      families,
      provenanceMap: input.provenanceMap,
      comparisonAvailable: input.changeReport.comparisonAvailable,
    });
    excludedGlobal.push(...excluded);

    return {
      category,
      earlySignals,
      commercialSignals,
      familyCount: families.length,
    };
  }).filter((slice) => slice.familyCount > 0);

  const allSignals = categories.flatMap((slice) => [
    ...slice.earlySignals,
    ...slice.commercialSignals,
  ]);

  return {
    categories,
    allSignals,
    comparisonAvailable: input.changeReport.comparisonAvailable,
    collectedAt: input.collectedAt,
    excludedGlobal,
  };
}

export function buildRadarSignalAudit(
  result: MasterRadarBuildResult,
  excludedGlobal: import("./types").ExcludedCandidate[],
): RadarSignalAuditReport {
  return {
    generatedAt: new Date().toISOString(),
    comparisonAvailable: result.comparisonAvailable,
    totalSignals: result.allSignals.length,
    signals: result.allSignals.map((signal) => ({
      signalId: signal.id,
      category: signal.category,
      radarType: signal.radarType,
      directionName: signal.directionName,
      signalAttributes: signal.requiredAttributes,
      requiredAttributes: signal.requiredAttributes,
      includedModelFamilyIds: signal.allEvidence.map(
        (item) => item.modelFamilyId,
      ),
      includedBrands: signal.brands,
      excludedCandidates: [],
      stageEvidence: signal.allEvidence
        .filter((item) => item.stage)
        .map((item) => ({
          stage: item.stage!,
          brand: item.brand,
          modelFamilyId: item.modelFamilyId,
          segment: "UNKNOWN" as const,
          role: "UNKNOWN" as const,
        })),
      buyerValidation: signal.allEvidence.map((item) => ({
        modelFamilyId: item.modelFamilyId,
        sources: item.buyerValidation,
      })),
      historyEvidence: {
        comparisonAvailable: result.comparisonAvailable,
        momentumScore: signal.momentumScore,
        isChanging: signal.isChanging,
      },
      confidence: signal.confidence,
      rankingComponents: {
        brandBreadth: signal.independentBrandCount,
        brandQuality: 0,
        modelFamilyCount: signal.modelFamilyCount,
        distinctiveness: signal.requiredAttributes.length,
        stageFit: signal.rankingScore,
      },
    })),
    excludedGlobal,
  };
}
