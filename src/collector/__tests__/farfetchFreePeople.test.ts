import { describe, expect, it } from "vitest";

import {
  farfetchImageUrl,
  farfetchJsonLdToProduct,
  parseFarfetchItemList,
  parseFarfetchCatalogPagination,
} from "../farfetch";
import { isFreePeopleAntiBot } from "../freePeople";

const FARFETCH_HTML = `
<script type="application/ld+json">{"@context":"https://schema.org","@type":"ItemList","numberOfItems":2,"itemListElement":[{"@type":"Product","name":"Teju 85 leather mules","image":["https://cdn-images.farfetch-contents.com/30/95/87/31/30958731_60261410_480.jpg"],"brand":{"@type":"Brand","name":"Paris Texas"},"offers":{"@type":"Offer","url":"/uk/shopping/women/paris-texas-teju-85-leather-mules-item-30958731.aspx"}},{"@type":"Product","name":"Leather tote","image":["https://cdn-images.farfetch-contents.com/x_480.jpg"],"brand":{"name":"The Row"},"offers":{"url":"/uk/shopping/women/the-row-leather-tote-item-1.aspx"}}]}</script>
`;

describe("Farfetch marketplace JSON-LD collector", () => {
  it('recognizes D-ring creepers as footwear without admitting actual rings or bags', () => {
    const item = {name:'x 10 Corso Como D-ring embellished creepers',brand:{name:'George Cox'},
      image:['https://cdn-images.farfetch-contents.com/17/59/85/50/17598550_36651036_480.jpg'],
      offers:{url:'/uk/shopping/women/george-cox-d-ring-creepers-item-17598550.aspx'}};
    const listing='https://www.farfetch.com/uk/shopping/women/derby-oxford-shoes-1/items.aspx';
    const product=farfetchJsonLdToProduct(item,listing,'2026-10-14T08:00:00Z');
    expect(product?.productName).toBe(item.name);
    expect(product?.sourceCategoryUrl).toBe(listing);
    for(const name of ['D-ring embellished ring','creepers-print tote bag']) {
      const offers={url:`/uk/shopping/women/test-${name.replaceAll(' ','-')}-item-2.aspx`};
      expect(farfetchJsonLdToProduct({...item,name,offers},listing,'2026-10-14T08:00:00Z')).toBeNull();
    }
  });
  it('reads the full catalog total independently of the JSON-LD page card count', () => {
    const state = {apolloInitialState:{ROOT_QUERY:{'productCatalog:{"first":96}':{
      totalCount:63123,pageInfo:{startCursor:btoa('97'),hasNextPage:true}},
      myRecommendedProductCatalog:{totalCount:2}}}};
    const html = `<script>window.__HYDRATION_STATE__=${JSON.stringify(JSON.stringify(state))};</script>`;
    expect(parseFarfetchCatalogPagination(html)).toEqual({total:63123,page:2,size:96,hasNextPage:true});
    expect(parseFarfetchCatalogPagination(FARFETCH_HTML)).toBeNull();
    expect(parseFarfetchCatalogPagination('<script>window.__HYDRATION_STATE__="broken";</script>')).toBeNull();
  });
  it("parses listing products with actual brand names and upgrades image width", () => {
    const items = parseFarfetchItemList(FARFETCH_HTML);
    expect(items).toHaveLength(2);
    const mule = farfetchJsonLdToProduct(
      items[0]!,
      "https://www.farfetch.com/uk/shopping/women/shoes-1/items.aspx",
      "2026-08-22T00:00:00.000Z",
    );
    expect(mule?.brand).toBe("Paris Texas");
    expect(mule?.source).toBe("farfetch");
    expect(mule?.productUrl).toContain("item-30958731");
    expect(mule?.images?.[0]).toContain("_1000.jpg");
    expect(farfetchImageUrl("https://cdn.example.com/a_480.jpg")).toContain("_1000.jpg");
  });

  it("does not accept bag listings from a footwear ItemList", () => {
    const items = parseFarfetchItemList(FARFETCH_HTML);
    const tote = farfetchJsonLdToProduct(
      items[1]!,
      "https://www.farfetch.com/uk/shopping/women/shoes-1/items.aspx",
      "2026-08-22T00:00:00.000Z",
    );
    expect(tote).toBeNull();
  });

  it("uses an explicit Farfetch slipper category when the title omits the silhouette", () => {
    const product = farfetchJsonLdToProduct(
      {
        "@type": "Product",
        name: "London shearling shoes",
        image: "https://cdn-images.farfetch-contents.com/1_480.jpg",
        brand: { name: "Birkenstock" },
        offers: { url: "/uk/shopping/women/birkenstock-london-item-1.aspx" },
      },
      "https://www.farfetch.com/uk/shopping/women/slippers-1/items.aspx",
      "2026-10-13T20:00:00.000Z",
    );
    expect(product?.category).toBe("LOAFER");
  });
});

describe("Free People marketplace blocker", () => {
  it("treats Akamai 403 interstitials as anti-bot", () => {
    expect(isFreePeopleAntiBot(403, '<html><div id="cmsg"></div></html>')).toBe(true);
    expect(isFreePeopleAntiBot(200, "<html>" + "product".repeat(400) + "</html>")).toBe(false);
  });
});
