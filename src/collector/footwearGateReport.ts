import type { PilotProduct } from "./types";
import { evaluateStoredPilotProduct } from "./footwearGate";

export interface BrandFootwearGateReport {
  brand: string;
  collectedBefore: number;
  acceptedFootwear: number;
  excludedNonFootwear: number;
  excludedUncertain: number;
  footwearCollectionUsed: string | null;
  collectionHandle: string | null;
  validationMethod: string;
  excludedExamples: string[];
}

export interface FootwearGateReportFile {
  generatedAt: string;
  totalBefore: number;
  totalAfter: number;
  excludedNonFootwear: number;
  excludedUncertain: number;
  brands: BrandFootwearGateReport[];
  footwearCollectionDiscoveredBrands: number;
  needsFootwearConfigBrands: string[];
}

export function applyFootwearGateToProducts(products: PilotProduct[]): {
  accepted: PilotProduct[];
  report: FootwearGateReportFile;
} {
  const byBrand = new Map<string, PilotProduct[]>();
  for (const product of products) {
    const key = product.brand.trim().toUpperCase();
    const list = byBrand.get(key) ?? [];
    list.push(product);
    byBrand.set(key, list);
  }

  const accepted: PilotProduct[] = [];
  const brandReports: BrandFootwearGateReport[] = [];
  let excludedNonFootwear = 0;
  let excludedUncertain = 0;

  for (const [brandKey, brandProducts] of byBrand.entries()) {
    const excludedExamples: string[] = [];
    let acceptedCount = 0;
    let nonFootwearCount = 0;
    let uncertainCount = 0;
    let validationMethod = "STORED_PRODUCT_REVIEW";

    for (const product of brandProducts) {
      const gate = evaluateStoredPilotProduct({
        productName: product.productName,
        productUrl: product.productUrl,
        category: product.category,
      });

      validationMethod = gate.validationMethod;

      if (gate.decision === "ACCEPT_FOOTWEAR") {
        accepted.push({ ...product, category: gate.category ?? product.category });
        acceptedCount += 1;
        continue;
      }

      if (gate.decision === "EXCLUDE_NON_FOOTWEAR") {
        nonFootwearCount += 1;
        excludedNonFootwear += 1;
      } else {
        uncertainCount += 1;
        excludedUncertain += 1;
      }

      if (excludedExamples.length < 10) {
        excludedExamples.push(product.productName);
      }
    }

    brandReports.push({
      brand: brandProducts[0]?.brand ?? brandKey,
      collectedBefore: brandProducts.length,
      acceptedFootwear: acceptedCount,
      excludedNonFootwear: nonFootwearCount,
      excludedUncertain: uncertainCount,
      footwearCollectionUsed: null,
      collectionHandle: null,
      validationMethod,
      excludedExamples,
    });
  }

  brandReports.sort((a, b) => a.brand.localeCompare(b.brand));

  return {
    accepted,
    report: {
      generatedAt: new Date().toISOString(),
      totalBefore: products.length,
      totalAfter: accepted.length,
      excludedNonFootwear,
      excludedUncertain,
      brands: brandReports,
      footwearCollectionDiscoveredBrands: 0,
      needsFootwearConfigBrands: [],
    },
  };
}
