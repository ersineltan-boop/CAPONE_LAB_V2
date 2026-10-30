import { classifyOfficialFootwear, legacyCategoryForPrimary } from "../brands/wave50/primaryCategory";
import type { PilotProduct, FootwearCategory } from "./types";

export interface JonakCard {
  id: string;
  url: string;
  images: string[];
  sourceMetadata: { id: string; name: string; category: string; variant?: string; sku?: string };
}

export function jonakCategory(card: JonakCard): FootwearCategory | "EXCLUDED" | null {
  const path = card.sourceMetadata.category.toLowerCase();
  const title = card.sourceMetadata.name.toLowerCase();
  if (/\b(?:socks?|gloves?|tights?|gaiters?|bags?|belts?)\b/.test(path + " " + title)) return "EXCLUDED";
  if (/\/ballet flats\//.test(path) || /\bballet flats?\b/.test(title)) return "BALLERINA";
  if (/\/mary janes|\bmary janes?\b|\bbabies\b/.test(path + " " + title)) return "MARY_JANE";
  if (/\/lowboots$|\blowboots?\b/.test(path + " " + title)) return "ANKLE_BOOT";
  const primary = classifyOfficialFootwear({ title: card.sourceMetadata.name, description: path.replaceAll("/", " ") });
  return primary ? legacyCategoryForPrimary(primary) : null;
}

export function prepareJonakProducts(input: { checkedAt: string; sourceTotal: number; status: string; products: JonakCard[] }, now = Date.now()) {
  if (input.status !== "LISTING_VERIFIED" || !Number.isFinite(Date.parse(input.checkedAt)) ||
      now - Date.parse(input.checkedAt) > 24 * 3600_000 || now < Date.parse(input.checkedAt) ||
      input.products.length !== input.sourceTotal || new Set(input.products.map(x => x.id)).size !== input.sourceTotal ||
      new Set(input.products.map(x => x.url)).size !== input.sourceTotal) throw new Error("Unverified, stale or incomplete JONAK listing");
  const products: PilotProduct[] = [];
  const excluded: string[] = [];
  const unresolved: string[] = [];
  for (const card of input.products) {
    if (card.sourceMetadata.id !== card.id || !card.url.startsWith("https://www.jonak-paris.com/p/") ||
        !card.images.length || card.images.some(image => !image.startsWith("https://www.jonak-paris.com/phototheque/"))) throw new Error("Invalid JONAK source identity/gallery");
    const category = jonakCategory(card);
    if (category === "EXCLUDED") { excluded.push(card.id); continue; }
    if (!category) { unresolved.push(card.id); continue; }
    products.push({ source: "JONAK", brand: "JONAK", productName: card.sourceMetadata.name,
      productUrl: card.url, imageUrl: card.images[0], images: [...card.images], category,
      color: card.sourceMetadata.variant ?? null, material: null, toeShape: null, heelType: null,
      heelHeight: null, details: null, discoveredAt: input.checkedAt, sourceVerifiedAt: input.checkedAt,
      sourceCategoryPath: card.sourceMetadata.category, sourceCategoryName: card.sourceMetadata.category.split("/").at(-1),
      collectionPath: "/collection/woman-shoes.html", hasNewBadge: false, isNewArrivalsCollection: false,
      variants: [{ title: card.sourceMetadata.name, color: card.sourceMetadata.variant ?? null, sku: card.sourceMetadata.sku ?? null, images: [...card.images] }],
    });
  }
  if (unresolved.length) throw new Error(`Unresolved JONAK taxonomy: ${unresolved.join(",")}`);
  return { products, excluded };
}
