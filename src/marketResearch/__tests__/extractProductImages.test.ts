import { describe, expect, it } from "vitest";

import { extractMarketResearchProductImages, matchModelToken } from "../extractProductImages";

describe("extractMarketResearchProductImages", () => {
  it("keeps Magento product gallery images and drops logos", () => {
    const html = `
      <div id="gallery-placeholder-desktop">
        <a href="https://cdn.otter.ro/media/catalog/product/cache/7eb369f27775f2db92648609527c34e5/8/6/867586d4eec5caaac12932bfea7e08777f3521927e3f58df9a3f52d954ae6558.jpeg"></a>
        <img src="https://cdn.otter.ro/media/logo/stores/3/gryxx_logo.png" />
      </div>
    `;
    expect(extractMarketResearchProductImages(html, "https://www.gryxx.ro/product")).toEqual([
      "https://cdn.otter.ro/media/catalog/product/cache/7eb369f27775f2db92648609527c34e5/8/6/867586d4eec5caaac12932bfea7e08777f3521927e3f58df9a3f52d954ae6558.jpeg",
    ]);
  });

  it("does not treat TESS I as TESS", () => {
    expect(matchModelToken("Pantofi cu toc femei TESS Crem", "TESS")).toBe(true);
    expect(matchModelToken("Pantofi cu toc femei TESS I Cognac", "TESS I")).toBe(true);
  });
});
