import { evaluateFootwearProduct } from "../collector/footwearGate";
import { mergeProductCatalog } from "../collector/mergeProducts";
import type { CollectionAttemptResult } from "../collector/collectWithFallback";
import type { PilotProduct } from "../collector/types";
import type { OnboardingHttp } from "./http";

export const MASSIMO_SHOES_URL = "https://www.massimodutti.com/us/women/shoes-n1499";
export const MASSIMO_NEW_IN_URL = "https://www.massimodutti.com/us/women/new-in-mx-n3992";
type Row = Record<string, any>;

/** Source-specific Angular transfer state; this is not Zara's categories?ajax API. */
export function parseMassimoTransferState(html: string): Row | null {
  const value = html.match(/<script\b[^>]*\bid=["']mdfrontw-state["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

async function fetchMassimoState(http: OnboardingHttp, url: string) {
  let response = await http.fetchText(url, { timeoutMs: 20_000 });
  let state = response.ok ? parseMassimoTransferState(response.text) : null;
  // A single ordinary retry can recover an incomplete storefront response.
  // Access-denied/challenge pages are blockers, never schema fallbacks.
  const blocked = /access denied|captcha|verify you are human|checking your browser/i.test(response.text);
  if (!state && !blocked && (response.status === 0 || response.status === 200 || response.status === 429 || response.status >= 500)) {
    await new Promise(resolve => setTimeout(resolve, 1_000));
    response = await http.fetchText(url, { timeoutMs: 20_000 });
    state = response.ok ? parseMassimoTransferState(response.text) : null;
  }
  return { response, state };
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
    // The current storefront also keys a color gallery by its supplied image
    // path, e.g. /2026/I/1/1/p/1568/850/800, rather than only /800.
    const groups = (detailRow.detail?.xmedia ?? []).filter((group: Row) =>
      group.path === `/${color.id}` || (typeof color.image?.url === "string" &&
        (group.path === color.image.url || color.image.url.startsWith(`${group.path}/`) ||
          (color.image.url === `/${color.id}` && typeof group.path === "string" && group.path.endsWith(`/${color.id}`)))));
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
  const { response, state } = await fetchMassimoState(http, MASSIMO_SHOES_URL);
  const rows = state?.TRANSFER_PRODUCTS_WITH_IDS?.products;
  const now = new Date().toISOString();
  const baseline = (Array.isArray(rows) ? rows : []).map((row: Row) => mapMassimoProduct(row, MASSIMO_SHOES_URL, now)).filter((row): row is PilotProduct => Boolean(row));
  const elements = state?.TRANSFER_CATEGORY_PRODUCTS?.categoryGrid?.gridElements;
  const ids = [...new Set<string>((Array.isArray(elements) ? elements : []).flatMap((element: Row) => Array.isArray(element.ccIds) ? element.ccIds.map(String) : []))].filter(id => /^\d+$/.test(id));
  const errors = !response.ok ? [`Massimo official footwear page HTTP ${response.status}`] : !state ? ["Massimo transfer-state schema missing"] : [];
  const boundedIds = ids.slice(0, 500);
  if (boundedIds.length !== ids.length) errors.push("Massimo grid exceeds 500-product collection safety cap");
  const expanded: PilotProduct[] = [];
  const received = new Set<string>();
  for(let offset=0;offset<boundedIds.length;offset+=20){
    const batch=boundedIds.slice(offset,offset+20);
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
  // The official women's menu identifies this collection as NEW IN WOMAN.
  // Its full grid is membership evidence even when only initial rows are SSR.
  // A failed New In read must prevent publication of cleared NEW flags.
  if (state && errors.length === 0 && ids.length > 0) {
    const { response: newPage, state: newState } = await fetchMassimoState(http, MASSIMO_NEW_IN_URL);
    const newElements = newState?.TRANSFER_CATEGORY_PRODUCTS?.categoryGrid?.gridElements;
    if (!newPage.ok || !Array.isArray(newElements)) {
      errors.push(!newPage.ok ? `Massimo New In HTTP ${newPage.status}` : "Massimo New In transfer-state grid missing");
    } else {
      const newIds = new Set<string>(newElements.flatMap((element: Row) =>
        Array.isArray(element.ccIds) ? element.ccIds.map(String) : []));
      for (const product of products) {
        const id = new URL(product.productUrl).searchParams.get("pelement");
        if (!id || !newIds.has(id)) continue;
        product.isNewArrivalsCollection = true;
        product.sourceCategories?.push({ categoryId: "women-new-in", categoryName: "New In",
          categoryPath: new URL(MASSIMO_NEW_IN_URL).pathname, categoryUrl: MASSIMO_NEW_IN_URL });
      }
    }
  }
  const exhausted=ids.length>0 && received.size===ids.length && errors.length===0;
  return {products, discoveredLinks:new Set(products.map(p=>p.productUrl)), errors,
    method:"custom-adapter",paginationExhausted:exhausted,sourceReportedProductCount:ids.length||null,
    hitCollectionCrawlCap:!exhausted,rawProductUrlsDiscovered:received.size || baseline.length};
}
