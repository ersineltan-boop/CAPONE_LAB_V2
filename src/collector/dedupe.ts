import type { PilotProduct, SourceCollectionReport } from "./types";

export function globalDedupe(products: PilotProduct[]): PilotProduct[] {
  const seen = new Set<string>();
  const result: PilotProduct[] = [];

  for (const product of products) {
    const key = product.productUrl.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(product);
  }

  return result;
}

export function buildSourceReport(
  source: string,
  discoveredLinks: number,
  products: PilotProduct[],
  errors: string[],
  method?: string,
): SourceCollectionReport {
  const withImages = products.filter((product) => Boolean(product.imageUrl)).length;
  const withMaterial = products.filter((product) => Boolean(product.material)).length;

  let status: SourceCollectionReport["status"] = "failed";
  if (products.length > 0 && errors.length === 0) status = "success";
  else if (products.length > 0) status = "partial";

  return {
    source,
    status,
    method,
    discoveredProductLinks: discoveredLinks,
    parsedProducts: products.length,
    productsWithImages: withImages,
    productsWithMaterial: withMaterial,
    errors,
  };
}
