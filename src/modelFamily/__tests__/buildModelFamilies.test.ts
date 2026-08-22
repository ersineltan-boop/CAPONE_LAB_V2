import { describe, expect, it } from "vitest";
import { buildModelFamilies } from "../buildModelFamilies";
import { normalizeModelName } from "../normalizeModelName";
import { extractBaseSku } from "../extractStyleCode";
import type { RawAnalyzedProduct } from "../types";

function product(
  overrides: Partial<RawAnalyzedProduct> & {
    brand: string;
    productUrl: string;
    productName: string;
  },
): RawAnalyzedProduct {
  return {
    source: "test",
    category: "PUMP",
    color: "Black",
    material: "Leather",
    imageUrl: "https://example.com/a.jpg",
    discoveredAt: "2026-08-18T10:00:00.000Z",
    cleaned: { color: "Black", heelHeight: null },
    normalized: {
      category: "PUMP",
      colorFamily: "BLACK",
      materialFamily: "LEATHER",
      heelType: "STILETTO",
      heelHeightGroup: "HIGH",
      toeShape: "POINTED",
      details: ["BUCKLE"],
      construction: ["CLOSED_TOE"],
    },
    ...overrides,
  };
}

describe("normalizeModelName", () => {
  it("strips color and material tokens from product names", () => {
    expect(normalizeModelName("Julie Suede Pump")).toBe("julie pump");
    expect(normalizeModelName("Teddy Heel - Ecru")).toBe("teddy heel");
  });

  it("removes trailing color tokens after category keywords", () => {
    expect(
      normalizeModelName("Stella Sneaker Teal Suede", { color: "Teal" }),
    ).toBe("stella sneaker");
    expect(
      normalizeModelName("Verona Ballet Flat Deep Olivine Suede", {
        color: "Deep olivine",
      }),
    ).toBe("verona ballet flat");
    expect(
      normalizeModelName("Pavlova Ballet Flat Puff Cream Leather", {
        color: "Puff Cream",
      }),
    ).toBe("pavlova ballet flat");
  });
});

describe("extractBaseSku", () => {
  it("derives shared style code from schutz skus", () => {
    expect(extractBaseSku("S2217900140013")).toBe("S221790014");
    expect(extractBaseSku("S2217900140008")).toBe("S221790014");
  });

  it("derives shared Larroude model code across color variants", () => {
    expect(extractBaseSku("L415-STEL-5.0-TEAL-3054")).toBe("L415-STEL");
    expect(extractBaseSku("L415-STEL-8.0-OYST-3056")).toBe("L415-STEL");
    expect(extractBaseSku("L422-VERO-5.0-DEEP-3064")).toBe("L422-VERO");
    expect(extractBaseSku("L422-PAVL-5.0-SEAW-3069")).toBe("L422-PAVL");
  });

  it("derives shared Paris Texas style across color SKUs", () => {
    expect(extractBaseSku("PX2027XNPPSCREAM_35")).toBe("PX2027XNPPS");
    expect(extractBaseSku("PX2027XNPPSBORGOGNA_35")).toBe("PX2027XNPPS");
    expect(extractBaseSku("PX2030XV003TUNDRA_35")).toBe("PX2030XV003");
    expect(extractBaseSku("PX2030XV003EBANO_35")).not.toBe(extractBaseSku("PX2027XV003TUNDRA_35"));
  });
});

