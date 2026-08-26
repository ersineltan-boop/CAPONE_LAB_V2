import { describe, expect, it } from "vitest";

import { constructionsCompatible } from "../constructionSignature";
import type { RawAnalyzedProduct } from "../types";

function product(name: string, url = "https://example.com/p"): RawAnalyzedProduct {
  return {
    source: "test",
    brand: "TEST",
    productName: name,
    productUrl: url,
    category: "PUMP",
    color: null,
    material: null,
    imageUrl: null,
    discoveredAt: "2026-08-18T10:00:00.000Z",
    cleaned: { color: null, heelHeight: null },
    normalized: {
      category: "PUMP",
      colorFamily: "UNKNOWN",
      materialFamily: "UNKNOWN",
      heelType: "UNKNOWN",
      heelHeightGroup: "UNKNOWN",
      toeShape: "UNKNOWN",
      details: [],
      construction: [],
    },
  };
}

describe("construction signature", () => {
  it("allows leather vs suede colorways", () => {
    expect(
      constructionsCompatible(product("Julie Leather Pump"), product("Julie Suede Pump")),
    ).toBe(true);
  });

  it("rejects mesh vs leather", () => {
    expect(
      constructionsCompatible(
        product("Relan Ballet Flats Gold Distressed Leather"),
        product("Relan Mesh Ballet Flats Chili Mesh"),
      ),
    ).toBe(false);
  });

  it("rejects slingback vs closed pump", () => {
    expect(
      constructionsCompatible(product("Lexi Sling Leather Pump"), product("Lexi Leather Pump")),
    ).toBe(false);
  });

  it("allows jelly colorways named Clear without treating them as lucite construction", () => {
    expect(
      constructionsCompatible(
        product("Homeria Jelly Sandal Clear"),
        product("Homeria Jelly Sandal Black"),
      ),
    ).toBe(true);
  });

  it("allows embroidered fabric colorways on the same ballet model", () => {
    expect(
      constructionsCompatible(
        product("Verona Ballet Flat Deep Olivine Suede"),
        product("Verona Ballet Flat In White Striped Fabric and Lobster Embroidery"),
      ),
    ).toBe(true);
  });

  it("rejects French résille mesh from leather colorways", () => {
    expect(
      constructionsCompatible(
        product("Kina - Escarpins babies résille et cuir noir"),
        product("Kina - Escarpins babies cuir verni noir"),
      ),
    ).toBe(false);
  });

  it("rejects lace-up construction from non-lace flats", () => {
    expect(
      constructionsCompatible(
        product("Jean Taupe Leather Flats", "https://example.com/products/jean-taupe-leather-lace-up-flats"),
        product("Jean Black Leather Flats", "https://example.com/products/jean-black-leather-flats"),
      ),
    ).toBe(false);
  });

  it("rejects braided/tressé leather from smooth leather colorways", () => {
    expect(
      constructionsCompatible(
        product("Ariana - Ballerines babies cuir tressé platine"),
        product("Ariana - Ballerines babies cuir verni leopard"),
      ),
    ).toBe(false);
  });

  it("allows matching braided colorways together", () => {
    expect(
      constructionsCompatible(
        product("Cassis - Ballerines cuir tressé marron"),
        product("Cassis - Ballerines cuir tressé argenté"),
      ),
    ).toBe(true);
  });

  it("does not treat mule PDP sandal-handle noise as a sandal silhouette", () => {
    expect(
      constructionsCompatible(
        product(
          "Maureen 100 Orange & Pink Embossed Leather Heeled Mules",
          "https://example.com/products/maureen-100-orange-embossed-leather-heeled-sandals",
        ),
        product(
          "Maureen 100 Blush Leather Mules",
          "https://example.com/products/maureen-100mm-nude-leather-mules",
        ),
      ),
    ).toBe(true);
  });

  it("does not treat BLOCK heel-type alone as raised when height is unknown", () => {
    const flat = product("Prudence Leather Ballet Flat");
    flat.normalized.heelType = "FLAT";
    const blockUnknown = product("Prudence Leather Ballet Flat");
    blockUnknown.normalized.heelType = "BLOCK";
    blockUnknown.normalized.heelHeightGroup = "UNKNOWN";
    expect(constructionsCompatible(flat, blockUnknown)).toBe(true);
  });
});
