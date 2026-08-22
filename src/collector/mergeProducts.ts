import type { PilotProduct } from "./types";
import { normalizeProductImageUrls } from "../images/resolveImageQuality";
import { categoryFromProductFields, mergeSourceCategories } from "../source/sourceCategories";
import type { SourceNativeCategory } from "../source/types";

export function normalizeProductUrl(url: string): string {
  return url.replace(/\/$/, "").toLowerCase();
}

function earliestIsoDate(a: string, b: string): string {
  return Date.parse(a) <= Date.parse(b) ? a : b;
}

function pickDate(
  incoming: string | null | undefined,
  existing: string | null | undefined,
): string | null | undefined {
  return incoming ?? existing ?? undefined;
}

function categoriesFromProduct(product: PilotProduct): SourceNativeCategory[] {
  const fromField = product.sourceCategories ? [...product.sourceCategories] : [];
  const derived = categoryFromProductFields(product);
  return derived ? mergeSourceCategories(fromField, derived) : fromField;
}

export function mergeProductRecords(
  existing: PilotProduct,
  incoming: PilotProduct,
): PilotProduct {
  const sourceCategories = categoriesFromProduct(incoming).reduce(
    (list, category) => mergeSourceCategories(list, category),
    categoriesFromProduct(existing),
  );
  const images = normalizeProductImageUrls([
    ...(incoming.images ?? []),
    ...(existing.images ?? []),
    incoming.imageUrl,
    existing.imageUrl,
  ]);

  return {
    ...incoming,
    discoveredAt: earliestIsoDate(existing.discoveredAt, incoming.discoveredAt),
    publishedAt: pickDate(incoming.publishedAt, existing.publishedAt),
    createdAt: pickDate(incoming.createdAt, existing.createdAt),
    updatedAt: pickDate(incoming.updatedAt, existing.updatedAt) ?? existing.updatedAt,
    images,
    imageUrl: images[0] ?? incoming.imageUrl ?? existing.imageUrl,
    isNewArrivalsCollection:
      Boolean(existing.isNewArrivalsCollection) || Boolean(incoming.isNewArrivalsCollection),
    hasNewBadge: Boolean(existing.hasNewBadge) || Boolean(incoming.hasNewBadge),
    sourceCategories,
    collectionPath: incoming.collectionPath ?? existing.collectionPath,
    collectionLabel: incoming.collectionLabel ?? existing.collectionLabel,
    sourceCategoryId: incoming.sourceCategoryId ?? existing.sourceCategoryId,
    sourceCategoryName: incoming.sourceCategoryName ?? existing.sourceCategoryName,
    sourceCategoryPath: incoming.sourceCategoryPath ?? existing.sourceCategoryPath,
    sourceCategoryUrl: incoming.sourceCategoryUrl ?? existing.sourceCategoryUrl,
  };
}

export function mergeProductCatalog(
  existing: readonly PilotProduct[],
  incoming: readonly PilotProduct[],
): PilotProduct[] {
  const byUrl = new Map<string, PilotProduct>();

  for (const product of existing) {
    byUrl.set(normalizeProductUrl(product.productUrl), product);
  }

  for (const product of incoming) {
    const key = normalizeProductUrl(product.productUrl);
    const prior = byUrl.get(key);
    byUrl.set(key, prior ? mergeProductRecords(prior, product) : product);
  }

  return [...byUrl.values()];
}

export function productReleaseTimestamp(product: PilotProduct): number {
  const candidate =
    product.publishedAt ?? product.createdAt ?? product.discoveredAt ?? null;
  if (!candidate) return 0;
  const parsed = Date.parse(candidate);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function sortProductsNewestFirst(products: PilotProduct[]): PilotProduct[] {
  return [...products].sort(
    (a, b) => productReleaseTimestamp(b) - productReleaseTimestamp(a),
  );
}
