import type { AnalyzedProduct, TagCount } from "../analysis/types";
import type { SnapshotProduct, SnapshotSignals, SnapshotSummary } from "./types";

function canonicalUrl(url: string): string {
  return url.replace(/\/$/, "").toLowerCase();
}

function countTags(
  products: AnalyzedProduct[],
  getTags: (product: AnalyzedProduct) => string[],
): TagCount[] {
  const map = new Map<string, Set<string>>();

  for (const product of products) {
    for (const tag of getTags(product)) {
      if (!map.has(tag)) map.set(tag, new Set());
      map.get(tag)!.add(product.brand);
    }
  }

  return [...map.entries()]
    .map(([tag, brands]) => ({
      tag,
      productCount: products.filter((item) => getTags(item).includes(tag)).length,
      brandCount: brands.size,
      brands: [...brands].sort(),
    }))
    .sort((a, b) => b.productCount - a.productCount || a.tag.localeCompare(b.tag));
}

function countSingle(
  products: AnalyzedProduct[],
  getTag: (product: AnalyzedProduct) => string,
): TagCount[] {
  return countTags(products, (product) => {
    const tag = getTag(product);
    return tag === "UNKNOWN" ? [] : [tag];
  });
}

export function buildSnapshotSignals(products: AnalyzedProduct[]): SnapshotSignals {
  return {
    category: countSingle(products, (product) => product.normalized.category ?? "UNKNOWN"),
    colorFamily: countSingle(products, (product) => product.normalized.colorFamily),
    materialFamily: countSingle(products, (product) => product.normalized.materialFamily),
    heelType: countSingle(products, (product) => product.normalized.heelType),
    details: countTags(products, (product) => product.normalized.details),
    construction: countTags(products, (product) => product.normalized.construction),
    surfaceEffects: [],
  };
}

export function buildSnapshotProducts(
  products: AnalyzedProduct[],
  collectedAt: string,
  previousSeen: Map<string, { firstSeen: string; lastSeen: string }>,
): SnapshotProduct[] {
  return products.map((product) => {
    const key = canonicalUrl(product.productUrl);
    const prior = previousSeen.get(key);

    return {
      productUrl: product.productUrl,
      brand: product.brand,
      productName: product.productName,
      imageUrl: product.imageUrl,
      category: product.category,
      color: product.cleaned.color ?? product.color,
      material: product.material,
      colorFamily: product.normalized.colorFamily,
      materialFamily: product.normalized.materialFamily,
      heelType: product.normalized.heelType,
      heelHeightGroup: product.normalized.heelHeightGroup,
      toeShape: product.normalized.toeShape,
      details: product.normalized.details,
      construction: product.normalized.construction,
      surfaceEffects: [],
      firstSeen: prior?.firstSeen ?? collectedAt,
      lastSeen: collectedAt,
      isNew: !prior,
    };
  });
}

export function buildSnapshotSummary(
  snapshotId: string,
  collectedAt: string,
  products: SnapshotProduct[],
): SnapshotSummary {
  const brands = new Set(products.map((product) => product.brand));
  const analyzedLike = products.map((product) => ({
    brand: product.brand,
    normalized: {
      category: product.category,
      colorFamily: product.colorFamily,
      materialFamily: product.materialFamily,
      heelType: product.heelType,
      heelHeightGroup: product.heelHeightGroup,
      toeShape: product.toeShape,
      details: product.details,
      construction: product.construction,
    },
  })) as AnalyzedProduct[];

  return {
    collectedAt,
    snapshotId,
    totalProducts: products.length,
    totalBrands: brands.size,
    newProductCount: products.filter((product) => product.isNew).length,
    signals: buildSnapshotSignals(analyzedLike),
  };
}

export { canonicalUrl };
