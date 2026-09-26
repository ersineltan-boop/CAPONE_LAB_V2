import { isGenericModelTitle } from "../../modelFamily/genericModelTitle";
import { handleFamiliesCompatible, shopifyHandleFamilyKey } from "../../modelFamily/handleFamily";
import { stripColorwayDescriptors } from "../../modelFamily/safeNameColorway";
import type { FootwearCategory } from "../../collector/types";
import type { WaveColorway, WaveModelFamily } from "./types";

export interface FamilyProduct {
  handle: string;
  productUrl: string;
  title: string;
  color: string | null;
  sku: string | null;
  images: string[];
  category: FootwearCategory;
  productType: string;
  tags: string[];
  inNewArrivals: boolean;
  isNew: boolean;
  newnessEvidence: WaveColorway["newnessEvidence"];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function siblingHandles(tags: readonly string[]): string[] {
  return tags
    .filter((tag) => tag.toLowerCase().startsWith("variant_"))
    .map((tag) => tag.slice("variant_".length).trim().toLowerCase())
    .filter(Boolean);
}

function dedupeImages(images: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const image of images) {
    const trimmed = image.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

class UnionFind {
  private parent = new Map<string, string>();

  add(id: string): void {
    if (!this.parent.has(id)) this.parent.set(id, id);
  }

  find(id: string): string {
    const parent = this.parent.get(id) ?? id;
    if (parent === id) return id;
    const root = this.find(parent);
    this.parent.set(id, root);
    return root;
  }

  union(a: string, b: string): void {
    this.add(a);
    this.add(b);
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootB, rootA);
  }
}

function colorLabel(title: string, modelName: string): string | null {
  const stripped = stripColorwayDescriptors(title);
  if (!stripped || stripped === modelName.toLowerCase()) {
    const rest = title.replace(new RegExp(modelName, "i"), "").replace(/^[\s\-/|]+/, "").trim();
    return rest || null;
  }
  const withoutModel = title
    .replace(new RegExp(`^${modelName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"), "")
    .replace(/^[\s\-/|]+/, "")
    .trim();
  return withoutModel || null;
}

function toColorway(product: FamilyProduct, modelName: string): WaveColorway {
  return {
    productUrl: product.productUrl,
    handle: product.handle,
    title: product.title,
    color: product.color ?? colorLabel(product.title, modelName),
    sku: product.sku,
    images: dedupeImages(product.images),
    category: product.category,
    productType: product.productType,
    inNewArrivals: product.inNewArrivals,
    isNew: product.isNew,
    newnessEvidence: product.newnessEvidence,
  };
}

export function groupColorwaysIntoFamilies(
  brand: string,
  slug: string,
  products: readonly FamilyProduct[],
): WaveModelFamily[] {
  const byHandle = new Map(products.map((product) => [product.handle.toLowerCase(), product]));
  const union = new UnionFind();
  for (const product of products) union.add(product.handle.toLowerCase());

  for (const product of products) {
    const handle = product.handle.toLowerCase();
    for (const sibling of siblingHandles(product.tags)) {
      if (!byHandle.has(sibling)) continue;
      union.union(handle, sibling);
    }
  }

  const components = new Map<string, FamilyProduct[]>();
  for (const product of products) {
    const root = union.find(product.handle.toLowerCase());
    const group = components.get(root) ?? [];
    group.push(product);
    components.set(root, group);
  }

  const singletons: FamilyProduct[] = [];
  const grouped: FamilyProduct[][] = [];
  for (const group of components.values()) {
    if (group.length === 1) singletons.push(group[0]!);
    else grouped.push(group);
  }

  const handleBuckets = new Map<string, FamilyProduct[]>();
  for (const product of singletons) {
    const key = shopifyHandleFamilyKey(product.productUrl);
    if (!key || isGenericModelTitle(key)) {
      grouped.push([product]);
      continue;
    }
    const bucket = handleBuckets.get(key) ?? [];
    bucket.push(product);
    handleBuckets.set(key, bucket);
  }

  for (const bucket of handleBuckets.values()) {
    if (bucket.length === 1) {
      grouped.push(bucket);
      continue;
    }
    const compatible = bucket.every((product, index) =>
      bucket.slice(index + 1).every((other) => handleFamiliesCompatible(product.productUrl, other.productUrl)),
    );
    if (compatible) grouped.push(bucket);
    else for (const product of bucket) grouped.push([product]);
  }

  const usedIds = new Set<string>();
  return grouped.map((group) => {
    const stripped = group
      .map((product) => stripColorwayDescriptors(product.title))
      .filter(Boolean);
    const shared = stripped.length > 0 && stripped.every((value) => value === stripped[0]) ? stripped[0]! : "";
    const modelName = shared && !isGenericModelTitle(shared) ? titleCase(shared) : group[0]!.title;
    const reason: WaveModelFamily["groupingReason"] =
      group.length > 1 && group.some((product) => siblingHandles(product.tags).length > 0)
        ? "shopify-variant-tag"
        : group.length > 1
          ? "handle-family"
          : "single-product";
    let modelFamilyId = `${slug}--${slugify(modelName) || group[0]!.handle}`;
    if (usedIds.has(modelFamilyId)) modelFamilyId = `${modelFamilyId}--${group[0]!.handle}`;
    usedIds.add(modelFamilyId);
    const variants = group.map((product) => toColorway(product, modelName));
    const images = dedupeImages(variants.flatMap((variant) => variant.images));
    return {
      modelFamilyId,
      brand,
      canonicalName: modelName,
      category: variants[0]!.category,
      images,
      variants,
      isNew: variants.some((variant) => variant.isNew),
      groupingReason: reason,
    };
  });
}
