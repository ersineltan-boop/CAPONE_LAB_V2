import { evaluateFootwearProduct } from "../collector/footwearGate";
import { mergeProductCatalog } from "../collector/mergeProducts";
import type { CollectionAttemptResult } from "../collector/collectWithFallback";
import type { PilotProduct } from "../collector/types";
import type { OnboardingHttp } from "./http";

export const MASSIMO_SHOES_URL = "https://www.massimodutti.com/us/women/shoes-n1499";
type Row = Record<string, any>;

/** Source-specific Angular transfer state; this is not Zara's categories?ajax API. */
export function parseMassimoTransferState(html: string): Row | null {
  const value = html.match(/<script\b[^>]*\bid=["']mdfrontw-state["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

export function isMassimoProductImage(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "static.massimodutti.net" && !/-(?:c|r)\.(?:png|jpe?g|webp)$/i.test(parsed.pathname);
  } catch { return false; }
}

export function mapMassimoProduct(row: Row, collectionUrl: string, discoveredAt: string): PilotProduct | null {
  if (row.sectionNameEN !== "WOMEN" || row.productType !== "Footwear" || typeof row.name !== "string" || typeof row.locationPath !== "string") return null;
  let url: URL;
  try { url = new URL(row.locationPath, MASSIMO_SHOES_URL); } catch { return null; }
  if (url.origin !== new URL(MASSIMO_SHOES_URL).origin || !/-l\d+/.test(url.pathname)) return null;
  const gate = evaluateFootwearProduct({ title: row.name, productType: [row.familyNameEN, row.subFamilyNameEN].filter(Boolean).join(" "), tags: ["WOMEN", "Footwear"], collectionPath: new URL(collectionUrl).pathname, fromVerifiedFootwearCollection: true });
  if (gate.decision !== "ACCEPT_FOOTWEAR" || !gate.category) return null;
  const colors = Array.isArray(row.colors) ? row.colors : [];
  const imageList = (color: Row): string[] => [...new Set<string>((Array.isArray(color.medias) ? color.medias : []).filter((media: Row) => media.contentType?.type === "image" && !media.isFallback && typeof media.path === "string" && media.path.startsWith("https://static.massimodutti.net/") && isMassimoProductImage(media.path)).map((media: Row) => media.path))];
  const selected = row.status?.selectedColor ?? colors[0] ?? {};
  const images = imageList(selected);
  if (!images.length) return null;
  const categoryPath = new URL(collectionUrl).pathname;
  const variants = colors.map((color: Row) => ({ title: `${row.name} ${color.name ?? ""}`.trim(), color: color.name ?? null, sku: row.detail?.displayReference ?? row.reference ?? null, imageUrl: imageList(color)[0] ?? null, images: imageList(color) }));
  return {
    source: "massimo-dutti", brand: "MASSIMO DUTTI", productName: row.name,
    productUrl: url.href, imageUrl: images[0], images, category: gate.category,
    color: selected.name ?? null, material: null, toeShape: null, heelType: null, heelHeight: null,
    details: row.detail?.description ?? row.subFamilyNameEN ?? null, discoveredAt,
    collectionPath: categoryPath, collectionLabel: "Women's shoes",
    sourceCategoryId: "women-shoes", sourceCategoryName: "Women's shoes",
    sourceCategoryPath: categoryPath, sourceCategoryUrl: collectionUrl,
    sourceCategories: [{ categoryId: "women-shoes", categoryName: "Women's shoes", categoryPath, categoryUrl: collectionUrl }],
    isNewArrivalsCollection: false, hasNewBadge: false, variants,
  };
}

/** SSR is a bounded sample (20 products while the current grid lists 115).
 * Never claim completeness or remove last-good products on this basis. */
export async function collectMassimoDuttiCatalog(http: OnboardingHttp): Promise<CollectionAttemptResult> {
  const response = await http.fetchText(MASSIMO_SHOES_URL);
  const state = response.ok ? parseMassimoTransferState(response.text) : null;
  const rows = state?.TRANSFER_PRODUCTS_WITH_IDS?.products;
  const products = mergeProductCatalog([], (Array.isArray(rows) ? rows : []).map((row: Row) => mapMassimoProduct(row, MASSIMO_SHOES_URL, new Date().toISOString())).filter((row): row is PilotProduct => Boolean(row)));
  const elements = state?.TRANSFER_CATEGORY_PRODUCTS?.categoryGrid?.gridElements;
  const gridIds = new Set((Array.isArray(elements) ? elements : []).flatMap((element: Row) => Array.isArray(element.ccIds) ? element.ccIds.map(String) : []));
  return {
    products, discoveredLinks: new Set(products.map((product) => product.productUrl)),
    errors: !response.ok ? [`Massimo official footwear page HTTP ${response.status}`] : !state ? ["Massimo transfer-state schema missing"] : [],
    method: "custom-adapter", paginationExhausted: false,
    sourceReportedProductCount: gridIds.size || null, hitCollectionCrawlCap: true,
    rawProductUrlsDiscovered: products.length,
  };
}
