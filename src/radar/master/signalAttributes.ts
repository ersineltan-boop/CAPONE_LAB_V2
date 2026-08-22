import type { AnalyzedProduct } from "../../types/marketAnalysis";
import type { ProductProvenance } from "../clusterTypes";
import {
  dimensionRequiresVision,
  getAttributeValues,
  getProvenance,
} from "../productProfile";
import { productHasStrictVerifiedAttribute } from "../../vision/verification/verifiedRadarGate";
import type { VisualFeatureMap } from "../../vision/verification/types";
import type { SignalAttribute, SignalDimension } from "./types";

const SKIP = new Set(["UNKNOWN", "OTHER", "OTHER_FOOTWEAR"]);

const DIMENSION_MAP: Record<SignalDimension, import("../clusterTypes").ClusterDimension> =
  {
    TOE_SHAPE: "TOE_SHAPE",
    HEEL_TYPE: "HEEL_TYPE",
    HEEL_HEIGHT_GROUP: "HEEL_TYPE",
    DETAIL: "DETAIL",
    CONSTRUCTION: "CONSTRUCTION",
    SURFACE_EFFECT: "SURFACE_EFFECT",
  };

export const SIGNAL_COMBINATION_FAMILIES: SignalDimension[][] = [
  ["TOE_SHAPE", "CONSTRUCTION"],
  ["TOE_SHAPE", "HEEL_TYPE"],
  ["HEEL_TYPE", "CONSTRUCTION"],
  ["DETAIL", "CONSTRUCTION"],
  ["TOE_SHAPE", "DETAIL"],
  ["HEEL_TYPE", "DETAIL"],
  ["SURFACE_EFFECT", "CONSTRUCTION"],
  ["TOE_SHAPE", "HEEL_TYPE", "CONSTRUCTION"],
  ["DETAIL", "CONSTRUCTION", "HEEL_TYPE"],
];

export function getSignalDimensionValues(
  product: AnalyzedProduct,
  dimension: SignalDimension,
): string[] {
  if (dimension === "HEEL_HEIGHT_GROUP") {
    const value = product.normalized.heelHeightGroup;
    return value && !SKIP.has(value) ? [value] : [];
  }

  const clusterDimension = DIMENSION_MAP[dimension];
  return getAttributeValues(product, clusterDimension);
}

export function productHasRequiredAttributes(
  product: AnalyzedProduct,
  required: SignalAttribute[],
  provenanceMap: Map<string, ProductProvenance>,
  verifiedFeaturesByUrl?: Map<string, VisualFeatureMap>,
): boolean {
  for (const attribute of required) {
    const requiresVision = dimensionRequiresVision(
      DIMENSION_MAP[attribute.dimension],
    );
    const provenance = getProvenance(provenanceMap, product.productUrl);
    const verifiedFeatures = verifiedFeaturesByUrl?.get(product.productUrl);

    if (requiresVision) {
      if (verifiedFeatures) {
        if (!productHasStrictVerifiedAttribute(verifiedFeatures, attribute)) {
          return false;
        }
        continue;
      }
      if (!provenance.vision) {
        return false;
      }
    }

    const values = getSignalDimensionValues(product, attribute.dimension);
    if (values.length === 0 || !values.includes(attribute.value)) {
      return false;
    }
  }

  return true;
}

export function expandSignalCombos(
  product: AnalyzedProduct,
  family: SignalDimension[],
): SignalAttribute[][] {
  const valueLists = family.map((dimension) =>
    getSignalDimensionValues(product, dimension).map((value) => ({
      dimension,
      value,
    })),
  );

  if (valueLists.some((values) => values.length === 0)) return [];

  const combos: SignalAttribute[][] = [];
  const walk = (index: number, current: SignalAttribute[]) => {
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

export function signalKey(
  category: string,
  attributes: SignalAttribute[],
): string {
  const sorted = [...attributes]
    .sort(
      (a, b) =>
        a.dimension.localeCompare(b.dimension) || a.value.localeCompare(b.value),
    )
    .map((attribute) => `${attribute.dimension}:${attribute.value}`)
    .join("|");

  return `${category}::${sorted}`;
}

export function isCategoryOnlySignal(attributes: SignalAttribute[]): boolean {
  return attributes.length === 0;
}

export function isSingleAttributeSignal(attributes: SignalAttribute[]): boolean {
  return attributes.length === 1;
}

export function containsForbiddenDimension(
  attributes: SignalAttribute[],
): boolean {
  return attributes.some(
    (attribute) =>
      attribute.dimension === ("COLOR" as SignalDimension) ||
      attribute.dimension === ("MATERIAL" as SignalDimension),
  );
}
