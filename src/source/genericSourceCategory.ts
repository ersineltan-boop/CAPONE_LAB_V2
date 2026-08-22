import type { SourceNativeCategory } from "./types";

const GENERIC_ID =
  /^(all|shop-all|view-all|all-products|shop-all-products|all-items|all-shoes|all-footwear|shoes|footwear|womens-shoes|women-shoes|women-s-shoes|shop-all-shoes|shoes-view-all)$/i;

const GENERIC_NAME =
  /^(all|shop all|view all|all products|all shoes|all footwear|shoes|footwear|women'?s shoes|womens shoes|women shoes|shoes view all|shop all shoes)$/i;

export function isGenericFootwearRootName(name: string): boolean {
  return GENERIC_NAME.test(name.trim());
}

export function isGenericFootwearRootCategory(category: SourceNativeCategory): boolean {
  if (GENERIC_ID.test(category.categoryId)) return true;
  if (isGenericFootwearRootName(category.categoryName)) return true;
  const handle = (category.categoryPath ?? "").split("/").filter(Boolean).pop() ?? "";
  const cleaned = handle.replace(/\.html$/i, "");
  return GENERIC_ID.test(cleaned);
}
