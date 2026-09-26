import { describe, expect, it } from "vitest";

import {
  isTheWebsterExcludedBrand,
  parseTheWebsterSourceTotal,
  theWebsterRawProductToPilot,
} from "../theWebster";

describe("The Webster marketplace collector", () => {
  it("reads the official source total", () => {
    expect(parseTheWebsterSourceTotal("<div>Filter & Sort - 246 Products</div>")).toBe(246);
    expect(parseTheWebsterSourceTotal("<span>2,781 Results</span>")).toBe(2781);
  });

  it("excludes fast and technical sneaker brands", () => {
    expect(isTheWebsterExcludedBrand("Nike")).toBe(true);
    expect(isTheWebsterExcludedBrand("Salomon")).toBe(true);
    expect(isTheWebsterExcludedBrand("On Running")).toBe(true);
    expect(isTheWebsterExcludedBrand("Alaia")).toBe(false);
  });

  it("preserves the product brand and never marks the baseline as new", () => {
    const product = theWebsterRawProductToPilot(
      {
        id: 1,
        title: "Le Coeur Slingback Pumps",
        handle: "le-coeur-slingback-pumps-black",
        vendor: "Alaia",
        product_type: "Shoes",
        tags: ["women", "pumps"],
        images: [
          { src: "https://cdn.shopify.com/s/files/1/0000/products/pump_01.jpg?v=1" },
          { src: "https://cdn.shopify.com/s/files/1/0000/products/pump_02.jpg?v=1" },
        ],
        variants: [{ title: "IT 38", sku: "ALAIA-38" }],
      },
      "2026-09-26T10:00:00.000Z",
    );

    expect(product).not.toBeNull();
    expect(product?.source).toBe("the-webster");
    expect(product?.brand).toBe("Alaia");
    expect(product?.images).toHaveLength(2);
    expect(product?.isNewArrivalsCollection).toBe(false);
    expect(product?.hasNewBadge).toBe(false);
  });
});
