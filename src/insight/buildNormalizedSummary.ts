import type { NormalizedProductInsight, NormalizedSummary, ProvenanceTagCount } from "./types";
import type { InsightSource } from "./types";

function countTagsWithProvenance(
  products: NormalizedProductInsight[],
  getTags: (p: NormalizedProductInsight) => string[],
  getSource: (p: NormalizedProductInsight) => InsightSource,
): ProvenanceTagCount[] {
  const map = new Map<string, Set<string>>();

  for (const product of products) {
    for (const tag of new Set(getTags(product).filter(Boolean))) {
      if (!map.has(tag)) map.set(tag, new Set());
      map.get(tag)!.add(product.brand);
    }
  }

  return [...map.entries()]
    .map(([tag, brands]) => {
      const matching = products.filter((p) => getTags(p).includes(tag));
      return {
        tag,
        productCount: matching.length,
        brandCount: brands.size,
        brands: [...brands].sort(),
        textSourced: matching.filter((p) => getSource(p) === "text").length,
        visionSourced: matching.filter((p) => getSource(p) === "vision").length,
        hybridProducts: matching.filter(
          (p) => p.analysisCoverage.text && p.analysisCoverage.vision,
        ).length,
      };
    })
    .sort((a, b) => b.productCount - a.productCount || a.tag.localeCompare(b.tag));
}

function countSingleWithProvenance(
  products: NormalizedProductInsight[],
  getTag: (p: NormalizedProductInsight) => string | null,
  getSource: (p: NormalizedProductInsight) => InsightSource,
): ProvenanceTagCount[] {
  return countTagsWithProvenance(products, (p) => {
    const tag = getTag(p);
    return tag ? [tag] : [];
  }, getSource);
}

export function buildNormalizedSummary(
  products: NormalizedProductInsight[],
): NormalizedSummary {
  const brands = [...new Set(products.map((p) => p.brand))].sort();
  const categories = [
    ...new Set(products.map((p) => p.category).filter(Boolean)),
  ] as string[];

  const textAnalyzedProducts = products.filter((p) => p.analysisCoverage.text).length;
  const visionAnalyzedProducts = products.filter((p) => p.analysisCoverage.vision).length;
  const fullHybridProducts = products.filter(
    (p) => p.analysisCoverage.text && p.analysisCoverage.vision,
  ).length;

  const brandBreakdown = brands.map((brand) => {
    const brandProducts = products.filter((p) => p.brand === brand);
    return {
      brand,
      productCount: brandProducts.length,
      textOnly: brandProducts.filter(
        (p) => p.analysisCoverage.text && !p.analysisCoverage.vision,
      ).length,
      visionCovered: brandProducts.filter((p) => p.analysisCoverage.vision).length,
      fullHybrid: brandProducts.filter(
        (p) => p.analysisCoverage.text && p.analysisCoverage.vision,
      ).length,
      topCategories: countSingleWithProvenance(
        brandProducts,
        (p) => p.category,
        (p) => p.sourceOfTruth.category,
      ).slice(0, 5),
    };
  });

  const categoryBreakdown = categories
    .map((category) => {
      const categoryProducts = products.filter((p) => p.category === category);
      const categoryBrands = new Set(categoryProducts.map((p) => p.brand));
      return {
        category,
        productCount: categoryProducts.length,
        brandCount: categoryBrands.size,
        brands: [...categoryBrands].sort(),
        textSourced: categoryProducts.filter((p) => !p.analysisCoverage.vision).length,
        visionSourced: categoryProducts.filter((p) => p.analysisCoverage.vision).length,
        hybridProducts: categoryProducts.filter(
          (p) => p.analysisCoverage.text && p.analysisCoverage.vision,
        ).length,
      };
    })
    .sort((a, b) => b.productCount - a.productCount);

  return {
    totalProducts: products.length,
    textAnalyzedProducts,
    visionAnalyzedProducts,
    fullHybridProducts,
    topToeShape: countSingleWithProvenance(
      products,
      (p) => p.toeShape,
      (p) => p.sourceOfTruth.toeShape,
    ).slice(0, 10),
    topHeelType: countSingleWithProvenance(
      products,
      (p) => p.heelType,
      (p) => p.sourceOfTruth.heelType,
    ).slice(0, 10),
    topDetails: countTagsWithProvenance(
      products,
      (p) => p.details,
      (p) => p.sourceOfTruth.details,
    ).slice(0, 10),
    topConstruction: countTagsWithProvenance(
      products,
      (p) => p.construction,
      (p) => p.sourceOfTruth.construction,
    ).slice(0, 10),
    topSurfaceEffects: countTagsWithProvenance(
      products,
      (p) => p.surfaceEffects,
      (p) => p.sourceOfTruth.surfaceEffects,
    ).slice(0, 10),
    brandBreakdown,
    categoryBreakdown,
  };
}
