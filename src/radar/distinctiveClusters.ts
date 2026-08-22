import { labelTagTr } from "../analysis/buildMarketAnalysis";
import type { AnalyzedProduct, MarketAnalysis } from "../types/marketAnalysis";
import type { ChangeReport } from "../history/types";
import {
  attributeSpecificityRank,
  hasMinimumDistinctAttributes,
  isStrictAttributeSubset,
  pruneRedundantAttributes,
} from "./attributeSemantics";
import {
  buildClusterLabel,
  clusterId,
  clusterKey,
  COMBINATION_FAMILIES,
  isColorOnlyCluster,
  isSingleDimensionCluster,
} from "./clusterLabel";
import type {
  ClusterAttribute,
  ClusterBuildStats,
  ClusterDimension,
  ClusterEvidence,
  ClusterExampleProduct,
  EvidenceStrength,
  ProductProvenance,
  RadarCluster,
} from "./clusterTypes";
import {
  canonicalProductKey,
  dimensionRequiresVision,
  getAttributeValues,
  getProvenance,
  normalizeModelFamily,
} from "./productProfile";

const MIN_BRANDS = 2;
const MIN_MODEL_FAMILIES = 2;
const MAX_CLUSTERS = 12;
const MIN_RADAR_SCORE = 38;
const OVERLAP_THRESHOLD = 0.7;
const PARENT_CHILD_OVERLAP = 0.6;

const GENERIC_PAIR_KEYS = new Set([
  "CATEGORY:SANDAL|MATERIAL:LEATHER",
  "CATEGORY:PUMP|COLOR:BLACK",
  "CATEGORY:PUMP|MATERIAL:LEATHER",
  "HEEL_TYPE:FLAT|MATERIAL:LEATHER",
  "CATEGORY:SANDAL|COLOR:BLACK",
  "CATEGORY:BALLERINA|MATERIAL:LEATHER",
  "COLOR:BLACK|MATERIAL:LEATHER",
  "COLOR:BLACK|MATERIAL:SUEDE",
  "COLOR:BROWN|MATERIAL:LEATHER",
  "COLOR:BROWN|MATERIAL:SUEDE",
  "COLOR:BLACK|MATERIAL:SYNTHETIC",
]);

const DISTINCTIVE_DIMENSIONS = new Set<ClusterDimension>([
  "DETAIL",
  "CONSTRUCTION",
  "TOE_SHAPE",
  "SURFACE_EFFECT",
  "HEEL_TYPE",
]);

interface CandidateBucket {
  attributes: ClusterAttribute[];
  productKeys: Set<string>;
  modelFamilyKeys: Set<string>;
  products: AnalyzedProduct[];
}

interface ScoredCandidate {
  cluster: RadarCluster;
  productKeys: Set<string>;
  modelFamilyKeys: Set<string>;
}

function expandAttributeCombos(
  product: AnalyzedProduct,
  family: ClusterDimension[],
): ClusterAttribute[][] {
  const valueLists = family.map((dimension) =>
    getAttributeValues(product, dimension).map((value) => ({
      dimension,
      value,
    })),
  );

  if (valueLists.some((values) => values.length === 0)) return [];

  const combos: ClusterAttribute[][] = [];
  const walk = (index: number, current: ClusterAttribute[]) => {
    if (index >= valueLists.length) {
      combos.push([...current]);
      return;
    }
    for (const attribute of valueLists[index] ?? []) {
      current.push(attribute);
      walk(index + 1, current);
      current.pop();
    }
  };

  walk(0, []);
  return combos;
}

