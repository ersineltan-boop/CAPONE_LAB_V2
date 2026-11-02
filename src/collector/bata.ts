import { classifyOfficialFootwear, legacyCategoryForPrimary } from "../brands/wave50/primaryCategory";
import type { PilotProduct } from "./types";

export interface BataDetail {
  listing: Record<string, string>;
  product: { name: string; mpn: string; brand: { name: string }; image: string[]; description?: string };
  url: string;
  canonical: string;
}

export interface BataSnapshot {
  status: string;
  checkedAt: string;
  sourceTotal: number;
  products: BataDetail[];
  excludedIds: string[];
}

// Keep the own-product classification through publication; broad source departments
// remain evidence, but must not replace a more specific shoe title.
export function bataPrimaryCategory({ listing, product }: BataDetail) {
  return /\bflip[\s-]?flops?\b/i.test(product.name) ? "SANDAL" as const
    : classifyOfficialFootwear({ title: product.name, description: [listing.name, product.description].filter(Boolean).join(" "), productType: listing.category3 })
      ?? (listing.category3 === "Pump Shoes" ? "PUMP" as const : null);
}

export function prepareBataProducts(snapshot: BataSnapshot, now = Date.now()) {
  const checked = Date.parse(snapshot.checkedAt);
  if (snapshot.status !== "SOURCE_VERIFIED" || !Number.isFinite(checked) || checked > now || now - checked > 24 * 3600_000 ||
      snapshot.products.length + snapshot.excludedIds.length !== snapshot.sourceTotal) throw new Error("Incomplete/stale BATA source snapshot");
  const ids = new Set(snapshot.excludedIds);
  if (ids.size !== snapshot.excludedIds.length) throw new Error("Duplicate BATA exclusion");
  const urls = new Set<string>();
  const products: PilotProduct[] = [];
  for (const detail of snapshot.products) {
    const { listing, product } = detail;
    const womenScope = listing.category1 === "Woman" && listing.category2 === "Shoes" && !["Men", "Gentlemen", "Boys"].includes(listing["gender-name"])
      || listing["gender-name"] === "Ladies" && (listing.category2 === undefined || listing.category2 === "Collections") && /\b(?:sneakers?|loafers?|ballerinas?|sandals?|boots?|moccasins?|pumps?|espadrilles?)\b/i.test(listing.name);
    const ownIdentity = product.mpn === listing.id || product.mpn.startsWith(listing.id + "_") && /^[0-9]{2}$/.test(product.mpn.slice(listing.id.length + 1));
    if (!womenScope || listing.brand.toUpperCase() !== "BATA" || product.brand.name.toUpperCase() !== "BATA" || !ownIdentity || ids.has(listing.id) ||
        !detail.url.startsWith("https://www.bata.com/pt/") || urls.has(detail.url) || !product.image.length ||
        product.image.some(url => !url.startsWith("https://www.bata.com/dw/image/"))) throw new Error("BATA identity/gallery mismatch");
    const primary = bataPrimaryCategory(detail);
    const category = /\bflip[\s-]?flops?\b/i.test(product.name) ? "THONG" as const
      : primary ? legacyCategoryForPrimary(primary)
      : listing.category3 === "Pump Shoes" ? "PUMP" as const : null;
    if (!category) throw new Error(`Unresolved BATA category: ${listing.id}; ${product.name}`);
    ids.add(listing.id);
    urls.add(detail.url);
    const color = listing.color && listing.color !== "null" ? listing.color : null;
    products.push({ source: "bata", brand: "BATA", productName: product.name, productUrl: detail.url,
      imageUrl: product.image[0], images: [...product.image], category, color,
      material: null, toeShape: null, heelType: null, heelHeight: null, details: product.description ?? null,
      discoveredAt: snapshot.checkedAt, sourceVerifiedAt: snapshot.checkedAt, sourceModelCode: product.mpn,
      sourceCategoryId: listing.category ?? null, sourceCategoryName: listing.category3 ?? null,
      sourceCategoryPath: [listing.category1, listing.category2, listing.category3].filter(Boolean).join("/"),
      collectionPath: "/pt/woman/brand/bata/", hasNewBadge: false, isNewArrivalsCollection: false,
      variants: [{ title: product.name, color, sku: product.mpn, images: [...product.image] }],
    });
  }
  return products;
}
