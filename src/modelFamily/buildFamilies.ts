import {
  buildCanonicalDisplayName,
  normalizeModelName,
} from "./normalizeModelName";
import {
  extractStyleCode,
  extractStyleIdentity,
  extractParisTexasColorFromSku,
  extractSourceProvenStyle,
} from "./styleCode";
import { buildStructuralSignature } from "./structuralSignature";
import {
  buildRepresentativeImages,
  resolveProductImageUrls,
} from "./productImages";
import { constructionsCompatible, productConstructionKey } from "./constructionSignature";
import { handleFamiliesCompatible, shopifyHandleFamilyKey } from "./handleFamily";
import {
  isSafeDistinctiveModelName,
  titlesDifferOnlyByColorwayDescriptors,
} from "./safeNameColorway";
import {
  listingIdentityKey,
  MARKETPLACE_SOURCE_IDS,
} from "./sourceIdentity";
import type {
  GroupingConfidence,
  ModelFamily,
  ModelFamilyReport,
  ModelFamilyVariant,
  RawAnalyzedProduct,
} from "./types";
import { enrichModelFamiliesWithTaxonomy } from "../taxonomy/enrichModelFamilies";
import { assignPrimaryCategory } from "../taxonomy/assignCategory";

interface ProductGroupingMeta {
  product: RawAnalyzedProduct;
  styleCode: string | null;
  verifiedStyle: boolean;
  normalizedName: string;
  structuralSignature: string;
  listingKey: string;
  source: string;
  isMarketplace: boolean;
}

