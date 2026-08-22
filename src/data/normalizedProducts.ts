import normalizedProductsJson from "../../data/pilot/normalized-products.json";
import type { NormalizedProduct } from "../types/normalizedProduct";

export const normalizedProducts = normalizedProductsJson as NormalizedProduct[];

export const normalizedByUrl = new Map(
  normalizedProducts.map((p) => [p.productUrl, p]),
);
