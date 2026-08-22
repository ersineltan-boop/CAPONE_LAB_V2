import analyzedProductsJson from "../../data/multibrand/analyzed-products.json";
import productDateEnrichmentJson from "../../data/multibrand/product-date-enrichment.json";
import type { AnalyzedProduct } from "../types/marketAnalysis";
import { mergeProductDatesBatch } from "../productDates/merge";
import type { ProductDateEnrichmentSidecar } from "../productDates/types";

const productDateEnrichment =
  productDateEnrichmentJson as ProductDateEnrichmentSidecar;

export const analyzedProducts = mergeProductDatesBatch(
  analyzedProductsJson as AnalyzedProduct[],
  productDateEnrichment,
);
