import { describe, expect, it } from "vitest";
import { collectMassimoDuttiCatalog, mapMassimoApiProduct, mapMassimoProduct, MASSIMO_SHOES_URL, MASSIMO_NEW_IN_URL } from "../massimoDutti";
const media = { path: "https://static.massimodutti.net/assets/boot.jpg", contentType: { type: "image" } };
const row = { id: "123", sectionNameEN: "WOMEN", productType: "Footwear", name: "Leather riding boot", familyNameEN: "BOOT", locationPath: "/us/leather-riding-boot-l11005850", colors: [{ name: "BLACK", medias: [media] }] };
describe("Massimo official SSR adapter", () => {
  it("accepts footwear with category provenance and rejects other sections and foreign URLs", () => {
    expect(mapMassimoProduct(row, MASSIMO_SHOES_URL, "2026-09-28")?.sourceCategoryUrl).toBe(MASSIMO_SHOES_URL);
    expect(mapMassimoProduct({ ...row, sectionNameEN: "MEN" }, MASSIMO_SHOES_URL, "2026-09-28")).toBeNull();
    expect(mapMassimoProduct({ ...row, locationPath: "https://example.com/boot-l123" }, MASSIMO_SHOES_URL, "2026-09-28")).toBeNull();
  });
  it("excludes color swatches from covers and all variant galleries", () => {
    const swatch = {...media, path: "https://static.massimodutti.net/assets/11005850800-c.png?ts=1"};
    const product = mapMassimoProduct({...row, colors: [{name: "BLACK", medias: [swatch, {...swatch, path: "https://static.massimodutti.net/assets/11005850800-r.jpg"}, media]}]}, MASSIMO_SHOES_URL, "2026-09-28");
    expect(product?.imageUrl).toBe(media.path);
    expect(product?.images).toEqual([media.path]);
    expect(product?.variants?.[0].images).toEqual([media.path]);
    expect(mapMassimoProduct({...row, colors: [{medias: [swatch]}]}, MASSIMO_SHOES_URL, "2026-09-28")).toBeNull();
  });
  it("keeps partial SSR coverage distinct from the full grid and never claims exhausted pagination", async () => {
    const state = { TRANSFER_PRODUCTS_WITH_IDS: { products: [row] }, TRANSFER_CATEGORY_PRODUCTS: { categoryGrid: { gridElements: [{ ccIds: [123, 456] }] } } };
    const result = await collectMassimoDuttiCatalog({ fetchText: async () => ({ ok: true, status: 200, url: MASSIMO_SHOES_URL, text: `<script id="mdfrontw-state" type="application/json">${JSON.stringify(state)}</script>` }) });
    expect(result.products).toHaveLength(1);
    expect(result.sourceReportedProductCount).toBe(2);
    expect(result.paginationExhausted).toBe(false);
  });
  it("expands all grid IDs and only claims complete transport when all records arrive", async () => {
    const apiRow = {id: 123, productUrl: "leather-riding-boot-l11005850", productUrlParam: 123,
      name: row.name, sectionNameEN: "WOMEN", productType: "Footwear", familyNameEN: "BOOT", mainColorid: "800",
      detail: {colors: [{id: "800", name: "BLACK"}], xmedia: [{path: "/800", xmediaItems: [{medias: [{format: 1, url: media.path}]}]}]}};
    const state = {TRANSFER_CATEGORY_PRODUCTS: {categoryGrid: {gridElements: [{ccIds: [123]}]}}};
    const http = {fetchText: async (url: string) => ({ok: true, status: 200, url,
      text: url.includes("productsArray") ? JSON.stringify({products: [apiRow]}) : `<script id="mdfrontw-state">${JSON.stringify(state)}</script>`})};
    const result = await collectMassimoDuttiCatalog(http);
    expect(result.products).toHaveLength(1);
    expect(result.paginationExhausted).toBe(true);
    expect(result.hitCollectionCrawlCap).toBe(false);
    expect(result.products[0].imageUrl).toBe(media.path);
    const missing = await collectMassimoDuttiCatalog({fetchText: async (url) => url.includes("productsArray")
      ? {ok:true,status:200,url,text:'{"products":[]}'} : http.fetchText(url)});
    expect(missing.paginationExhausted).toBe(false);
  });
  it("returns no products on blocked response even when its body contains product-like state", async () => {
    const result = await collectMassimoDuttiCatalog({ fetchText: async () => ({ ok: false, status: 403, url: MASSIMO_SHOES_URL, text: "Access Denied" }) });
    expect(result.products).toEqual([]);
    expect(result.errors[0]).toContain("403");
  });
  it("maps source seasonal gallery paths without borrowing another color's gallery", () => {
    const path = "/2026/I/1/1/p/1568/850/800";
    const product = mapMassimoApiProduct({ ...row, productUrl: "leather-riding-boot-l11005850", mainColorid: "800",
      detail: {colors: [{id: "800", name: "BLACK", image: {url: `${path}/1568850800`}},
        {id: "700", name: "BROWN", image: {url: "/2026/I/1/1/p/1568/850/700/1568850700"}}],
      xmedia: [{path, xmediaItems: [{medias: [{format: 1, url: media.path}]}]},
        {path: "/unrelated", xmediaItems: [{medias: [{format: 1, url: "https://static.massimodutti.net/wrong.jpg"}]}]}]}}, "2026-10-03");
    expect(product?.images).toEqual([media.path]);
    expect(product?.variants?.[1].images).toEqual([]);
  });
  it("uses full New In grid membership and blocks publication when that collection fails", async () => {
    const apiRow = { ...row, productUrl: "leather-riding-boot-l11005850", productUrlParam: 123,
      detail: {colors: [{id: "800", name: "BLACK"}], xmedia: [{path: "/800", xmediaItems: [{medias: [{format: 1, url: media.path}]}]}]}};
    const html = (ids: number[]) => `<script id="mdfrontw-state">${JSON.stringify({TRANSFER_CATEGORY_PRODUCTS: {categoryGrid: {gridElements: [{ccIds: ids}]}}})}</script>`;
    let blocked = false;
    let newIds = [123];
    const http = {fetchText: async (url: string) => ({ok: !(blocked && url === MASSIMO_NEW_IN_URL),
      status: blocked && url === MASSIMO_NEW_IN_URL ? 403 : 200, url,
      text: url.includes("productsArray") ? JSON.stringify({products: [apiRow]}) : html(url === MASSIMO_NEW_IN_URL ? newIds : [123])})};
    const fresh = await collectMassimoDuttiCatalog(http);
    expect(fresh.paginationExhausted).toBe(true);
    expect(fresh.products[0].isNewArrivalsCollection).toBe(true);
    expect(fresh.products[0].sourceCategories).toContainEqual(expect.objectContaining({categoryName: "New In", categoryUrl: MASSIMO_NEW_IN_URL}));
    newIds = [];
    const departed = await collectMassimoDuttiCatalog(http);
    expect(departed.paginationExhausted).toBe(true);
    expect(departed.products[0].isNewArrivalsCollection).toBe(false);
    blocked = true;
    const failed = await collectMassimoDuttiCatalog(http);
    expect(failed.paginationExhausted).toBe(false);
    expect(failed.errors).toContain("Massimo New In HTTP 403");
  });
  it("bounds malformed large grids and keeps the collection incomplete", async () => {
    let requests = 0;
    const state = {TRANSFER_CATEGORY_PRODUCTS: {categoryGrid: {gridElements: [{ccIds: Array.from({length: 501}, (_, i) => i + 1)}]}}};
    const result = await collectMassimoDuttiCatalog({fetchText: async url => {
      requests++;
      return {ok: true, status: 200, url, text: url.includes("productsArray") ? '{"products":[]}' : `<script id="mdfrontw-state">${JSON.stringify(state)}</script>`};
    }});
    expect(requests).toBe(26);
    expect(result.paginationExhausted).toBe(false);
    expect(result.sourceReportedProductCount).toBe(501);
    expect(result.errors).toContain("Massimo grid exceeds 500-product collection safety cap");
  });
});
