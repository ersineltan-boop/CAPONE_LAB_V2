export interface ProductShopifyDates {
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ProductDateEnrichmentEntry extends ProductShopifyDates {
  enrichedAt: string;
}

export type ProductDateEnrichmentSidecar = Record<
  string,
  ProductDateEnrichmentEntry
>;
