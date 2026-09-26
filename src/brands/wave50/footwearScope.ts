import { evaluateFootwearProduct, isMensOnlyProduct } from "../../collector/footwearGate";
import type { FootwearCategory } from "../../collector/types";

const ALLOWED_PRODUCT_TYPES = new Set([
  "boot",
  "boots",
  "flat",
  "flats",
  "heel",
  "heels",
  "loafer",
  "loafers",
  "mule",
  "mules",
  "sandal",
  "sandals",
  "slide",
  "slides",
  "sandals/slides",
  "slipper",
  "slippers",
  "sneaker",
  "sneakers",
  "pump",
  "pumps",
  "ballerina",
  "ballerinas",
  "espadrille",
  "espadrilles",
  "wedge",
  "wedges",
  "clog",
  "clogs",
  "mary jane",
  "mary janes",
  "thong",
  "thongs",
]);

const DENIED_PRODUCT_TYPES = new Set([
  "bag",
  "bags",
  "handbag",
  "handbags",
  "hat",
  "hats",
  "jewelry",
  "jewellery",
  "miscellaneous",
  "misc",
  "shoe accessories",
  "shoe accessory",
  "shoe care",
  "sunglasses",
  "underwear",
  "socks",
  "sock",
  "accessory",
  "accessories",
  "clothing",
  "apparel",
  "activewear",
  "swimwear",
]);

export function normalizeProductType(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function isDeniedProductType(productType: string | null | undefined): boolean {
  return DENIED_PRODUCT_TYPES.has(normalizeProductType(productType));
}

export function isAllowedFootwearProductType(productType: string | null | undefined): boolean {
  return ALLOWED_PRODUCT_TYPES.has(normalizeProductType(productType));
}

export interface ScopedProductInput {
  title: string;
  productType?: string | null;
  tags?: string[];
  handle?: string;
  fromVerifiedFootwearCollection?: boolean;
}

export type FootwearScopeDecision =
  | { decision: "footwear"; category: FootwearCategory }
  | { decision: "excluded"; reason: string };

export function classifyWomensFootwear(input: ScopedProductInput): FootwearScopeDecision {
  const productType = input.productType ?? "";
  const fromVerifiedFootwearCollection = input.fromVerifiedFootwearCollection === true;
  const gateInput = {
    title: input.title,
    productType,
    tags: input.tags ?? [],
    handle: input.handle,
    fromVerifiedFootwearCollection,
  };

  if (isDeniedProductType(productType)) {
    return { decision: "excluded", reason: `product_type:${normalizeProductType(productType)}` };
  }
  if (isMensOnlyProduct(gateInput)) {
    return { decision: "excluded", reason: "mens-only" };
  }

  const gate = evaluateFootwearProduct(gateInput);
  if (isAllowedFootwearProductType(productType)) {
    return {
      decision: "footwear",
      category: gate.category ?? "OTHER_FOOTWEAR",
    };
  }

  if (!normalizeProductType(productType)) {
    if (
      gate.decision === "ACCEPT_FOOTWEAR" &&
      gate.category &&
      (fromVerifiedFootwearCollection || gate.category !== "OTHER_FOOTWEAR")
    ) {
      return { decision: "footwear", category: gate.category };
    }
    return { decision: "excluded", reason: "missing-product-type" };
  }

  if (gate.decision === "ACCEPT_FOOTWEAR" && gate.category) {
    return { decision: "footwear", category: gate.category };
  }

  return { decision: "excluded", reason: gate.matchedSignals[0] ?? "not-womens-footwear" };
}

export function countByProductType(
  products: readonly { productType?: string | null }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const product of products) {
    const key = (product.productType ?? "").trim() || "(empty)";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
