import type { RawAnalyzedProduct } from "../modelFamily/types";
import type { PilotProduct } from "../collector/types";
import type { SourceCategoryRef, SourceNativeCategory } from "./types";

export function slugifyCategoryId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function humanizeCollectionHandle(pathOrHandle: string): string {
  const handle = pathOrHandle
    .replace(/^\/collections\//, "")
    .replace(/^\/+/, "")
    .split("/")
    .pop() ?? pathOrHandle;
  return handle
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function categoryFromCollectionPath(
  collectionPath: string | null | undefined,
  baseUrl?: string | null,
): SourceNativeCategory | null {
  if (!collectionPath) return null;
  const name = humanizeCollectionHandle(collectionPath);
  if (!name) return null;
  const categoryId = slugifyCategoryId(name);
  const categoryUrl = baseUrl
    ? `${baseUrl.replace(/\/$/, "")}${collectionPath.startsWith("/") ? collectionPath : `/${collectionPath}`}`
    : null;
  return {
    categoryId,
    categoryName: name,
    categoryPath: collectionPath,
    categoryUrl,
  };
}

export function categoryFromProductFields(
  product: Pick<
    PilotProduct | RawAnalyzedProduct,
    | "sourceCategoryId"
    | "sourceCategoryName"
    | "sourceCategoryPath"
    | "sourceCategoryUrl"
    | "collectionPath"
    | "collectionLabel"
    | "sourceCategories"
  >,
  baseUrl?: string | null,
): SourceNativeCategory | null {
  if (product.sourceCategoryName) {
    return {
      categoryId: product.sourceCategoryId ?? slugifyCategoryId(product.sourceCategoryName),
      categoryName: product.sourceCategoryName,
      categoryPath: product.sourceCategoryPath ?? product.collectionPath ?? null,
      categoryUrl: product.sourceCategoryUrl ?? null,
    };
  }
  if (product.sourceCategories && product.sourceCategories.length > 0) {
    return product.sourceCategories[0] ?? null;
  }
  if (product.collectionLabel && product.collectionLabel !== product.collectionPath) {
    return {
      categoryId: slugifyCategoryId(product.collectionLabel),
      categoryName: product.collectionLabel,
      categoryPath: product.collectionPath ?? null,
      categoryUrl: baseUrl && product.collectionPath
        ? `${baseUrl.replace(/\/$/, "")}${product.collectionPath}`
        : null,
    };
  }
  return categoryFromCollectionPath(product.collectionPath ?? product.collectionLabel ?? null, baseUrl);
}

export function allCategoriesFromProduct(
  product: Pick<
    PilotProduct | RawAnalyzedProduct,
    | "sourceCategoryId"
    | "sourceCategoryName"
    | "sourceCategoryPath"
    | "sourceCategoryUrl"
    | "collectionPath"
    | "collectionLabel"
    | "sourceCategories"
  >,
  baseUrl?: string | null,
): SourceNativeCategory[] {
  let list: SourceNativeCategory[] = product.sourceCategories ? [...product.sourceCategories] : [];
  const primary = categoryFromProductFields(product, baseUrl);
  if (primary) list = mergeSourceCategories(list, primary);
  return list;
}

export function mergeSourceCategories(
  existing: SourceNativeCategory[] | undefined,
  incoming: SourceNativeCategory,
): SourceNativeCategory[] {
  const list = existing ? [...existing] : [];
  const index = list.findIndex((item) => item.categoryId === incoming.categoryId);
  if (index === -1) {
    list.push(incoming);
    return list;
  }
  list[index] = { ...list[index]!, ...incoming };
  return list;
}

export function buildSourceCategoryRefs(
  sourceId: string,
  products: Array<
    Pick<
      RawAnalyzedProduct,
      | "productUrl"
      | "sourceCategoryId"
      | "sourceCategoryName"
      | "sourceCategoryPath"
      | "sourceCategoryUrl"
      | "collectionPath"
      | "collectionLabel"
      | "sourceCategories"
    >
  >,
  baseUrl?: string | null,
): SourceCategoryRef[] {
  const refs = new Map<string, SourceCategoryRef>();
  for (const product of products) {
    for (const category of allCategoriesFromProduct(product, baseUrl)) {
      refs.set(category.categoryId, { sourceId, ...category });
    }
  }
  return [...refs.values()].sort((a, b) => a.categoryName.localeCompare(b.categoryName, "tr"));
}

export function countProductsInCategory(
  products: RawAnalyzedProduct[],
  categoryId: string,
  sourceId?: string,
): number {
  return products.filter((product) => {
    if (sourceId && product.source !== sourceId && slugifyCategoryId(product.brand) !== sourceId) {
      const productSource = product.source?.trim().toLowerCase();
      if (productSource !== sourceId) return false;
    }
    const category = categoryFromProductFields(product);
    return category?.categoryId === categoryId;
  }).length;
}