interface PendingGroup {
  brand: string;
  confidence: GroupingConfidence;
  reason: string;
  groupKey: string;
  products: RawAnalyzedProduct[];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildModelFamilyId(brand: string, groupKey: string): string {
  return `${slugify(brand)}--${slugify(groupKey)}`;
}

export interface BuildModelFamiliesOptions {
  productImageGalleries?: Record<string, string[]>;
  priorFamilies?: ModelFamily[];
  visionEnrichments?: Map<string, import("../taxonomy/vision/types").TaxonomyVisionEnrichmentRecord>;
}

function buildPriorFamilyMap(priorFamilies?: ModelFamily[]): Map<string, ModelFamily> {
  return new Map((priorFamilies ?? []).map((family) => [family.modelFamilyId, family]));
}

function productFallbackImages(
  product: RawAnalyzedProduct,
  productImageGalleries?: Record<string, string[]>,
): string[] {
  const images = resolveProductImageUrls(product, productImageGalleries);
  if (images.length === 0 && product.imageUrl) {
    images.push(product.imageUrl);
  }
  return images;
}

function toVariant(
  product: RawAnalyzedProduct,
  productImageGalleries?: Record<string, string[]>,
): ModelFamilyVariant {
  const sku = product.variants?.find((variant) => variant.sku)?.sku;
  const styleCode = extractStyleCode(product);
  const images = productFallbackImages(product, productImageGalleries);
  const color =
    product.cleaned.color ??
    product.color ??
    (product.source.trim().toLowerCase() === "paris-texas" && sku
      ? extractParisTexasColorFromSku(sku)
      : null);

  return {
    productId: product.productUrl,
    title: product.productName,
    url: product.productUrl,
    color,
    material: product.material,
    images,
    ...(sku ? { sku } : {}),
    ...(styleCode ? { styleCode } : {}),
  };
}

function isSizeLikeColor(value: string): boolean {
  const trimmed = value.trim();
  if (/^\d{1,2}(?:[.,]\d)?$/.test(trimmed)) return true;
  return /^(xxs|xs|s|m|l|xl|xxl|xxxl)$/i.test(trimmed);
}

function explodeProductColorVariants(
  product: RawAnalyzedProduct,
  productImageGalleries?: Record<string, string[]>,
): ModelFamilyVariant[] {
  const styleCode = extractStyleCode(product);
  const fallbackImages = productFallbackImages(product, productImageGalleries);
  const ways = new Map<string, ModelFamilyVariant>();

  const add = (color: string | null | undefined, sku?: string | null, extraImages?: string[]) => {
    let trimmed = color?.trim() || null;
    if (!trimmed && sku && product.source.trim().toLowerCase() === "paris-texas") {
      trimmed = extractParisTexasColorFromSku(sku);
    }
    if (!trimmed) return;
    if (isSizeLikeColor(trimmed)) return;
    const key = trimmed.toLowerCase();
    const images = [...new Set([...(extraImages ?? []), ...fallbackImages].filter(Boolean))];
    const existing = ways.get(key);
    if (existing) {
      existing.images = [...new Set([...existing.images, ...images])];
      if (sku && !existing.sku) existing.sku = sku;
      return;
    }
    ways.set(key, {
      productId: `${product.productUrl}::${key}`,
      title: product.productName,
      url: product.productUrl,
      color: trimmed,
      material: product.material,
      images: images.length ? images : fallbackImages,
      ...(sku ? { sku } : {}),
      ...(styleCode ? { styleCode } : {}),
    });
  };

  for (const variant of product.variants ?? []) {
    add(variant.color, variant.sku, [
      ...(variant.images ?? []),
      variant.imageUrl ?? "",
    ]);
  }
  if (ways.size === 0) {
    add(product.cleaned.color ?? product.color, product.variants?.find((variant) => variant.sku)?.sku);
  }

  if (ways.size <= 1) return [toVariant(product, productImageGalleries)];
  return [...ways.values()];
}

function normalizeNameForProduct(product: RawAnalyzedProduct): string {
  return normalizeModelName(product.productName, {
    color: product.cleaned.color ?? product.color,
    colorFamily: product.normalized.colorFamily,
  });
}

function scoreRepresentative(product: RawAnalyzedProduct): number {
  let score = 0;
  if (product.imageUrl) score += 5;
  score -= normalizeNameForProduct(product).length * 0.05;
  if (product.color && product.material) score += 1;
  return score;
}

function pickRepresentative(products: RawAnalyzedProduct[]): RawAnalyzedProduct {
  return [...products].sort(
    (a, b) => scoreRepresentative(b) - scoreRepresentative(a),
  )[0]!;
}

function buildFamilyFromProducts(
  group: PendingGroup,
  productImageGalleries?: Record<string, string[]>,
): ModelFamily {
  const representative = pickRepresentative(group.products);
  const variants = group.products.flatMap((product) =>
    explodeProductColorVariants(product, productImageGalleries),
  );
  const verifiedStyles = [
    ...new Set(
      group.products
        .map((product) => extractStyleIdentity(product))
        .filter((identity) => identity.verified && identity.code)
        .map((identity) => identity.code as string),
    ),
  ];
  const suspicious =
    verifiedStyles.length > 1 ? " + suspicious-style-conflict" : "";
  const representativeImages = buildRepresentativeImages(
    representative,
    productImageGalleries,
  );
  const normalizedNames = group.products.map((product) =>
    normalizeNameForProduct(product),
  );
  const allImages = [
    ...new Set(
      group.products
        .map((product) => product.imageUrl)
        .filter((image): image is string => Boolean(image)),
    ),
  ];

  return {
    modelFamilyId: buildModelFamilyId(group.brand, group.groupKey),
    brand: group.brand,
    canonicalName: buildCanonicalDisplayName(normalizedNames),
    category: representative.normalized.category ?? representative.category,
    representativeProductId: representative.productUrl,
    representativeImage: representative.imageUrl,
    representativeImages,
    variantCount: variants.length,
    variants,
    allImages,
    sourceProductIds: group.products.map((product) => product.productUrl),
    groupingConfidence: group.confidence,
    groupingReason: `${group.reason}${suspicious}`,
  };
}

function categoryMergeKey(product: RawAnalyzedProduct): string {
  const primary = assignPrimaryCategory({
    productName: product.productName,
    legacyCategory: product.normalized.category ?? product.category,
    construction: product.normalized.construction,
    heelHeightGroup: product.normalized.heelHeightGroup,
    cleanedHeelHeight: product.cleaned.heelHeight,
    toeShape: product.normalized.toeShape,
    details: product.normalized.details,
    materialFamily: product.normalized.materialFamily,
  }).primaryCategory;
  if (primary === "BOOT") return "BOOT";
  return primary;
}

function categoriesCompatible(a: ProductGroupingMeta, b: ProductGroupingMeta): boolean {
  const left = categoryMergeKey(a.product);
  const right = categoryMergeKey(b.product);
  if (left === "UNCLASSIFIED" || right === "UNCLASSIFIED") return left === right;
  return left === right;
}

function buildGroupingMeta(product: RawAnalyzedProduct): ProductGroupingMeta {
  const source = product.source.trim().toLowerCase();
  const identity = extractStyleIdentity(product);
  return {
    product,
    styleCode: identity.code,
    verifiedStyle: identity.verified,
    normalizedName: normalizeNameForProduct(product),
    structuralSignature: buildStructuralSignature(product),
    listingKey: listingIdentityKey(product),
    source,
    isMarketplace: MARKETPLACE_SOURCE_IDS.has(source),
  };
}

function handleConstructionCompatible(a: ProductGroupingMeta, b: ProductGroupingMeta): boolean {
  if (!categoriesCompatible(a, b)) return false;
  const leftHeel = a.product.normalized.heelType;
  const rightHeel = b.product.normalized.heelType;
  const leftHeight = a.product.normalized.heelHeightGroup;
  const rightHeight = b.product.normalized.heelHeightGroup;
  const raisedTypes = new Set(["STILETTO", "WEDGE", "BLOCK", "SCULPTURAL", "PLATFORM"]);
  if (
    leftHeel &&
    rightHeel &&
    leftHeel !== "UNKNOWN" &&
    rightHeel !== "UNKNOWN" &&
    leftHeel === "FLAT" &&
    raisedTypes.has(rightHeel)
  ) {
    return false;
  }
  if (
    leftHeel &&
    rightHeel &&
    leftHeel !== "UNKNOWN" &&
    rightHeel !== "UNKNOWN" &&
    rightHeel === "FLAT" &&
    raisedTypes.has(leftHeel)
  ) {
    return false;
  }
  const flatHeights = new Set(["FLAT", "LOW"]);
  const highHeights = new Set(["MID", "HIGH"]);
  if (
    leftHeight &&
    rightHeight &&
    leftHeight !== "UNKNOWN" &&
    rightHeight !== "UNKNOWN" &&
    flatHeights.has(leftHeight) &&
    highHeights.has(rightHeight)
  ) {
    return false;
  }
  if (
    leftHeight &&
    rightHeight &&
    leftHeight !== "UNKNOWN" &&
    rightHeight !== "UNKNOWN" &&
    highHeights.has(leftHeight) &&
    flatHeights.has(rightHeight)
  ) {
    return false;
  }
  return true;
}

function sameSourceChannel(a: ProductGroupingMeta, b: ProductGroupingMeta): boolean {
  return a.source === b.source && a.isMarketplace === b.isMarketplace;
}

function canMergeByStyleCode(
  a: ProductGroupingMeta,
  b: ProductGroupingMeta,
): boolean {
  if (!sameSourceChannel(a, b)) return false;
  if (!a.verifiedStyle || !b.verifiedStyle) return false;
  if (!a.styleCode || !b.styleCode || a.styleCode !== b.styleCode) return false;
  if (a.source === "zara" || b.source === "zara" || a.styleCode.startsWith("ZARA-")) {
    // Same Zara -p identity still must not collapse incompatible architectures.
    return (
      a.listingKey === b.listingKey &&
      categoriesCompatible(a, b) &&
      constructionsCompatible(a.product, b.product)
    );
  }
  return categoriesCompatible(a, b) && constructionsCompatible(a.product, b.product);
}

function canMergeByHandle(
  a: ProductGroupingMeta,
  b: ProductGroupingMeta,
): boolean {
  if (!sameSourceChannel(a, b)) return false;
  if (a.isMarketplace || b.isMarketplace) return false;
  if (a.source === "zara" || b.source === "zara") return false;
  if (!handleFamiliesCompatible(a.product.productUrl, b.product.productUrl)) return false;
  if (a.verifiedStyle && b.verifiedStyle && a.styleCode !== b.styleCode) return false;
  // Shared handle stems must not collapse different silhouettes (e.g. square-toe vs toe-post).
  if (
    a.normalizedName &&
    b.normalizedName &&
    a.normalizedName !== b.normalizedName &&
    !titlesDifferOnlyByColorwayDescriptors(a.product, b.product) &&
    (isSafeDistinctiveModelName(a.normalizedName) || isSafeDistinctiveModelName(b.normalizedName))
  ) {
    return false;
  }
  return handleConstructionCompatible(a, b) && constructionsCompatible(a.product, b.product);
}

function canMergeByName(
  a: ProductGroupingMeta,
  b: ProductGroupingMeta,
): boolean {
  if (!sameSourceChannel(a, b)) return false;
  if (a.isMarketplace || b.isMarketplace) return false;
  if (a.source === "zara" || b.source === "zara") return false;
  if (!categoriesCompatible(a, b)) return false;
  if (!constructionsCompatible(a.product, b.product)) return false;
  if (!handleConstructionCompatible(a, b)) return false;
  // Name recovery must not bridge unverified listings onto a verified style identity.
  if (a.verifiedStyle || b.verifiedStyle) return false;
  if (!a.normalizedName || a.normalizedName !== b.normalizedName) return false;
  if (!isSafeDistinctiveModelName(a.normalizedName)) return false;
  if (!titlesDifferOnlyByColorwayDescriptors(a.product, b.product)) return false;
  return true;
}

function clusterByConstruction(metas: ProductGroupingMeta[]): ProductGroupingMeta[][] {
  const clusters: ProductGroupingMeta[][] = [];
  for (const meta of metas) {
    const cluster = clusters.find((existing) =>
      existing.every((member) => constructionsCompatible(member.product, meta.product)),
    );
    if (cluster) cluster.push(meta);
    else clusters.push([meta]);
  }
  return clusters;
}

function listingPartitionKey(product: RawAnalyzedProduct): string {
  // Same listing/style identity may still contain incompatible architectures
  // (e.g. Zara -p reuse across mule vs sandal). Partition before key-merge.
  return `id-${listingIdentityKey(product)}-${categoryMergeKey(product)}-${productConstructionKey(product)}`;
}

function singletonGroup(brand: string, product: RawAnalyzedProduct): PendingGroup {
  return {
    brand,
    confidence: "MEDIUM",
    reason: "singleton",
    groupKey: listingPartitionKey(product),
    products: [product],
  };
}

function refineNameOnlyGroup(group: PendingGroup): PendingGroup[] {
  if (
    !group.reason.startsWith("normalizedName:") &&
    !group.reason.startsWith("safeNameColorway:")
  ) {
    return [group];
  }

  const keyed = group.products.map((product) => ({
    product,
    code: extractSourceProvenStyle(product),
  }));
  const codes = [...new Set(keyed.map((row) => row.code).filter((code): code is string => Boolean(code)))];

  if (codes.length === 0) return [group];

  if (codes.length === 1 && keyed.every((row) => row.code === codes[0])) {
    return [
      {
        ...group,
        confidence: "HIGH",
        reason: `styleCode:${codes[0]}`,
      },
    ];
  }

  const buckets = new Map<string, RawAnalyzedProduct[]>();
  for (const row of keyed) {
    const bucketKey = row.code
      ? `${group.groupKey}::style-${row.code}`
      : listingPartitionKey(row.product);
    const bucket = buckets.get(bucketKey) ?? [];
    bucket.push(row.product);
    buckets.set(bucketKey, bucket);
  }

  return [...buckets.entries()].map(([groupKey, products]) => {
    const code = extractSourceProvenStyle(products[0]!);
    if (code && products.every((product) => extractSourceProvenStyle(product) === code)) {
      return {
        brand: group.brand,
        confidence: "HIGH" as const,
        reason: `styleCode:${code}`,
        groupKey,
        products,
      };
    }
    if (products.length === 1) return singletonGroup(group.brand, products[0]!);
    return {
      brand: group.brand,
      confidence: "HIGH" as const,
      reason: group.reason,
      groupKey,
      products,
    };
  });
}

function mergeGroups(groups: PendingGroup[]): PendingGroup {
  const products = groups.flatMap((group) => group.products);
  const bestConfidence = groups.some((group) => group.confidence === "HIGH")
    ? "HIGH"
    : "MEDIUM";

  return {
    brand: groups[0]!.brand,
    confidence: bestConfidence,
    reason: groups.map((group) => group.reason).join(" + "),
    groupKey: groups[0]!.groupKey,
    products: [...new Map(products.map((product) => [product.productUrl, product])).values()],
  };
}

function groupProductsWithinBrand(
  brand: string,
  products: RawAnalyzedProduct[],
): PendingGroup[] {
  const metas = products.map(buildGroupingMeta);
  const assigned = new Set<string>();
  const groups: PendingGroup[] = [];

  for (const seed of metas) {
    if (assigned.has(seed.product.productUrl)) continue;

    const styleMatches = metas.filter(
      (candidate) =>
        !assigned.has(candidate.product.productUrl) &&
        canMergeByStyleCode(seed, candidate),
    );
    const seedStyleCluster = clusterByConstruction(styleMatches)
      .filter((cluster) => cluster.length > 1)
      .find((cluster) => cluster.some((member) => member.product.productUrl === seed.product.productUrl));

    if (seedStyleCluster) {
      for (const match of seedStyleCluster) {
        assigned.add(match.product.productUrl);
      }
      groups.push({
        brand,
        confidence: "HIGH",
        reason: `styleCode:${seed.styleCode}`,
        groupKey: `style-${seed.source}-${seed.styleCode}-${categoryMergeKey(seed.product)}-${productConstructionKey(seed.product)}`,
        products: seedStyleCluster.map((match) => match.product),
      });
      continue;
    }

    const handleMatches = metas.filter(
      (candidate) =>
        !assigned.has(candidate.product.productUrl) &&
        canMergeByHandle(seed, candidate),
    );
    const seedHandleCluster = clusterByConstruction(handleMatches)
      .filter((cluster) => cluster.length > 1)
      .find((cluster) => cluster.some((member) => member.product.productUrl === seed.product.productUrl));

    if (seedHandleCluster) {
      for (const match of seedHandleCluster) {
        assigned.add(match.product.productUrl);
      }
      const handleKey = shopifyHandleFamilyKey(seed.product.productUrl) ?? seed.listingKey;
      groups.push({
        brand,
        confidence: "HIGH",
        reason: `handleFamily:${handleKey}`,
        groupKey: `handle-${seed.source}-${handleKey}-${categoryMergeKey(seed.product)}-${productConstructionKey(seed.product)}-${seed.normalizedName}`,
        products: seedHandleCluster.map((match) => match.product),
      });
      continue;
    }

    const nameMatches = metas.filter(
      (candidate) =>
        !assigned.has(candidate.product.productUrl) &&
        canMergeByName(seed, candidate),
    );
    const seedNameCluster = clusterByConstruction(nameMatches)
      .filter((cluster) => cluster.length > 1)
      .find((cluster) => cluster.some((member) => member.product.productUrl === seed.product.productUrl));

    if (seedNameCluster) {
      for (const match of seedNameCluster) {
        assigned.add(match.product.productUrl);
      }
      groups.push({
        brand,
        confidence: "HIGH",
        reason: `safeNameColorway:${seed.normalizedName}`,
        groupKey: `name-${seed.source}-${seed.normalizedName}-${categoryMergeKey(seed.product)}-${productConstructionKey(seed.product)}`,
        products: seedNameCluster.map((match) => match.product),
      });
      continue;
    }

    assigned.add(seed.product.productUrl);
    groups.push({
      brand,
      confidence: "MEDIUM",
      reason: "singleton",
      groupKey: listingPartitionKey(seed.product),
      products: [seed.product],
    });
  }

  const splitNameOnly = groups.flatMap((group) => refineNameOnlyGroup(group));

  const mergedByKey = new Map<string, PendingGroup>();
  for (const group of splitNameOnly) {
    const mergeKey = `${group.confidence}:${group.groupKey}`;
    const existing = mergedByKey.get(mergeKey);
    if (!existing) {
      mergedByKey.set(mergeKey, group);
      continue;
    }
    mergedByKey.set(mergeKey, mergeGroups([existing, group]));
  }

  return reconcileCompatibleHighGroups([...mergedByKey.values()]);
}

function groupMetas(group: PendingGroup): ProductGroupingMeta[] {
  return group.products.map(buildGroupingMeta);
}

function verifiedStyleCodes(metas: ProductGroupingMeta[]): string[] {
  return [
    ...new Set(
      metas
        .filter((meta) => meta.verifiedStyle && meta.styleCode)
        .map((meta) => meta.styleCode as string),
    ),
  ];
}

function groupsHighConfidenceCompatible(a: PendingGroup, b: PendingGroup): boolean {
  if (a.brand !== b.brand) return false;
  if (a.confidence !== "HIGH" && b.confidence !== "HIGH") return false;
  const left = groupMetas(a);
  const right = groupMetas(b);
  if (left.length === 0 || right.length === 0) return false;

  const leftStyles = verifiedStyleCodes(left);
  const rightStyles = verifiedStyleCodes(right);
  if (leftStyles.length > 0 && rightStyles.length > 0) {
    if (!leftStyles.some((code) => rightStyles.includes(code))) return false;
  }

  for (const leftMeta of left) {
    for (const rightMeta of right) {
      const agreed =
        canMergeByStyleCode(leftMeta, rightMeta) ||
        canMergeByHandle(leftMeta, rightMeta) ||
        canMergeByName(leftMeta, rightMeta);
      if (!agreed) return false;
    }
  }
  return true;
}

/** Join handle/name/style colorway fragments that already passed high-confidence gates separately. */
function reconcileCompatibleHighGroups(groups: PendingGroup[]): PendingGroup[] {
  const result = [...groups];
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < result.length; i += 1) {
      for (let j = i + 1; j < result.length; j += 1) {
        const left = result[i]!;
        const right = result[j]!;
        if (!groupsHighConfidenceCompatible(left, right)) continue;
        const merged = mergeGroups([left, right]);
        merged.confidence = "HIGH";
        if (!merged.reason.includes("safeNameColorway:") && left.reason.startsWith("handleFamily:")) {
          merged.reason = `${left.reason} + ${right.reason}`;
        }
        result.splice(j, 1);
        result.splice(i, 1, merged);
        changed = true;
        break outer;
      }
    }
  }
  return result;
}

