import type { PilotProduct, PilotProductVariant } from "./types";
import { preserveLastGoodGallery } from "../images/galleryImages";
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

function variantColorKey(variant: PilotProductVariant): string {
  return (variant.color ?? "").trim().toLowerCase() || (variant.title ?? "").trim().toLowerCase() || "default";
}

function mergeVariantImages(
  existing: PilotProductVariant,
  incoming: PilotProductVariant,
): string[] {
  return preserveLastGoodGallery(
    [...(existing.images ?? []), existing.imageUrl],
    [...(incoming.images ?? []), incoming.imageUrl],
  );
}

export function mergeProductVariants(
  existing: readonly PilotProductVariant[],
  incoming: readonly PilotProductVariant[],
): PilotProductVariant[] {
  const byKey = new Map<string, PilotProductVariant>();
  for (const variant of [...existing, ...incoming]) {
    const key = variantColorKey(variant);
    const prior = byKey.get(key);
    if (!prior) {
      byKey.set(key, variant);
      continue;
    }
    const images = mergeVariantImages(prior, variant);
    byKey.set(key, {
      ...prior,
      ...variant,
      title: variant.title || prior.title,
      color: variant.color ?? prior.color,
      sku: variant.sku ?? prior.sku,
      images,
      imageUrl: images[0] ?? variant.imageUrl ?? prior.imageUrl ?? null,
    });
  }
  return [...byKey.values()];
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
  const images = preserveLastGoodGallery(
    [...(existing.images ?? []), existing.imageUrl],
    [...(incoming.images ?? []), incoming.imageUrl],
  );
  const variants = mergeProductVariants(existing.variants ?? [], incoming.variants ?? []);
  const color =
    incoming.color ??
    existing.color ??
    variants.find((variant) => variant.color)?.color ??
    null;

  return {
    ...incoming,
    discoveredAt: earliestIsoDate(existing.discoveredAt, incoming.discoveredAt),
    publishedAt: pickDate(incoming.publishedAt, existing.publishedAt),
    createdAt: pickDate(incoming.createdAt, existing.createdAt),
    updatedAt: pickDate(incoming.updatedAt, existing.updatedAt) ?? existing.updatedAt,
    images,
    imageUrl: images[0] ?? incoming.imageUrl ?? existing.imageUrl,
    color,
    variants,
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

export function mergeCatalogPreservingFailedSources(
  existing: readonly PilotProduct[],
  incoming: readonly PilotProduct[],
  failedBrandKeys: ReadonlySet<string>,
): PilotProduct[] {
  const failed = new Set(
    [...failedBrandKeys].map((key) => key.trim().toUpperCase()).filter(Boolean),
  );
  if (failed.size === 0) {
    return mergeProductCatalog(existing, incoming);
  }
  const preserved = existing.filter((product) =>
    failed.has(product.brand.trim().toUpperCase()),
  );
  const rest = existing.filter(
    (product) => !failed.has(product.brand.trim().toUpperCase()),
  );
  const incomingSafe = incoming.filter(
    (product) => !failed.has(product.brand.trim().toUpperCase()),
  );
  return mergeProductCatalog(rest, [...incomingSafe, ...preserved]);
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
