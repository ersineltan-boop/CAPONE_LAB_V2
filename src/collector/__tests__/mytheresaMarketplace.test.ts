import { describe, expect, it } from "vitest";

import { detectMytheresaHttpBlock, extractProductsFromHtml, isBotChallengePage } from "../mytheresa";
import { parseMytheresaRenderedHtml } from "../mytheresaBrowser";
import { parseMarketplaceListingHtml } from "../marketplaceHtml";
import {
  countProductLinks,
  isAntiBotHtml,
  selectSuccessfulPilot,
  type MarketplaceProbeResult,
} from "../../registry/marketplaceProbe";
import { selectActiveMarketplaceEntries } from "../../registry/data/marketplaces";

const FIXTURE_HTML = `
<html><body>
<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"products":[{"url":"/us/en/women/shoes/p/alaia-sandal","name":"Le Coeur sandal","designer":"Alaïa","images":["https://img.mytheresa.com/a.jpg"]}]}}}</script>
<a href="/us/en/women/shoes/p/other-pump">Other</a>
</body></html>
`;

const CHALLENGE_HTML = `<html><body><div id="sec-if-cpt-container"></div><div class="behavioral-content"></div></body></html>`;

describe("Mytheresa / marketplace collection", () => {
  it("detects normal HTTP anti-bot results", () => {
    expect(detectMytheresaHttpBlock({ status: 403, html: "nope" })).toBe("ANTI_BOT");
    expect(isBotChallengePage(CHALLENGE_HTML)).toBe(true);
    expect(isAntiBotHtml("captcha cloudflare", 403)).toBe(true);
  });

  it("parses rendered listing HTML without fabricating products", () => {
    const products = extractProductsFromHtml(FIXTURE_HTML);
    expect(products.some((item) => item.brand === "Alaïa")).toBe(true);
    const parsed = parseMytheresaRenderedHtml(FIXTURE_HTML, {
      categoryId: "sandals",
      categoryName: "Sandals",
      categoryPath: "/us/en/women/shoes/sandals",
      categoryUrl: "https://www.mytheresa.com/us/en/women/shoes/sandals",
    });
    expect(parsed.blocked).toBe(false);
    expect(parsed.products.length).toBeGreaterThan(0);
  });

  it("does not fabricate products from a challenge page", () => {
    const parsed = parseMytheresaRenderedHtml(CHALLENGE_HTML, {
      categoryId: "sandals",
      categoryName: "Sandals",
      categoryPath: "/us/en/women/shoes/sandals",
      categoryUrl: "https://www.mytheresa.com/us/en/women/shoes/sandals",
    });
    expect(parsed.blocked).toBe(true);
    expect(parsed.products).toEqual([]);
  });

  it("fallback selection only chooses a successfully probed candidate", () => {
    const results: MarketplaceProbeResult[] = [
      { id: "farfetch", name: "Farfetch", ok: false, status: 403, productLinkCount: 0, blocked: true },
      { id: "ssense", name: "SSENSE", ok: true, status: 200, productLinkCount: 24, blocked: false },
      { id: "24s", name: "24S", ok: true, status: 200, productLinkCount: 4, blocked: false },
    ];
    expect(selectSuccessfulPilot(results)?.id).toBe("ssense");
    expect(countProductLinks('<a href="/en-us/women/a">', /href="(\/en-us\/women\/[^"]+)"/i)).toBe(1);
  });

  it("exposes only one active marketplace pilot", () => {
    const entries = selectActiveMarketplaceEntries({
      activePilotId: "ssense",
      mytheresaStatus: "NEEDS_BROWSER_OR_ADAPTER",
    });
    const active = entries.filter((entry) => entry.isActive);
    expect(active).toHaveLength(1);
    expect(active[0]?.id).toBe("ssense");
    expect(entries.some((entry) => entry.id === "mytheresa")).toBe(true);
  });

  it("generic listing parser does not invent products from a challenge page", () => {
    const products = parseMarketplaceListingHtml(
      CHALLENGE_HTML,
      {
        id: "ssense",
        name: "SSENSE",
        footwearUrl: "https://www.ssense.com/en-us/women/shoes",
        productHrefPattern: /href="(\/en-us\/women\/[^"]+)"/i,
      },
      "ssense",
      "2026-08-21T00:00:00.000Z",
    );
    expect(products).toEqual([]);
  });
});

describe("Level Shoes slug identity", () => {
  it("derives brand and name from a source product slug", async () => {
    const { identityFromLevelShoesSlug } = await import("../marketplaceHtml");
    expect(
      identityFromLevelShoesSlug(
        "christian-louboutin-miss-z-100-mules-white-calf-leather-women-mules-hmnhhu.html",
      ),
    ).toEqual({
      brand: "Christian Louboutin",
      name: "Miss Z 100 Mules White Calf Leather",
    });
  });

  it("extracts Magento footwear category URLs without inventing them", async () => {
    const { extractMagentoFootwearCategoryUrls } = await import("../marketplaceHtml");
    const html = `
      <a href="https://www.levelshoes.com/women/shoes.html">Shoes</a>
      <a href="https://www.levelshoes.com/women/shoes/boots.html">Boots</a>
      <a href="https://www.levelshoes.com/women/shoes/sandals.html">Sandals</a>
      <a href="https://www.levelshoes.com/aquazzura-tequila-75-mules-white-leather-women-high-heels-rxyz7z.html">Product</a>
    `;
    expect(extractMagentoFootwearCategoryUrls(html, "https://www.levelshoes.com/women/shoes.html")).toEqual([
      { url: "https://www.levelshoes.com/women/shoes/boots.html", name: "Boots" },
      { url: "https://www.levelshoes.com/women/shoes/sandals.html", name: "Sandals" },
    ]);
  });
});
