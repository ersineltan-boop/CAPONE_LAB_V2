import type { ProductShopifyDates } from "./types";

export interface ShopifyDateFields {
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

function parseShopifyDate(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : trimmed;
}

export function extractShopifyProductDates(
  raw: ShopifyDateFields,
): ProductShopifyDates {
  const publishedAt = parseShopifyDate(raw.published_at);
  const createdAt = parseShopifyDate(raw.created_at);
  const updatedAt = parseShopifyDate(raw.updated_at);

  const dates: ProductShopifyDates = {};
  if (publishedAt) dates.publishedAt = publishedAt;
  if (createdAt) dates.createdAt = createdAt;
  if (updatedAt) dates.updatedAt = updatedAt;
  return dates;
}
