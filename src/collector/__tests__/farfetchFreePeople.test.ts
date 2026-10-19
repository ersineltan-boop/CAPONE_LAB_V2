import { describe, expect, it } from "vitest";

import {
  farfetchImageUrl,
  farfetchJsonLdToProduct,
  parseFarfetchItemList,
  parseFarfetchCatalogPagination,
} from "../farfetch";
import { isFreePeopleAntiBot } from "../freePeople";
import {evaluateStoredPilotProduct} from '../footwearGate';

const FARFETCH_HTML = `
<script type="application/ld+json">{"@context":"https://schema.org","@type":"ItemList","numberOfItems":2,"itemListElement":[{"@type":"Product","name":"Teju 85 leather mules","image":["https://cdn-images.farfetch-contents.com/30/95/87/31/30958731_60261410_480.jpg"],"brand":{"@type":"Brand","name":"Paris Texas"},"offers":{"@type":"Offer","url":"/uk/shopping/women/paris-texas-teju-85-leather-mules-item-30958731.aspx"}},{"@type":"Product","name":"Leather tote","image":["https://cdn-images.farfetch-contents.com/x_480.jpg"],"brand":{"name":"The Row"},"offers":{"url":"/uk/shopping/women/the-row-leather-tote-item-1.aspx"}}]}</script>
`;

