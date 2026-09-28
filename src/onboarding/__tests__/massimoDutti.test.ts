import { describe, expect, it } from "vitest";
import { collectMassimoDuttiCatalog, mapMassimoProduct, MASSIMO_SHOES_URL } from "../massimoDutti";
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
  it("returns no products on blocked response even when its body contains product-like state", async () => {
    const result = await collectMassimoDuttiCatalog({ fetchText: async () => ({ ok: false, status: 403, url: MASSIMO_SHOES_URL, text: "Access Denied" }) });
    expect(result.products).toEqual([]);
    expect(result.errors[0]).toContain("403");
  });
});