function buildRepresentativeImageStats(families: ModelFamily[]) {
  const counts = families.map((family) => family.representativeImages.length);
  const total = counts.reduce((sum, count) => sum + count, 0);

  return {
    familiesWithMultipleRepresentativeImages: counts.filter((count) => count > 1)
      .length,
    averageRepresentativeImageCount:
      families.length > 0
        ? Math.round((total / families.length) * 100) / 100
        : 0,
    maxRepresentativeImageCount:
      counts.length > 0 ? Math.max(...counts) : 0,
  };
}

export function buildModelFamilies(
  products: RawAnalyzedProduct[],
  options: BuildModelFamiliesOptions = {},
): { families: ModelFamily[]; report: ModelFamilyReport } {
  const { productImageGalleries } = options;
  const byBrand = new Map<string, RawAnalyzedProduct[]>();

  for (const product of products) {
    const brandProducts = byBrand.get(product.brand) ?? [];
    brandProducts.push(product);
    byBrand.set(product.brand, brandProducts);
  }

  const pendingGroups: PendingGroup[] = [];
  for (const [brand, brandProducts] of byBrand.entries()) {
    pendingGroups.push(...groupProductsWithinBrand(brand, brandProducts));
  }

  const families = pendingGroups
    .map((group) => buildFamilyFromProducts(group, productImageGalleries))
    .sort(
      (a, b) =>
        b.variantCount - a.variantCount ||
        a.canonicalName.localeCompare(b.canonicalName, "tr"),
    );

  const productLookup = buildProductLookup(products);
  const enrichedFamilies = enrichModelFamiliesWithTaxonomy(
    families,
    productLookup,
    buildPriorFamilyMap(options.priorFamilies),
    { visionEnrichments: options.visionEnrichments },
  );

  const multiVariantFamilies = enrichedFamilies.filter((family) => family.variantCount > 1);
  const collapsedVariantProducts = products.length - enrichedFamilies.length;

  const report: ModelFamilyReport = {
    rawProductCount: products.length,
    modelFamilyCount: enrichedFamilies.length,
    totalVariants: products.length,
    multiVariantFamilyCount: multiVariantFamilies.length,
    reductionPercent:
      products.length > 0
        ? Math.round((collapsedVariantProducts / products.length) * 1000) / 10
        : 0,
    collapsedVariantProducts,
    representativeImageStats: buildRepresentativeImageStats(enrichedFamilies),
    largestVariantFamilies: [...enrichedFamilies]
      .sort((a, b) => b.variantCount - a.variantCount)
      .slice(0, 10)
      .map((family) => ({
        modelFamilyId: family.modelFamilyId,
        brand: family.brand,
        canonicalName: family.canonicalName,
        variantCount: family.variantCount,
      })),
    mediumConfidenceGroups: enrichedFamilies
      .filter(
        (family) =>
          family.groupingConfidence === "MEDIUM" && family.variantCount > 1,
      )
      .map((family) => ({
        modelFamilyId: family.modelFamilyId,
        brand: family.brand,
        canonicalName: family.canonicalName,
        variantCount: family.variantCount,
        groupingReason: family.groupingReason,
      })),
  };

  return { families: enrichedFamilies, report };
}

export function buildProductLookup(
  products: RawAnalyzedProduct[],
): Map<string, RawAnalyzedProduct> {
  return new Map(products.map((product) => [product.productUrl, product]));
}
