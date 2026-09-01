import { describe, expect, it } from "vitest";

import {
  constructionsCompatible,
  constructionsCompatibleForVerifiedStyle,
  isWoodColorwaySlugNoise,
  productConstructionKey,
} from "../constructionSignature";
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

  it("keeps SCHUTZ Keefa High Block style colorways together despite title mid/high heel-height slug noise", () => {
    const metallic = product(
      "Keefa Raffia High Block Sandal",
      "https://schutz-shoes.com/products/keefa-raffia-high-block-metallic-sandal-u26-heel-height-mid-s2118901050003",
    );
    metallic.normalized.heelHeightGroup = "HIGH";
    metallic.normalized.heelType = "BLOCK";
    const leather = product(
      "Keefa Raffia High Block Sandal",
      "https://schutz-shoes.com/products/keefa-raffia-high-block-leather-sandal-u26-heel-height-mid-s2118901050001",
    );
    leather.normalized.heelHeightGroup = "HIGH";
    leather.normalized.heelType = "BLOCK";

    expect(constructionsCompatible(metallic, leather)).toBe(true);
    expect(productConstructionKey(metallic)).toBe(productConstructionKey(leather));
    expect(productConstructionKey(metallic).split("+")).not.toContain("high");
    expect(productConstructionKey(metallic).split("+")).toContain("mid");
  });

  it("still separates genuine mid vs high heel constructions when heel-height slugs disagree", () => {
    const mid = product(
      "Keefa Mid Block Sandal",
      "https://schutz-shoes.com/products/keefa-mid-block-sandal-heel-height-mid-s2117701050001",
    );
    const high = product(
      "Keefa High Block Sandal",
      "https://schutz-shoes.com/products/keefa-high-block-sandal-heel-height-high-s2118901050001",
    );
    expect(constructionsCompatible(mid, high)).toBe(false);
  });

  it("still separates title-only mid vs high when no heel-height slug is present", () => {
    expect(
      constructionsCompatible(
        product("Keefa Mid Block Sandal", "https://example.com/products/keefa-mid-block-sandal"),
        product("Keefa High Block Sandal", "https://example.com/products/keefa-high-block-sandal"),
      ),
    ).toBe(false);
  });

  it("ignores trailing Wood colorway slug on verified-style merges only", () => {
    const wood = product(
      "Ariella Leather Sandal",
      "https://schutz-shoes.com/products/ariella-o99-high-heel-sandal-leather-vinyl-wood",
    );
    wood.color = "Wood";
    wood.cleaned = { color: "Wood", heelHeight: null };
    wood.normalized.heelHeightGroup = "HIGH";
    wood.normalized.heelType = "STILETTO";

    const black = product(
      "Ariella Sandal",
      "https://schutz-shoes.com/products/ariella-099-high-heel-sandal-vinyl",
    );
    black.normalized.heelHeightGroup = "HIGH";
    black.normalized.heelType = "STILETTO";

    expect(isWoodColorwaySlugNoise(wood)).toBe(true);
    expect(isWoodColorwaySlugNoise(black)).toBe(false);
    expect(constructionsCompatible(wood, black)).toBe(false);
    expect(constructionsCompatibleForVerifiedStyle(wood, black)).toBe(true);
  });

  it("still blocks verified-style merge for structural x-wood construction", () => {
    const xWood = product(
      "Keefa X-Wood Platform Sandal",
      "https://schutz-shoes.com/products/keefa-x-wood-platform-sandal-s26-heel-height-high-s2034600030368",
    );
    xWood.color = "Wood";
    xWood.cleaned = { color: "Wood", heelHeight: null };
    xWood.normalized.heelHeightGroup = "HIGH";
    xWood.normalized.heelType = "PLATFORM";

    const leather = product(
      "Keefa Sandal",
      "https://schutz-shoes.com/products/keefa-sandal-p26-heel-height-high-s2034600030378",
    );
    leather.normalized.heelHeightGroup = "HIGH";
    leather.normalized.heelType = "STILETTO";

    expect(isWoodColorwaySlugNoise(xWood)).toBe(false);
    expect(constructionsCompatibleForVerifiedStyle(xWood, leather)).toBe(false);
  });
});
