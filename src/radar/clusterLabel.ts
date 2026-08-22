import { labelTagTr } from "../analysis/buildMarketAnalysis";
import type { ClusterAttribute, ClusterDimension } from "./clusterTypes";
import { pruneRedundantAttributes } from "./attributeSemantics";

const PAIR_FAMILIES: ClusterDimension[][] = [
  ["CATEGORY", "TOE_SHAPE"],
  ["CATEGORY", "HEEL_TYPE"],
  ["CATEGORY", "MATERIAL"],
  ["CATEGORY", "SURFACE_EFFECT"],
  ["CATEGORY", "DETAIL"],
  ["CATEGORY", "CONSTRUCTION"],
  ["TOE_SHAPE", "HEEL_TYPE"],
  ["HEEL_TYPE", "CONSTRUCTION"],
  ["MATERIAL", "DETAIL"],
  ["DETAIL", "CONSTRUCTION"],
  ["CATEGORY", "COLOR"],
  ["MATERIAL", "COLOR"],
  ["SURFACE_EFFECT", "COLOR"],
];

const TRIPLE_FAMILIES: ClusterDimension[][] = [
  ["CATEGORY", "DETAIL", "CONSTRUCTION"],
  ["CATEGORY", "MATERIAL", "DETAIL"],
  ["CATEGORY", "TOE_SHAPE", "HEEL_TYPE"],
  ["CATEGORY", "SURFACE_EFFECT", "CONSTRUCTION"],
];

export const COMBINATION_FAMILIES: ClusterDimension[][] = [
  ...PAIR_FAMILIES,
  ...TRIPLE_FAMILIES,
];

const CATEGORY_LABEL_OVERRIDES: Record<string, string> = {
  BALLERINA: "Babet",
  ANKLE_BOOT: "Bilek Bot",
  THONG: "Parmak Arası",
  OTHER_FOOTWEAR: "Ayakkabı",
};

const VALUE_LABEL_OVERRIDES: Record<string, string> = {
  FLAT: "Düz Topuk",
  POINTED: "Sivri Burun",
  ROUND: "Yuvarlak Burun",
  SQUARE: "Kare Burun",
  STILETTO: "Stiletto",
  BLOCK: "Kalın Topuk",
  LOW_VAMP: "Düşük Vamp",
  BACKLESS: "Arkasız",
  OPEN_TOE: "Açık Burun",
  ANKLE_STRAP: "Bilek Bantlı",
};

export function buildClusterLabel(attributes: ClusterAttribute[]): string {
  const meaningful = pruneRedundantAttributes(attributes);
  const labels = Object.fromEntries(
    meaningful.map((attribute) => [
      attribute.dimension,
      formatAttributeLabel(attribute),
    ]),
  ) as Partial<Record<ClusterDimension, string>>;

  if (labels.CATEGORY && labels.DETAIL) {
    return joinLabels(labels.DETAIL, labels.CATEGORY);
  }
  if (labels.CATEGORY && labels.CONSTRUCTION) {
    return joinLabels(labels.CONSTRUCTION, labels.CATEGORY);
  }
  if (labels.CATEGORY && labels.TOE_SHAPE) {
    return joinLabels(labels.TOE_SHAPE, labels.CATEGORY);
  }
  if (labels.CATEGORY && labels.HEEL_TYPE) {
    return joinLabels(labels.HEEL_TYPE, labels.CATEGORY);
  }
  if (labels.CATEGORY && labels.MATERIAL) {
    return joinLabels(labels.MATERIAL, labels.CATEGORY);
  }
  if (labels.CATEGORY && labels.SURFACE_EFFECT) {
    return joinLabels(labels.SURFACE_EFFECT, labels.CATEGORY);
  }
  if (labels.CATEGORY && labels.COLOR) {
    return joinLabels(labels.COLOR, labels.CATEGORY);
  }
  if (labels.TOE_SHAPE && labels.HEEL_TYPE) {
    return joinLabels(labels.TOE_SHAPE, labels.HEEL_TYPE);
  }
  if (labels.HEEL_TYPE && labels.CONSTRUCTION) {
    if (labels.CONSTRUCTION === "Düşük Vamp") {
      return joinLabels("Düşük Vamp", labels.HEEL_TYPE);
    }
    return joinLabels(labels.CONSTRUCTION, labels.HEEL_TYPE);
  }
  if (labels.MATERIAL && labels.DETAIL) {
    return joinLabels(labels.MATERIAL, labels.DETAIL);
  }
  if (labels.DETAIL && labels.CONSTRUCTION) {
    return joinLabels(labels.DETAIL, labels.CONSTRUCTION);
  }

  return joinLabels(
    ...meaningful.map((attribute) => formatAttributeLabel(attribute)),
  );
}

function joinLabels(...parts: Array<string | undefined>): string {
  return dedupeLabelWords(parts.filter(Boolean).join(" "));
}

function dedupeLabelWords(label: string): string {
  const words = label.split(/\s+/).filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const word of words) {
    const key = word.toLocaleLowerCase("tr");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(word);
  }
  return unique.join(" ");
}

function formatAttributeLabel(attribute: ClusterAttribute): string {
  if (attribute.dimension === "CATEGORY") {
    return CATEGORY_LABEL_OVERRIDES[attribute.value] ?? labelTagTr(attribute.value);
  }
  return VALUE_LABEL_OVERRIDES[attribute.value] ?? labelTagTr(attribute.value);
}

export function clusterKey(attributes: ClusterAttribute[]): string {
  return [...attributes]
    .sort((a, b) => a.dimension.localeCompare(b.dimension))
    .map((attribute) => `${attribute.dimension}:${attribute.value}`)
    .join("|");
}

export function clusterId(attributes: ClusterAttribute[]): string {
  return clusterKey(attributes)
    .toLowerCase()
    .replace(/[^a-z0-9|]+/g, "-");
}

export function isSingleDimensionCluster(attributes: ClusterAttribute[]): boolean {
  return attributes.length < 2;
}

export function isColorOnlyCluster(attributes: ClusterAttribute[]): boolean {
  return attributes.length === 1 && attributes[0]?.dimension === "COLOR";
}