describe("Farfetch marketplace JSON-LD collector", () => {
  it('retains source-listed boot construction details without admitting bags, pouches or clothing', () => {
    const listing='https://www.farfetch.com/uk/shopping/women/boots-1/items.aspx';
    for(const [name,brand,slug] of [
      ['Monolith leather and Re-nylon boots with pouch','Prada','prada-monolith-leather-and-re-nylon-boots-with-pouch-item-17303590'],
      ['mesh fabric and brushed leather booties with pouch','Prada','prada-mesh-fabric-and-brushed-leather-booties-with-pouch-item-33075116'],
      ['40mm pouch boots','Prada','prada-40mm-pouch-boots-item-28538715'],
      ['Classic Sweater Letter boots','UGG','ugg-classic-sweater-letter-boots-item-27668045'],
      ['quilted bag detail pin heel short boots','Maison Mihara Yasuhiro','maison-mihara-yasuhiro-quilted-bag-detail-pin-heel-short-boots-item-32566851'],
    ]) {
      const item={name,brand:{name:brand},offers:{url:`/uk/shopping/women/${slug}.aspx`}};
      const product=farfetchJsonLdToProduct(item,listing,'2026-10-19T14:52:00Z');
      expect(product?.category).toBe('BOOT');
      expect(product?.productName).toBe(name);
      expect(evaluateStoredPilotProduct(product!).decision).toBe('ACCEPT_FOOTWEAR');
      expect(farfetchJsonLdToProduct(item,listing.replace('boots-1','shoes-1'),'2026-10-19T14:52:00Z')).toBeNull();
      for(const title of ['boots-print pouch','boots with pouch tote bag','pouch leather boots with pouch','boots and leather pouch',
        'boots-print sweater','pouch quilted bag detail boots','bag quilted bag detail boots','sweater quilted bag detail boots']) {
        const offers={url:`/uk/shopping/women/prada-${title.replaceAll(' ','-')}-item-2.aspx`};
        expect(farfetchJsonLdToProduct({...item,name:title,offers},listing,'2026-10-19T14:52:00Z')).toBeNull();
      }
    }
  });
  it('uses exact official trainer and ballerina scopes for opaque style names while retaining explicit silhouettes', () => {
    const item={name:'Uma',brand:{name:'Test'},offers:{url:'/uk/shopping/women/test-uma-item-1.aspx'}};
    for(const [scope,category] of [['trainers','SNEAKER'],['ballerinas','BALLERINA']]) {
      const listing=`https://www.farfetch.com/uk/shopping/women/${scope}-1/items.aspx`;
      expect(farfetchJsonLdToProduct(item,listing,'2026-10-19T13:00:00Z')?.category).toBe(category);
      expect(farfetchJsonLdToProduct({...item,name:'leather boot'},listing,'2026-10-19T13:00:00Z')?.category).toBe('BOOT');
    }
    expect(farfetchJsonLdToProduct(item,'https://www.farfetch.com/uk/shopping/women/shoes-1/items.aspx','2026-10-19T13:00:00Z')?.category).toBe('OTHER_FOOTWEAR');
  });
  it('distinguishes bag-shaped pump ornaments from an actual bag', () => {
    const listing='https://www.farfetch.com/uk/shopping/women/pumps-1/items.aspx';
    const item={name:'Sicily bag-embellished pointed-toe pumps',brand:{name:'Dolce & Gabbana'},
      offers:{url:'/uk/shopping/women/dolce-gabbana-sicily-bag-embellished-pointed-toe-pumps-item-39036642.aspx'}};
    expect(farfetchJsonLdToProduct(item,listing,'2026-10-19T13:00:00Z')?.category).toBe('PUMP');
    for(const name of ['Sicily pump-embellished bag','bag-embellished pumps tote bag','leather bag and bag-embellished pumps']) {
      expect(farfetchJsonLdToProduct({...item,name},listing,'2026-10-19T13:00:00Z')).toBeNull();
    }
  });
  it('does not use a brand name in the source URL as clothing evidence', () => {
    const listing='https://www.farfetch.com/uk/shopping/women/sandals-1/items.aspx';
    const url='/uk/shopping/women/karl-lagerfeld-jeans-waverly-double-strap-wedges-item-35092767.aspx';
    const item={name:'waverly double-strap wedges',brand:{name:'Karl Lagerfeld Jeans'},offers:{url}};
    const product=farfetchJsonLdToProduct(item,listing,'2026-10-19T13:00:00Z');
    expect(product?.category).toBe('WEDGE');
    expect(product?.brand).toBe('Karl Lagerfeld Jeans');
    expect(product?.productUrl).toBe(`https://www.farfetch.com${url}`);
    expect(farfetchJsonLdToProduct({...item,name:'leather jeans',offers:{url:'/uk/shopping/women/karl-lagerfeld-jeans-leather-jeans-item-1.aspx'}},listing,'2026-10-19T13:00:00Z')).toBeNull();
    expect(farfetchJsonLdToProduct({...item,name:'Waverly tote bag'},listing,'2026-10-19T13:00:00Z')).toBeNull();
    expect(farfetchJsonLdToProduct({name:'Baguette slides',brand:{name:'Fendi'},
      offers:{url:'/uk/shopping/women/fendi-baguette-slides-item-29476258.aspx'}},listing,'2026-10-19T13:00:00Z')?.category).toBe('SANDAL');
  });
  it('keeps source-listed Lipstick loafers while rejecting actual cosmetics and bags', () => {
    const listing='https://www.farfetch.com/uk/shopping/women/loafers-1/items.aspx';
    const item={name:'Lipstick V.2 loafers',brand:{name:'Henderson Baracco'},
      offers:{url:'/uk/shopping/women/henderson-baracco-lipstick-v2-loafers-item-27073292.aspx'}};
    const product=farfetchJsonLdToProduct(item,listing,'2026-10-19T13:00:00Z')!;
    expect(product.category).toBe('LOAFER');
    expect(evaluateStoredPilotProduct(product).decision).toBe('ACCEPT_FOOTWEAR');
    expect(evaluateStoredPilotProduct({...product,sourceCategoryUrl:'https://unverified.example/loafers'}).decision).toBe('EXCLUDE_NON_FOOTWEAR');
    expect(evaluateStoredPilotProduct({...product,productName:'Loafers-print lipstick'}).decision).toBe('EXCLUDE_NON_FOOTWEAR');
    for(const name of ['Lipstick','Loafers-print lipstick','Lipstick loafers tote bag']) {
      const offers={url:`/uk/shopping/women/test-${name.replaceAll(' ','-')}-item-2.aspx`};
      expect(farfetchJsonLdToProduct({...item,name,offers},listing,'2026-10-19T13:00:00Z')).toBeNull();
    }
  });
  it('keeps source-listed ring ballerinas and Lipstick ballet flats without admitting a ballerina ring', () => {
    const listing='https://www.farfetch.com/uk/shopping/women/ballerinas-1/items.aspx';
    for(const [name,brand,url] of [
      ['ring ballerinas','Jil Sander','/uk/shopping/women/jil-sander-ring-ballerinas-item-32486201.aspx'],
      ['Lipstick pointed-toe leather ballet flats','Babu Milano','/uk/shopping/women/babu-milano-lipstick-pointed-toe-leather-ballet-flats-item-39397978.aspx'],
    ]) {
      const product=farfetchJsonLdToProduct({name,brand:{name:brand},offers:{url}},listing,'2026-10-19T13:00:00Z');
      expect(product?.category).toBe('BALLERINA');
    }
    const ring={name:'ballerina ring',brand:{name:'Test'},offers:{url:'/uk/shopping/women/test-ballerina-ring-item-2.aspx'}};
    expect(farfetchJsonLdToProduct(ring,listing,'2026-10-19T13:00:00Z')).toBeNull();
  });
  it('reads the source ItemList inside JSON-LD @graph without treating breadcrumbs as products', () => {
    const products=parseFarfetchItemList(FARFETCH_HTML);
    const graph={"@context":"https://schema.org","@graph":[
      {"@type":"CollectionPage",mainEntity:{"@id":"#catalog"}},
      {"@type":"ItemList","@id":"#catalog",numberOfItems:products.length,itemListElement:products},
    ]};
    const breadcrumb={"@type":"BreadcrumbList",itemListElement:[{name:'Shoes'}]};
    const html=`<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script><script type="application/ld+json">${JSON.stringify(graph)}</script>`;
    expect(parseFarfetchItemList(html)).toEqual(products);
    expect(parseFarfetchItemList(`<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>`)).toEqual([]);
  });
  it('keeps source-listed flip-flops with clothing or accessory words in the style name', () => {
    const listing='https://www.farfetch.com/uk/shopping/women/flip-flops-slides-1/items.aspx';
    for (const [name, brand, slug] of [
      ['X Kidsuper Top Camo flip-flops','Havaianas','havaianas-x-kidsuper-top-camo-flip-flops-item-39058882'],
      ['belt flip flops','Coperni','coperni-belt-flip-flops-item-33883777'],
    ]) {
      const item={name,brand:{name},image:['https://cdn-images.farfetch-contents.com/a_480.jpg'],
        offers:{url:`/uk/shopping/women/${slug}.aspx`}};
      const product=farfetchJsonLdToProduct(item,listing,'2026-10-14T13:00:00Z');
      expect(product?.category).toBe('THONG');
      expect(product?.sourceCategoryUrl).toBe(listing);
    }
    for (const [name, slug] of [
      ['Kidsuper camo top','kidsuper-camo-top-item-1'],
      ['Coperni leather belt','coperni-leather-belt-item-2'],
    ]) {
      expect(farfetchJsonLdToProduct({name,brand:{name:'Test'},offers:{url:`/uk/shopping/women/${slug}.aspx`}},listing,'2026-10-14T13:00:00Z')).toBeNull();
    }
  });
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
