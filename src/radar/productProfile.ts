import type { AnalyzedProduct } from "../types/marketAnalysis";
import type { ClusterDimension, ProductProvenance } from "./clusterTypes";

const SKIP = new Set(["UNKNOWN", "OTHER", "OTHER_FOOTWEAR"]);

export function normalizeModelFamily(productName: string): string {
  return productName
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\b(p26|p\d+|s\d+|ss\d+|fw\d+|aw\d+)\b/gi, "")
    .replace(/\b(black|white|brown|tan|nude|gold|silver|burgundy|red|blue|pink|beige|cream|espresso|platinum|metallic)\b/gi, "")
    .replace(/\b(leather|suede|patent|nappa|metallic|sandal|pump|mule|loafer|sneaker|boot)\b/gi, "")
    .replace(/\b(high|mid|low|heel|flat|block|stiletto)\b/gi, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalProductKey(productUrl: string): string {
  return productUrl.replace(/\/$/, "").toLowerCase();
}

export function inferSurfaceEffect(product: AnalyzedProduct): string | null {
  const material = product.normalized.materialFamily;
  if (material === "PATENT") return "PATENT";
  if (material === "CROC_EFFECT") return "CROC_EFFECT";
  if (material === "WOVEN_LEATHER") return "WOVEN";
  if (product.normalized.details.includes("WOVEN")) return "WOVEN";
  if (product.normalized.materialFamily === "METALLIC_LEATHER") return "METALLIC";
  return null;
}

export function getAttributeValues(
  product: AnalyzedProduct,
  dimension: ClusterDimension,
): string[] {
  switch (dimension) {
    case "CATEGORY": {
      const value = product.normalized.category ?? product.category;
      return value && !SKIP.has(value) ? [value] : [];
    }
    case "TOE_SHAPE": {
      const value = product.normalized.toeShape;
      return value && !SKIP.has(value) ? [value] : [];
    }
    case "HEEL_TYPE": {
      const value = product.normalized.heelType;
      return value && !SKIP.has(value) ? [value] : [];
    }
    case "MATERIAL": {
      const value = product.normalized.materialFamily;
      return value && !SKIP.has(value) ? [value] : [];
    }
    case "COLOR": {
      const value = product.normalized.colorFamily;
      return value && !SKIP.has(value) ? [value] : [];
    }
    case "DETAIL":
      return product.normalized.details.filter((value) => !SKIP.has(value));
    case "CONSTRUCTION":
      return product.normalized.construction.filter((value) => !SKIP.has(value));
    case "SURFACE_EFFECT": {
      const value = inferSurfaceEffect(product);
      return value && !SKIP.has(value) ? [value] : [];
    }
    default:
      return [];
  }
}

export function dimensionRequiresVision(dimension: ClusterDimension): boolean {
  return (
    dimension === "TOE_SHAPE" ||
    dimension === "DETAIL" ||
    dimension === "CONSTRUCTION" ||
    dimension === "SURFACE_EFFECT"
  );
}

export function buildProvenanceMap(
  products: Array<{
    productUrl: string;
    analysisCoverage?: { text?: boolean; vision?: boolean };
  }>,
): Map<string, ProductProvenance> {
  const map = new Map<string, ProductProvenance>();

  for (const product of products) {
    const key = canonicalProductKey(product.productUrl);
    const text = product.analysisCoverage?.text ?? true;
    const vision = product.analysisCoverage?.vision ?? false;
    map.set(key, {
      text,
      vision,
      ...(vision && text ? { hybrid: true } : {}),
    });
  }

  return map;
}

export function getProvenance(
  map: Map<string, ProductProvenance>,
  productUrl: string,
): ProductProvenance {
  return map.get(canonicalProductKey(productUrl)) ?? { text: true, vision: false };
}
