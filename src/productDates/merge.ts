import type { ProductDateEnrichmentSidecar, ProductShopifyDates } from "./types";

export type ProductWithOptionalDates = ProductShopifyDates & {
  productUrl: string;
};

export function mergeProductDates<T extends ProductWithOptionalDates>(
  product: T,
  sidecar: Readonly<ProductDateEnrichmentSidecar>,
): T {
  const enrichment = sidecar[product.productUrl];
  if (!enrichment) return product;

  return {
    ...product,
    publishedAt: product.publishedAt ?? enrichment.publishedAt ?? null,
    createdAt: product.createdAt ?? enrichment.createdAt ?? null,
    updatedAt: product.updatedAt ?? enrichment.updatedAt ?? null,
  };
}

export function mergeProductDatesBatch<T extends ProductWithOptionalDates>(
  products: T[],
  sidecar: Readonly<ProductDateEnrichmentSidecar>,
): T[] {
  if (Object.keys(sidecar).length === 0) return products;
  return products.map((product) => mergeProductDates(product, sidecar));
}
