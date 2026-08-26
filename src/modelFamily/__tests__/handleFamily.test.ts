import { describe, expect, it } from "vitest";

import { handleFamiliesCompatible, shopifyHandleFamilyKey } from "../handleFamily";
import { buildModelFamilies } from "../buildFamilies";
import type { RawAnalyzedProduct } from "../types";

function product(
  overrides: Partial<RawAnalyzedProduct> & {
    brand: string;
    productUrl: string;
    productName: string;
  },
): RawAnalyzedProduct {
  return {
    source: "aeyde",
    category: "SANDAL",
    color: "Black",
    material: "Leather",
    imageUrl: "https://example.com/a.jpg",
    discoveredAt: "2026-08-18T10:00:00.000Z",
    cleaned: { color: "Black", heelHeight: null },
    normalized: {
      category: "SANDAL",
      colorFamily: "BLACK",
      materialFamily: "LEATHER",
      heelType: "FLAT",
      heelHeightGroup: "FLAT",
      toeShape: "UNKNOWN",
      details: [],
      construction: ["OPEN_TOE"],
    },
    ...overrides,
  };
}

describe("shopify handle family", () => {
  it("collapses AEYDE color/material suffixes to the model stem", () => {
    expect(shopifyHandleFamilyKey("https://www.aeyde.com/products/dex-black-nappa")).toBe("dex");
    expect(shopifyHandleFamilyKey("https://www.aeyde.com/products/dex-moka-nappa")).toBe("dex");
    expect(
      handleFamiliesCompatible(
        "https://www.aeyde.com/products/dex-black-nappa",
        "https://www.aeyde.com/products/dex-moka-nappa",
      ),
    ).toBe(true);
  });

  it("does not treat generic sandal handles as a family", () => {
    expect(shopifyHandleFamilyKey("https://www.aeyde.com/products/sandal-black")).toBeNull();
  });

  it("does not collapse construction variants such as satin or cracked", () => {
    expect(
      handleFamiliesCompatible(
        "https://aliasmae.com.au/products/lana",
        "https://aliasmae.com.au/products/lana-satin",
      ),
    ).toBe(false);
  });

  it("collapses creamy/glass/moss color suffixes and dk shade tokens", () => {
    expect(shopifyHandleFamilyKey("https://www.aeyde.com/products/ellie-creamy-snake")).toBe("ellie");
    expect(shopifyHandleFamilyKey("https://www.aeyde.com/products/ellie-glass-nappa")).toBe("ellie");
    expect(shopifyHandleFamilyKey("https://www.aeyde.com/products/ellie-moss-mini-snake")).toBe("ellie");
    expect(
      shopifyHandleFamilyKey("https://dolcevita.com/products/cornel-flats-dk-brown-suede"),
    ).toBe("cornel");
    expect(
      handleFamiliesCompatible(
        "https://dolcevita.com/products/cornel-flats-black-leather",
        "https://dolcevita.com/products/cornel-flats-dk-brown-suede",
      ),
    ).toBe(true);
  });

  it("does not merge different silhouettes that only share a handle stem", () => {
    const { families } = buildModelFamilies([
      product({
        brand: "AEYDE",
        productName: "Elise Square-Toe Sandals",
        productUrl: "https://www.aeyde.com/products/elise-black-nappa",
      }),
      product({
        brand: "AEYDE",
        productName: "Elise Leather Toe-Post Sandals",
        productUrl: "https://www.aeyde.com/products/elise-creamy-nappa",
        color: "Creamy",
        cleaned: { color: "Creamy", heelHeight: null },
      }),
    ]);
    expect(families).toHaveLength(2);
  });
});