describe("buildModelFamilies", () => {
  it("groups same brand + same model + different color into one family", () => {
    const products = [
      product({
        brand: "SCHUTZ",
        productName: "Julie Suede Pump",
        productUrl: "https://x/1",
        variants: [{ sku: "S2217900140013", color: "Brown" }],
        normalized: {
          category: "PUMP",
          colorFamily: "BROWN",
          materialFamily: "SUEDE",
          heelType: "STILETTO",
          heelHeightGroup: "MID",
          toeShape: "POINTED",
          details: [],
          construction: ["BACKLESS"],
        },
      }),
      product({
        brand: "SCHUTZ",
        productName: "Julie Suede Pump",
        productUrl: "https://x/2",
        color: "Black",
        cleaned: { color: "Black", heelHeight: null },
        variants: [{ sku: "S2217900140008", color: "Black" }],
        normalized: {
          category: "PUMP",
          colorFamily: "BLACK",
          materialFamily: "SUEDE",
          heelType: "STILETTO",
          heelHeightGroup: "MID",
          toeShape: "POINTED",
          details: [],
          construction: ["BACKLESS"],
        },
      }),
    ];

    const { families } = buildModelFamilies(products);
    expect(families).toHaveLength(1);
    expect(families[0]?.variantCount).toBe(2);
    expect(families[0]?.groupingConfidence).toBe("HIGH");
  });

  it("groups same brand + same model + different material into one family", () => {
    const base = {
      brand: "BRAND A",
      productName: "Lyra Sandal",
      normalized: {
        category: "MULE" as const,
        colorFamily: "BLACK",
        materialFamily: "LEATHER",
        heelType: "STILETTO",
        heelHeightGroup: "HIGH",
        toeShape: "ROUND",
        details: ["BUCKLE"],
        construction: ["BACKLESS", "CLOSED_TOE"],
      },
    };

    const { families } = buildModelFamilies([
      product({
        ...base,
        productUrl: "https://x/1",
        variants: [{ sku: "S2208700750004" }],
      }),
      product({
        ...base,
        productUrl: "https://x/2",
        productName: "Lyra Patent Leather Sandal",
        material: "Patent Leather",
        variants: [{ sku: "S2208700750001" }],
        normalized: {
          ...base.normalized,
          materialFamily: "PATENT",
        },
      }),
    ]);

    expect(families).toHaveLength(1);
    expect(families[0]?.variantCount).toBe(2);
  });

  it("keeps similar names separate when construction differs", () => {
    const { families } = buildModelFamilies([
      product({
        brand: "BRAND A",
        productName: "Aria Pump",
        productUrl: "https://x/1",
        normalized: {
          category: "PUMP",
          colorFamily: "BLACK",
          materialFamily: "LEATHER",
          heelType: "STILETTO",
          heelHeightGroup: "HIGH",
          toeShape: "POINTED",
          details: [],
          construction: ["SLINGBACK"],
        },
      }),
      product({
        brand: "BRAND A",
        productName: "Aria Pump",
        productUrl: "https://x/2",
        normalized: {
          category: "PUMP",
          colorFamily: "BLACK",
          materialFamily: "LEATHER",
          heelType: "STILETTO",
          heelHeightGroup: "HIGH",
          toeShape: "POINTED",
          details: [],
          construction: ["CLOSED_TOE"],
        },
      }),
    ]);

    expect(families).toHaveLength(2);
  });

  it("never groups same model name across different brands", () => {
    const shared = {
      productName: "Classic Loafer",
      normalized: {
        category: "LOAFER" as const,
        colorFamily: "BLACK",
        materialFamily: "LEATHER",
        heelType: "FLAT",
        heelHeightGroup: "FLAT",
        toeShape: "ROUND",
        details: [],
        construction: ["CLOSED_TOE"],
      },
    };

    const { families } = buildModelFamilies([
      product({ ...shared, brand: "BRAND A", productUrl: "https://x/1" }),
      product({ ...shared, brand: "BRAND B", productUrl: "https://x/2" }),
    ]);

    expect(families).toHaveLength(2);
    expect(families.every((family) => family.variantCount === 1)).toBe(true);
  });

  it("keeps all variants accessible after grouping", () => {
    const products = [
      product({ brand: "A", productName: "Model One", productUrl: "https://x/1" }),
      product({ brand: "A", productName: "Model One", productUrl: "https://x/2", color: "Red", cleaned: { color: "Red", heelHeight: null } }),
    ];

    const { families } = buildModelFamilies(products);
    const family = families[0]!;
    expect(family.sourceProductIds).toEqual(
      expect.arrayContaining(["https://x/1", "https://x/2"]),
    );
    expect(family.variants.map((variant) => variant.productId)).toEqual(
      expect.arrayContaining(["https://x/1", "https://x/2"]),
    );
  });

  it("groups Larroude color variants into one family via style code", () => {
    const sneaker = {
      brand: "LARROUDE",
      category: "SNEAKER" as const,
      normalized: {
        category: "SNEAKER" as const,
        colorFamily: "GREEN",
        materialFamily: "SUEDE",
        heelType: "OTHER",
        heelHeightGroup: "UNKNOWN",
        toeShape: "ROUND",
        details: [],
        construction: ["LACE_UP"],
      },
    };

    const { families } = buildModelFamilies([
      product({
        ...sneaker,
        productName: "Stella Sneaker Teal Suede",
        productUrl: "https://x/stella-teal",
        color: "Teal",
        cleaned: { color: "Teal", heelHeight: null },
        variants: [{ sku: "L415-STEL-5.0-TEAL-3054", color: "Teal" }],
      }),
      product({
        ...sneaker,
        productName: "Stella Sneaker Tulip Suede",
        productUrl: "https://x/stella-tulip",
        color: "Tulip",
        cleaned: { color: "Tulip", heelHeight: null },
        normalized: {
          ...sneaker.normalized,
          colorFamily: "PINK",
        },
        variants: [{ sku: "L415-STEL-5.0-TULIP-3055", color: "Tulip" }],
      }),
    ]);

    expect(families).toHaveLength(1);
    expect(families[0]?.canonicalName).toBe("Stella Sneaker");
    expect(families[0]?.variantCount).toBe(2);
    expect(families[0]?.groupingConfidence).toBe("HIGH");
  });

  it("uses representative product gallery only for carousel images", () => {
    const galleries = {
      "https://x/1": [
        "https://cdn.example.com/black-hero.jpg",
        "https://cdn.example.com/black-side.jpg",
      ],
      "https://x/2": [
        "https://cdn.example.com/bordo-hero.jpg",
        "https://cdn.example.com/bordo-side.jpg",
      ],
    };

    const { families } = buildModelFamilies(
      [
        product({
          brand: "SCHUTZ",
          productName: "Julie Pump",
          productUrl: "https://x/1",
          imageUrl: "https://cdn.example.com/black-hero.jpg",
        }),
        product({
          brand: "SCHUTZ",
          productName: "Julie Pump",
          productUrl: "https://x/2",
          imageUrl: "https://cdn.example.com/bordo-hero.jpg",
          color: "Bordo",
          cleaned: { color: "Bordo", heelHeight: null },
        }),
      ],
      { productImageGalleries: galleries },
    );

    const family = families[0]!;
    expect(family.representativeImages).toEqual([
      "https://cdn.example.com/black-hero.jpg",
      "https://cdn.example.com/black-side.jpg",
    ]);
    expect(family.representativeImages).not.toContain(
      "https://cdn.example.com/bordo-side.jpg",
    );
  });
});
