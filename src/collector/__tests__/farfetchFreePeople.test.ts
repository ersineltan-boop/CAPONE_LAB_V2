import { describe, expect, it } from "vitest";

import {
  farfetchImageUrl,
  farfetchJsonLdToProduct,
  parseFarfetchItemList,
} from "../farfetch";
import { isFreePeopleAntiBot } from "../freePeople";

const FARFETCH_HTML = `
<script type="application/ld+json">{"@context":"https://schema.org","@type":"ItemList","numberOfItems":2,"itemListElement":[{"@type":"Product","name":"Teju 85 leather mules","image":["https://cdn-images.farfetch-contents.com/30/95/87/31/30958731_60261410_480.jpg"],"brand":{"@type":"Brand","name":"Paris Texas"},"offers":{"@type":"Offer","url":"/uk/shopping/women/paris-texas-teju-85-leather-mules-item-30958731.aspx"}},{"@type":"Product","name":"Leather tote","image":["https://cdn-images.farfetch-contents.com/x_480.jpg"],"brand":{"name":"The Row"},"offers":{"url":"/uk/shopping/women/the-row-leather-tote-item-1.aspx"}}]}</script>
`;

describe("Farfetch marketplace JSON-LD collector", () => {
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
});

describe("Free People marketplace blocker", () => {
  it("treats Akamai 403 interstitials as anti-bot", () => {
    expect(isFreePeopleAntiBot(403, '<html><div id="cmsg"></div></html>')).toBe(true);
    expect(isFreePeopleAntiBot(200, "<html>" + "product".repeat(400) + "</html>")).toBe(false);
  });
});
