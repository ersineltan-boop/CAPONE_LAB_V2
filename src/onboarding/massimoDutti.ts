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

/** Map the same public productsArray records used by the source storefront. */
export function mapMassimoApiProduct(row: Row, discoveredAt: string): PilotProduct | null {
  const detailRow = row.bundleProductSummaries?.[0] ?? row;
  const colors = (detailRow.detail?.colors ?? []).map((color: Row) => {
    const groups = (detailRow.detail?.xmedia ?? []).filter((group: Row) => group.path === `/${color.id}`);
    const medias = groups.flatMap((group: Row) => (group.xmediaItems ?? []).flatMap((item: Row) => item.medias ?? []))
      .filter((media: Row) => media.format === 1 && typeof media.url === "string")
      .map((media: Row) => ({path: media.url, contentType: {type: "image"}}));
    return {...color, medias};
  });
  const selected = colors.find((color: Row) => String(color.id) === String(row.mainColorid)) ?? colors[0];
  if (!row.productUrl || !selected) return null;
  return mapMassimoProduct({...row, detail: {...detailRow.detail, description: detailRow.detail?.longDescription},
    locationPath: `/us/${row.productUrl}?pelement=${row.productUrlParam ?? row.id}`,
    colors, status: {selectedColor: selected}}, MASSIMO_SHOES_URL, discoveredAt);
}

export async function collectMassimoDuttiCatalog(http: OnboardingHttp): Promise<CollectionAttemptResult> {
  const response = await http.fetchText(MASSIMO_SHOES_URL);
  const state = response.ok ? parseMassimoTransferState(response.text) : null;
  const rows = state?.TRANSFER_PRODUCTS_WITH_IDS?.products;
  const now = new Date().toISOString();
  const baseline = (Array.isArray(rows) ? rows : []).map((row: Row) => mapMassimoProduct(row, MASSIMO_SHOES_URL, now)).filter((row): row is PilotProduct => Boolean(row));
  const elements = state?.TRANSFER_CATEGORY_PRODUCTS?.categoryGrid?.gridElements;
  const ids = [...new Set<string>((Array.isArray(elements) ? elements : []).flatMap((element: Row) => Array.isArray(element.ccIds) ? element.ccIds.map(String) : []))].filter(id => /^\d+$/.test(id));
  const errors = !response.ok ? [`Massimo official footwear page HTTP ${response.status}`] : !state ? ["Massimo transfer-state schema missing"] : [];
  const expanded: PilotProduct[] = [];
  const received = new Set<string>();
  for(let offset=0;offset<ids.length;offset+=20){
    const batch=ids.slice(offset,offset+20);
    const url=`https://www.massimodutti.com/itxrest/3/catalog/store/34009527/30359506/productsArray?productIds=${batch.join(",")}&languageId=-1`;
    const page=await http.fetchText(url);
    if(!page.ok){errors.push(`Massimo productsArray HTTP ${page.status}`);break;}
    let records: Row[];
    try { records=JSON.parse(page.text).products;if(!Array.isArray(records))throw new Error("products missing"); }
    catch {errors.push("Massimo productsArray schema missing");break;}
    for(const row of records){
      if(!batch.includes(String(row.id)))continue;
      received.add(String(row.id));
      const product=mapMassimoApiProduct(row,now);
      if(product)expanded.push(product);else errors.push(`Unmapped grid product ${row.id}`);
    }
  }
  const products=mergeProductCatalog(baseline,expanded);
  const exhausted=ids.length>0 && received.size===ids.length && errors.length===0;
  return {products, discoveredLinks:new Set(products.map(p=>p.productUrl)), errors,
    method:"custom-adapter",paginationExhausted:exhausted,sourceReportedProductCount:ids.length||null,
    hitCollectionCrawlCap:!exhausted,rawProductUrlsDiscovered:received.size || baseline.length};
}
