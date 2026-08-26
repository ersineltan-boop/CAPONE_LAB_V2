import type { PilotProduct } from "./types";
import {
  evaluateFootwearProduct,
  extractHandleFromProductUrl,
} from "./footwearGate";

export interface NonFootwearRemoval {
  brand: string;
  productName: string;
  productUrl: string;
  source: string;
  matchedSignal: string;
}

export function isConfirmedNonFootwearProduct(product: {
  productName: string;
  productUrl: string;
}): { exclude: boolean; signal: string | null } {
  const result = evaluateFootwearProduct({
    title: product.productName,
    handle: extractHandleFromProductUrl(product.productUrl),
    fromVerifiedFootwearCollection: true,
  });
  if (result.decision !== "EXCLUDE_NON_FOOTWEAR") {
    return { exclude: false, signal: null };
  }
  return { exclude: true, signal: result.matchedSignals[0] ?? "non-footwear" };
}

export function stripConfirmedNonFootwear<T extends Pick<PilotProduct, "brand" | "productName" | "productUrl" | "source">>(
  products: T[],
): { kept: T[]; removed: NonFootwearRemoval[] } {
  const kept: T[] = [];
  const removed: NonFootwearRemoval[] = [];
  for (const product of products) {
    const decision = isConfirmedNonFootwearProduct(product);
    if (decision.exclude) {
      removed.push({
        brand: product.brand,
        productName: product.productName,
        productUrl: product.productUrl,
        source: product.source,
        matchedSignal: decision.signal ?? "non-footwear",
      });
      continue;
    }
    kept.push(product);
  }
  return { kept, removed };
}
