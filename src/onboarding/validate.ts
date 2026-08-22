import { evaluateFootwearProduct, evaluateStoredPilotProduct } from "../collector/footwearGate";
import { analyzeProducts } from "../analysis/analyzeProduct";
import { buildModelFamilies } from "../modelFamily/buildFamilies";
import { isGenericModelTitle } from "../modelFamily/genericModelTitle";
import type { PilotProduct } from "../collector/types";
import type { RawAnalyzedProduct } from "../modelFamily/types";

export interface QualityGateResult {
  ok: boolean;
  completeness: "FULL" | "PARTIAL" | "FAILED";
  reasons: string[];
  families: number;
  multiColorFamilies: number;
  verifiedNewArrivals: number;
  galleryCoverage: number;
  categories: string[];
  leakageCount: number;
}

function colorCount(family: { variants: Array<{ color?: string | null }>; variantCount: number }): number {
  const colors = new Set(
    family.variants
      .map((variant) => variant.color?.trim().toLowerCase())
      .filter((color): color is string => Boolean(color)),
  );
  return colors.size || family.variantCount;
}

export function auditFootwearLeakage(products: readonly PilotProduct[]): string[] {
  const leaks: string[] = [];
  for (const product of products) {
    const live = evaluateFootwearProduct({
      title: product.productName,
      productType: product.category ?? product.sourceCategoryName ?? "",
      tags: [product.sourceCategoryName, product.collectionLabel].filter(
        (value): value is string => Boolean(value),
      ),
      handle: product.productUrl,
      collectionPath: product.collectionPath ?? "",
      fromVerifiedFootwearCollection: Boolean(product.collectionPath),
    });
    if (live.decision !== "ACCEPT_FOOTWEAR") {
      leaks.push(product.productUrl);
      continue;
    }
    if (product.category) {
      const stored = evaluateStoredPilotProduct({
        productName: product.productName,
        productUrl: product.productUrl,
        category: product.category,
      });
      if (stored.decision !== "ACCEPT_FOOTWEAR") leaks.push(product.productUrl);
    }
  }
  return leaks;
}

export function auditModelFamilySafety(products: readonly PilotProduct[]): {
  ok: boolean;
  families: number;
  multiColor: number;
  reasons: string[];
} {
  if (products.length === 0) {
    return { ok: false, families: 0, multiColor: 0, reasons: ["No products to family"] };
  }
  const analyzed = analyzeProducts(products as never) as unknown as RawAnalyzedProduct[];
  const { families } = buildModelFamilies(analyzed);
  const reasons: string[] = [];
  let multiColor = 0;
  for (const family of families) {
    const colors = colorCount(family);
    if (colors > 1) multiColor += 1;
    if (family.groupingReason.includes("suspicious-style-conflict")) {
      reasons.push(`style conflict: ${family.canonicalName}`);
    }
    if (isGenericModelTitle(family.canonicalName) && colors >= 8) {
      reasons.push(`generic-title color blob: ${family.canonicalName} (${colors})`);
    }
  }
  return { ok: reasons.length === 0, families: families.length, multiColor, reasons };
}

export function evaluateQualityGate(products: readonly PilotProduct[]): QualityGateResult {
  const reasons: string[] = [];
  if (products.length === 0) {
    return {
      ok: false,
      completeness: "FAILED",
      reasons: ["zero products"],
      families: 0,
      multiColorFamilies: 0,
      verifiedNewArrivals: 0,
      galleryCoverage: 0,
      categories: [],
      leakageCount: 0,
    };
  }

  const leaks = auditFootwearLeakage(products);
  if (leaks.length > 0) {
    reasons.push(`footwear leakage: ${leaks.length}`);
  }

  const missingUrl = products.filter((product) => !product.productUrl).length;
  if (missingUrl > 0) reasons.push("missing canonical URLs");

  const withImage = products.filter((product) => Boolean(product.imageUrl) || (product.images?.length ?? 0) > 0);
  if (withImage.length === 0) reasons.push("no useful images");

  const familyAudit = auditModelFamilySafety(products);
  reasons.push(...familyAudit.reasons);

  const verifiedNewArrivals = products.filter(
    (product) => product.isNewArrivalsCollection === true || product.hasNewBadge === true,
  ).length;
  const galleryCoverage = products.filter((product) => (product.images?.length ?? 0) > 1).length / products.length;
  const categories = [
    ...new Set(
      products
        .map((product) => product.sourceCategoryName ?? product.category)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const ok = reasons.length === 0;
  const completeness =
    ok && products.length >= 20 && galleryCoverage >= 0.4 ? "FULL" : ok ? "PARTIAL" : "FAILED";

  return {
    ok,
    completeness,
    reasons,
    families: familyAudit.families,
    multiColorFamilies: familyAudit.multiColor,
    verifiedNewArrivals,
    galleryCoverage,
    categories,
    leakageCount: leaks.length,
  };
}