function computeGlobalFrequency(
  products: AnalyzedProduct[],
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const product of products) {
    const seen = new Set<string>();
    for (const family of COMBINATION_FAMILIES) {
      for (const combo of expandAttributeCombos(product, family)) {
        for (const attribute of combo) {
          const key = `${attribute.dimension}:${attribute.value}`;
          if (seen.has(key)) continue;
          seen.add(key);
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
    }
  }

  return counts;
}

function genericityPenalty(
  attributes: ClusterAttribute[],
  globalFrequency: Map<string, number>,
  totalProducts: number,
): number {
  const meaningful = pruneRedundantAttributes(attributes);
  const pairKey = [...meaningful]
    .sort((a, b) => a.dimension.localeCompare(b.dimension))
    .map((attribute) => `${attribute.dimension}:${attribute.value}`)
    .join("|");

  if (GENERIC_PAIR_KEYS.has(pairKey)) return 35;

  let penalty = 0;
  for (const attribute of meaningful) {
    const freq =
      (globalFrequency.get(`${attribute.dimension}:${attribute.value}`) ?? 0) /
      totalProducts;
    if (freq > 0.45) penalty += 12;
    else if (freq > 0.3) penalty += 6;
  }

  if (meaningful.length === 2) {
    const [a, b] = meaningful;
    const freqA =
      (globalFrequency.get(`${a!.dimension}:${a!.value}`) ?? 0) / totalProducts;
    const freqB =
      (globalFrequency.get(`${b!.dimension}:${b!.value}`) ?? 0) / totalProducts;
    if (freqA > 0.3 && freqB > 0.3) penalty += 10;
  }

  return Math.min(penalty, 45);
}

function computeEvidence(
  products: AnalyzedProduct[],
  attributes: ClusterAttribute[],
  provenanceMap: Map<string, ProductProvenance>,
  totalProducts: number,
  totalVisionEligible: number,
): ClusterEvidence {
  let textEvidenceCount = 0;
  let visionEvidenceCount = 0;
  let hybridEvidenceCount = 0;

  const requiresVision = attributes.some((attribute) =>
    dimensionRequiresVision(attribute.dimension),
  );
  const analyzedEligibleProducts = requiresVision
    ? Math.max(totalVisionEligible, 1)
    : Math.max(totalProducts, 1);

  for (const product of products) {
    const provenance = getProvenance(provenanceMap, product.productUrl);
    if (provenance.text) textEvidenceCount += 1;
    if (provenance.vision) visionEvidenceCount += 1;
    if (provenance.text && provenance.vision) hybridEvidenceCount += 1;
  }

  const measured = requiresVision ? visionEvidenceCount : textEvidenceCount;

  return {
    textEvidenceCount,
    visionEvidenceCount,
    hybridEvidenceCount,
    analyzedEligibleProducts,
    evidenceCoverage:
      analyzedEligibleProducts > 0 ? measured / analyzedEligibleProducts : 0,
  };
}

function computeEvidenceStrength(input: {
  brandCount: number;
  modelFamilyCount: number;
  evidenceCoverage: number;
}): EvidenceStrength {
  let strength: EvidenceStrength =
    input.brandCount >= 5
      ? "STRONG"
      : input.brandCount >= 3
        ? "MEDIUM"
        : "WEAK";

  if (strength === "STRONG") {
    if (input.modelFamilyCount < 4 || input.evidenceCoverage < 0.12) {
      strength = "MEDIUM";
    }
  }

  if (strength === "MEDIUM") {
    if (input.modelFamilyCount < 2 || input.evidenceCoverage < 0.06) {
      strength = "WEAK";
    }
  }

  if (
    strength === "WEAK" &&
    input.brandCount >= 3 &&
    input.modelFamilyCount >= 3 &&
    input.evidenceCoverage >= 0.1
  ) {
    strength = "MEDIUM";
  }

  return strength;
}

function attributeSpecificityBonus(attributes: ClusterAttribute[]): number {
  const meaningful = pruneRedundantAttributes(attributes);
  const dimensions = new Set(meaningful.map((attribute) => attribute.dimension));
  const hasCategory = dimensions.has("CATEGORY");
  const distinctiveCount = [...dimensions].filter((dimension) =>
    DISTINCTIVE_DIMENSIONS.has(dimension),
  ).length;
  const colorOnlyPair =
    meaningful.length === 2 &&
    dimensions.has("COLOR") &&
    (dimensions.has("MATERIAL") || dimensions.has("CATEGORY"));

  let bonus = distinctiveCount * 8;
  if (hasCategory && distinctiveCount >= 1) bonus += 8;
  if (meaningful.length >= 3) bonus += 10;
  if (colorOnlyPair) bonus -= 14;
  return bonus;
}

function computeDistinctivenessScore(input: {
  brandCount: number;
  modelFamilyCount: number;
  productCount: number;
  attributes: ClusterAttribute[];
  evidenceCoverage: number;
  genericityPenaltyValue: number;
  totalBrands: number;
}): number {
  const brandScore =
    Math.min(input.brandCount / Math.max(input.totalBrands, 1), 1) * 46;
  const modelScore = Math.min(input.modelFamilyCount / 5, 1) * 14;
  const diversityScore =
    input.productCount > 0
      ? Math.min(input.brandCount / input.productCount, 1) * 12
      : 0;
  const evidenceScore = input.evidenceCoverage * 10;
  const specificityScore = attributeSpecificityBonus(input.attributes);
  const weakBrandPenalty = input.brandCount <= 2 ? 10 : 0;
  const specificityRankBonus = attributeSpecificityRank(input.attributes) * 4;

  const raw =
    brandScore +
    modelScore +
    diversityScore +
    evidenceScore +
    specificityScore +
    specificityRankBonus -
    input.genericityPenaltyValue -
    weakBrandPenalty;

  return Math.max(0, Math.min(100, Math.round(raw)));
}

function overlapRatio(a: Set<string>, b: Set<string>): number {
  const intersection = [...a].filter((key) => b.has(key)).length;
  const union = new Set([...a, ...b]).size;
  return union > 0 ? intersection / union : 0;
}

function coverageRatio(subset: Set<string>, superset: Set<string>): number {
  if (subset.size === 0) return 0;
  const intersection = [...subset].filter((key) => superset.has(key)).length;
  return intersection / subset.size;
}

function buildCandidateBuckets(products: AnalyzedProduct[]): {
  buckets: CandidateBucket[];
  rejectedRedundancy: number;
} {
  const map = new Map<string, CandidateBucket>();
  let rejectedRedundancy = 0;

  for (const product of products) {
    for (const family of COMBINATION_FAMILIES) {
      for (const attributes of expandAttributeCombos(product, family)) {
        if (isSingleDimensionCluster(attributes) || isColorOnlyCluster(attributes)) {
          continue;
        }
        if (!hasMinimumDistinctAttributes(attributes)) {
          rejectedRedundancy += 1;
          continue;
        }

        const key = clusterKey(attributes);
        if (!map.has(key)) {
          map.set(key, {
            attributes,
            productKeys: new Set(),
            modelFamilyKeys: new Set(),
            products: [],
          });
        }

        const bucket = map.get(key)!;
        const productKey = canonicalProductKey(product.productUrl);
        if (bucket.productKeys.has(productKey)) continue;
        bucket.productKeys.add(productKey);
        bucket.modelFamilyKeys.add(
          `${product.brand}::${normalizeModelFamily(product.productName)}`,
        );
        bucket.products.push(product);
      }
    }
  }

  return { buckets: [...map.values()], rejectedRedundancy };
}

function bucketToCluster(
  bucket: CandidateBucket,
  input: {
    globalFrequency: Map<string, number>;
    totalProducts: number;
    totalBrands: number;
    provenanceMap: Map<string, ProductProvenance>;
    totalVisionEligible: number;
    comparisonAvailable: boolean;
  },
): RadarCluster | null {
  if (!hasMinimumDistinctAttributes(bucket.attributes)) return null;

  const brands = [...new Set(bucket.products.map((product) => product.brand))].sort();
  if (brands.length < MIN_BRANDS) return null;

  if (bucket.modelFamilyKeys.size < MIN_MODEL_FAMILIES) return null;

  const categories = [
    ...new Set(
      bucket.products
        .map((product) => product.normalized.category ?? product.category)
        .filter(Boolean) as string[],
    ),
  ];

  const penalty = genericityPenalty(
    bucket.attributes,
    input.globalFrequency,
    input.totalProducts,
  );
  const evidence = computeEvidence(
    bucket.products,
    bucket.attributes,
    input.provenanceMap,
    input.totalProducts,
    input.totalVisionEligible,
  );

  const distinctivenessScore = computeDistinctivenessScore({
    brandCount: brands.length,
    modelFamilyCount: bucket.modelFamilyKeys.size,
    productCount: bucket.products.length,
    attributes: bucket.attributes,
    evidenceCoverage: evidence.evidenceCoverage,
    genericityPenaltyValue: penalty,
    totalBrands: input.totalBrands,
  });

  if (distinctivenessScore < 20) return null;

  const evidenceStrength = computeEvidenceStrength({
    brandCount: brands.length,
    modelFamilyCount: bucket.modelFamilyKeys.size,
    evidenceCoverage: evidence.evidenceCoverage,
  });

  const exampleProducts: ClusterExampleProduct[] = bucket.products
    .filter((product) => product.imageUrl)
    .slice(0, 8)
    .map((product) => ({
      brand: product.brand,
      productName: product.productName,
      productUrl: product.productUrl,
      imageUrl: product.imageUrl,
    }));

  return {
    id: clusterId(bucket.attributes),
    labelTr: buildClusterLabel(bucket.attributes),
    attributes: bucket.attributes,
    productCount: bucket.products.length,
    brandCount: brands.length,
    modelFamilyCount: bucket.modelFamilyKeys.size,
    brands,
    categories,
    exampleProducts,
    distinctivenessScore,
    evidenceStrength,
    evidence,
    snapshotStatus: input.comparisonAvailable ? "KARŞILAŞTIRMA" : "İLK ÖLÇÜM",
  };
}

function childAddsDistinctCoverage(
  child: ScoredCandidate,
  parent: ScoredCandidate,
): boolean {
  const productGain =
    child.cluster.productCount / Math.max(parent.cluster.productCount, 1);
  const brandGain = child.cluster.brandCount - parent.cluster.brandCount;
  const familyGain =
    child.cluster.modelFamilyCount - parent.cluster.modelFamilyCount;

  return (
    child.cluster.brandCount >= 2 &&
    (productGain <= 0.85 ||
      brandGain >= 1 ||
      familyGain >= 2 ||
      attributeSpecificityRank(child.cluster.attributes) >
        attributeSpecificityRank(parent.cluster.attributes))
  );
}

function compareCandidates(a: ScoredCandidate, b: ScoredCandidate): number {
  return (
    b.cluster.distinctivenessScore - a.cluster.distinctivenessScore ||
    b.cluster.brandCount - a.cluster.brandCount ||
    attributeSpecificityRank(b.cluster.attributes) -
      attributeSpecificityRank(a.cluster.attributes) ||
    b.cluster.modelFamilyCount - a.cluster.modelFamilyCount ||
    b.cluster.evidence.evidenceCoverage - a.cluster.evidence.evidenceCoverage
  );
}

function dedupeAndSelectClusters(candidates: ScoredCandidate[]): {
  selected: RadarCluster[];
  rejectedOverlap: number;
  rejectedParentChild: number;
  rejectedWeakQuality: number;
} {
  const sorted = [...candidates].sort(compareCandidates);
  const selected: ScoredCandidate[] = [];
  let rejectedOverlap = 0;
  let rejectedParentChild = 0;
  let rejectedWeakQuality = 0;

  for (const candidate of sorted) {
    if (
      selected.length >= MAX_CLUSTERS &&
      candidate.cluster.distinctivenessScore < MIN_RADAR_SCORE
    ) {
      rejectedWeakQuality += 1;
      continue;
    }

    const labelIndex = selected.findIndex(
      (existing) => existing.cluster.labelTr === candidate.cluster.labelTr,
    );
    if (labelIndex >= 0) {
      rejectedOverlap += 1;
      continue;
    }

    const overlapIndex = selected.findIndex(
      (existing) =>
        overlapRatio(candidate.productKeys, existing.productKeys) >=
        OVERLAP_THRESHOLD,
    );
    if (overlapIndex >= 0) {
      rejectedOverlap += 1;
      continue;
    }

    const parentIndex = selected.findIndex(
      (existing) =>
        isStrictAttributeSubset(
          candidate.cluster.attributes,
          existing.cluster.attributes,
        ) &&
        coverageRatio(existing.productKeys, candidate.productKeys) >=
          PARENT_CHILD_OVERLAP,
    );
    if (parentIndex >= 0) {
      const parent = selected[parentIndex]!;
      if (childAddsDistinctCoverage(candidate, parent)) {
        selected.splice(parentIndex, 1);
        rejectedParentChild += 1;
      } else {
        rejectedParentChild += 1;
        continue;
      }
    }

    const dominatedByChild = selected.some(
      (existing) =>
        isStrictAttributeSubset(
          existing.cluster.attributes,
          candidate.cluster.attributes,
        ) &&
        coverageRatio(candidate.productKeys, existing.productKeys) >=
          PARENT_CHILD_OVERLAP &&
        childAddsDistinctCoverage(existing, candidate),
    );
    if (dominatedByChild) {
      rejectedParentChild += 1;
      continue;
    }

    selected.push(candidate);
    if (selected.length >= MAX_CLUSTERS) break;
  }

  return {
    selected: selected.map((candidate) => candidate.cluster),
    rejectedOverlap,
    rejectedParentChild,
    rejectedWeakQuality,
  };
}

export function buildDistinctiveClusters(input: {
  products: AnalyzedProduct[];
  analysis: MarketAnalysis;
  changeReport: ChangeReport;
  provenanceMap: Map<string, ProductProvenance>;
  totalVisionEligible: number;
}): { clusters: RadarCluster[]; stats: ClusterBuildStats } {
  const globalFrequency = computeGlobalFrequency(input.products);
  const { buckets, rejectedRedundancy: skippedRedundantCombos } =
    buildCandidateBuckets(input.products);

  let rejectedGenericity = 0;
  let rejectedRedundancy = skippedRedundantCombos;
  let rejectedMinBrands = 0;
  let rejectedUnknown = 0;
  const candidates: ScoredCandidate[] = [];

  for (const bucket of buckets) {
    if (bucket.attributes.some((attribute) => attribute.value === "UNKNOWN")) {
      rejectedUnknown += 1;
      continue;
    }

    if (!hasMinimumDistinctAttributes(bucket.attributes)) {
      rejectedRedundancy += 1;
      continue;
    }

    const cluster = bucketToCluster(bucket, {
      globalFrequency,
      totalProducts: input.products.length,
      totalBrands: input.analysis.totalBrands,
      provenanceMap: input.provenanceMap,
      totalVisionEligible: input.totalVisionEligible,
      comparisonAvailable: input.changeReport.comparisonAvailable,
    });

    if (!cluster) {
      const brands = new Set(bucket.products.map((product) => product.brand));
      if (brands.size < MIN_BRANDS) rejectedMinBrands += 1;
      else rejectedGenericity += 1;
      continue;
    }

    candidates.push({
      cluster,
      productKeys: bucket.productKeys,
      modelFamilyKeys: bucket.modelFamilyKeys,
    });
  }

  const { selected, rejectedOverlap, rejectedParentChild, rejectedWeakQuality } =
    dedupeAndSelectClusters(candidates);

  return {
    clusters: selected,
    stats: {
      candidatesGenerated: buckets.length,
      rejectedGenericity,
      rejectedRedundancy,
      rejectedOverlap,
      rejectedParentChild,
      rejectedMinBrands,
      rejectedUnknown,
      rejectedWeakQuality,
      selectedCount: selected.length,
    },
  };
}

export function buildMarketPalette(analysis: MarketAnalysis): {
  colors: Array<{ label: string; productCount: number; brandCount: number }>;
  materials: Array<{ label: string; productCount: number; brandCount: number }>;
  categories: Array<{ label: string; productCount: number; brandCount: number }>;
  heelTypes: Array<{ label: string; productCount: number; brandCount: number }>;
  constructions: Array<{ label: string; productCount: number; brandCount: number }>;
} {
  const mapEntries = (
    counts: Array<{ tag: string; productCount: number; brandCount: number }>,
  ) =>
    counts
      .filter((entry) => !["UNKNOWN", "OTHER", "OTHER_FOOTWEAR"].includes(entry.tag))
      .slice(0, 8)
      .map((entry) => ({
        label: labelTagTr(entry.tag),
        productCount: entry.productCount,
        brandCount: entry.brandCount,
      }));

  return {
    colors: mapEntries(analysis.colors),
    materials: mapEntries(analysis.materials),
    categories: mapEntries(analysis.categories),
    heelTypes: mapEntries(analysis.heelTypes),
    constructions: mapEntries(analysis.constructions),
  };
}

export function productMatchesRadarCluster(
  product: AnalyzedProduct,
  cluster: RadarCluster,
): boolean {
  return cluster.attributes.every((attribute) =>
    getAttributeValues(product, attribute.dimension).includes(attribute.value),
  );
}
