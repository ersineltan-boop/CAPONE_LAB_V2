import { describe, expect, it } from "vitest";

import { buildModelFamilies } from "../buildFamilies";
import { isGenericModelTitle, hasDistinctiveModelToken } from "../genericModelTitle";
import { extractZaraProductId, extractFarfetchItemId } from "../sourceIdentity";
import { extractBaseSku } from "../styleCode";
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
      details: [],
      construction: ["CLOSED_TOE"],
    },
    ...overrides,
  };
}

describe("generic model titles", () => {
  it("treats category labels as generic and not distinctive", () => {
    for (const name of ["boot", "flat", "slingback", "heeled sandals", "ankle boot", "wedge", "mule"]) {
      expect(isGenericModelTitle(name)).toBe(true);
      expect(hasDistinctiveModelToken(name)).toBe(false);
    }
  });

  it("keeps distinctive model names", () => {
    expect(isGenericModelTitle("julie pump")).toBe(false);
    expect(hasDistinctiveModelToken("stella sneaker")).toBe(true);
    expect(hasDistinctiveModelToken("wally mule")).toBe(true);
  });
});

describe("source identity", () => {
  it("collapses Jeffrey Campbell color SKUs to the shared style", () => {
    expect(extractBaseSku("AGENT-460-6")).toBe("AGENT");
    expect(extractBaseSku("AGENT-212-6")).toBe("AGENT");
  });

  it("extracts Zara and Farfetch listing IDs", () => {
    expect(extractZaraProductId("https://www.zara.com/us/en/leather-wedge-boots-p12006810.html")).toBe(
      "12006810",
    );
    expect(extractFarfetchItemId("https://www.farfetch.com/uk/shopping/women/foo-item-18769029.aspx")).toBe(
      "18769029",
    );
  });
});

describe("false merge prevention", () => {
  it("does not merge two Zara Flats with different style IDs", () => {
    const { families } = buildModelFamilies([
      product({
        source: "zara",
        brand: "ZARA",
        productName: "Flat",
        productUrl: "https://www.zara.com/us/en/flat-p11111111.html",
        category: "BALLERINA",
        normalized: {
          category: "BALLERINA",
          colorFamily: "BLACK",
          materialFamily: "LEATHER",
          heelType: "FLAT",
          heelHeightGroup: "FLAT",
          toeShape: "ROUND",
          details: [],
          construction: ["CLOSED_TOE"],
        },
      }),
      product({
        source: "zara",
        brand: "ZARA",
        productName: "Flat",
        productUrl: "https://www.zara.com/us/en/flat-p22222222.html",
        category: "BALLERINA",
        normalized: {
          category: "BALLERINA",
          colorFamily: "BROWN",
          materialFamily: "LEATHER",
          heelType: "FLAT",
          heelHeightGroup: "FLAT",
          toeShape: "ROUND",
          details: [],
          construction: ["CLOSED_TOE"],
        },
      }),
    ]);
    expect(families).toHaveLength(2);
  });

  it("does not merge two Zara Slingbacks with different IDs", () => {
    const { families } = buildModelFamilies([
      product({
        source: "zara",
        brand: "ZARA",
        productName: "Slingback",
        productUrl: "https://www.zara.com/us/en/slingback-p10000001.html",
      }),
      product({
        source: "zara",
        brand: "ZARA",
        productName: "Slingback",
        productUrl: "https://www.zara.com/us/en/slingback-p10000002.html",
      }),
    ]);
    expect(families).toHaveLength(2);
  });

  it("merges the same explicit Zara style with different source colors", () => {
    const { families } = buildModelFamilies([
      product({
        source: "zara",
        brand: "ZARA",
        productName: "Leather Heel Shoes",
        productUrl: "https://www.zara.com/us/en/leather-heel-shoes-p11208810.html",
        color: "Black",
        cleaned: { color: "Black", heelHeight: null },
      }),
      product({
        source: "zara",
        brand: "ZARA",
        productName: "Leather Heel Shoes",
        productUrl: "https://www.zara.com/us/en/leather-heel-shoes-p11208810.html",
        color: "Burgundy",
        cleaned: { color: "Burgundy", heelHeight: null },
        normalized: {
          category: "PUMP",
          colorFamily: "RED",
          materialFamily: "LEATHER",
          heelType: "STILETTO",
          heelHeightGroup: "HIGH",
          toeShape: "POINTED",
          details: [],
          construction: ["CLOSED_TOE"],
        },
      }),
    ]);
    expect(families).toHaveLength(1);
    expect(families[0]?.variantCount).toBe(2);
    expect(families[0]?.groupingReason).toContain("styleCode:ZARA-11208810");
  });

  it("does not merge Paris Texas Boots with separate product IDs", () => {
    const boot = {
      source: "paris-texas",
      brand: "PARIS TEXAS",
      category: "BOOT" as const,
      normalized: {
        category: "BOOT" as const,
        colorFamily: "BLACK",
        materialFamily: "LEATHER",
        heelType: "STILETTO",
        heelHeightGroup: "HIGH",
        toeShape: "POINTED",
        details: [],
        construction: ["CLOSED_TOE"],
      },
    };
    const { families } = buildModelFamilies([
      product({
        ...boot,
        productName: "LEATHER BOOT",
        productUrl: "https://paristexasbrand.com/products/leather-bootpx1119xvt0cnero",
        variants: [{ sku: "PX1119XVT0CNERO_35", color: "Nero" }],
      }),
      product({
        ...boot,
        productName: "LEATHER BOOT",
        productUrl: "https://paristexasbrand.com/products/leather-bootpx9999xvt0cnero",
        variants: [{ sku: "PX9999XVT0CNERO_35", color: "Nero" }],
      }),
    ]);
    expect(families).toHaveLength(2);
  });

  it("does not merge Paris Texas Mules with separate IDs", () => {
    const mule = {
      source: "paris-texas",
      brand: "PARIS TEXAS",
      category: "MULE" as const,
      normalized: {
        category: "MULE" as const,
        colorFamily: "BLACK",
        materialFamily: "LEATHER",
        heelType: "STILETTO",
        heelHeightGroup: "HIGH",
        toeShape: "POINTED",
        details: [],
        construction: ["BACKLESS"],
      },
    };
    const { families } = buildModelFamilies([
      product({
        ...mule,
        productName: "NAPPA MULE",
        productUrl: "https://paristexasbrand.com/products/mule-a",
        variants: [{ sku: "PX3001XNPPSNERO_35" }],
      }),
      product({
        ...mule,
        productName: "NAPPA MULE",
        productUrl: "https://paristexasbrand.com/products/mule-b",
        variants: [{ sku: "PX3002XNPPSNERO_35" }],
      }),
    ]);
    expect(families).toHaveLength(2);
  });

  it("merges Paris Texas colors that share an explicit style code", () => {
    const boot = {
      source: "paris-texas",
      brand: "PARIS TEXAS",
      productName: "NAPPA ANKLE BOOT",
      category: "ANKLE_BOOT" as const,
      normalized: {
        category: "ANKLE_BOOT" as const,
        colorFamily: "NUDE",
        materialFamily: "LEATHER",
        heelType: "STILETTO",
        heelHeightGroup: "HIGH",
        toeShape: "POINTED",
        details: [],
        construction: ["CLOSED_TOE"],
      },
    };
    const { families } = buildModelFamilies([
      product({
        ...boot,
        productUrl: "https://paristexasbrand.com/products/nappa-ankle-bootpx2027xnppscream",
        variants: [{ sku: "PX2027XNPPSCREAM_35", color: "Cream" }],
      }),
      product({
        ...boot,
        productUrl: "https://paristexasbrand.com/products/nappa-ankle-bootpx2027xnppsborgogna",
        color: "Borgogna",
        cleaned: { color: "Borgogna", heelHeight: null },
        variants: [{ sku: "PX2027XNPPSBORGOGNA_35", color: "Borgogna" }],
      }),
    ]);
    expect(families).toHaveLength(1);
    expect(families[0]?.variantCount).toBe(2);
    expect(families[0]?.groupingConfidence).toBe("HIGH");
  });

  it("does not use generic category title or footwear type as a family key", () => {
    const { families } = buildModelFamilies([
      product({
        brand: "ZARA",
        source: "zara",
        productName: "Boot",
        productUrl: "https://www.zara.com/us/en/boot-p1.html",
        category: "BOOT",
        normalized: {
          category: "BOOT",
          colorFamily: "BLACK",
          materialFamily: "LEATHER",
          heelType: "UNKNOWN",
          heelHeightGroup: "UNKNOWN",
          toeShape: "UNKNOWN",
          details: [],
          construction: [],
        },
      }),
      product({
        brand: "ZARA",
        source: "zara",
        productName: "Boot",
        productUrl: "https://www.zara.com/us/en/boot-p2.html",
        category: "BOOT",
        normalized: {
          category: "BOOT",
          colorFamily: "BROWN",
          materialFamily: "LEATHER",
          heelType: "UNKNOWN",
          heelHeightGroup: "UNKNOWN",
          toeShape: "UNKNOWN",
          details: [],
          construction: [],
        },
      }),
    ]);
    expect(families).toHaveLength(2);
  });

  it("keeps uncertain identity as separate families", () => {
    const { families } = buildModelFamilies([
      product({
        brand: "PARIS TEXAS",
        source: "paris-texas",
        productName: "Slingback",
        productUrl: "https://paristexasbrand.com/products/sling-a",
      }),
      product({
        brand: "PARIS TEXAS",
        source: "paris-texas",
        productName: "Slingback",
        productUrl: "https://paristexasbrand.com/products/sling-b",
      }),
    ]);
    expect(families).toHaveLength(2);
  });

  it("does not merge Farfetch listings that only share a generic name", () => {
    const { families } = buildModelFamilies([
      product({
        source: "farfetch",
        brand: "ZARA",
        productName: "Flat",
        productUrl: "https://www.farfetch.com/uk/shopping/women/zara-flat-item-111.aspx",
      }),
      product({
        source: "farfetch",
        brand: "ZARA",
        productName: "Flat",
        productUrl: "https://www.farfetch.com/uk/shopping/women/zara-flat-item-222.aspx",
      }),
    ]);
    expect(families).toHaveLength(2);
  });

  it("does not merge Level Shoes products by generic title", () => {
    const { families } = buildModelFamilies([
      product({
        source: "level-shoes",
        brand: "AQUAZZURA",
        productName: "Mule",
        productUrl: "https://www.levelshoes.com/aquazzura-tequila-75-mules-white.html",
      }),
      product({
        source: "level-shoes",
        brand: "AQUAZZURA",
        productName: "Mule",
        productUrl: "https://www.levelshoes.com/aquazzura-other-mule-black.html",
      }),
    ]);
    expect(families).toHaveLength(2);
  });

  it("does not merge distinctive names that carry different source style codes", () => {
    const boot = {
      source: "paris-texas",
      brand: "PARIS TEXAS",
      category: "ANKLE_BOOT" as const,
      normalized: {
        category: "ANKLE_BOOT" as const,
        colorFamily: "BLACK",
        materialFamily: "LEATHER",
        heelType: "STILETTO",
        heelHeightGroup: "HIGH",
        toeShape: "POINTED",
        details: [],
        construction: ["CLOSED_TOE"],
      },
    };
    const { families } = buildModelFamilies([
      product({
        ...boot,
        productName: "WESTERN ANKLE BOOT",
        productUrl: "https://paristexasbrand.com/products/western-a",
        variants: [{ sku: "PX1119XVT0CNERO_35" }],
      }),
      product({
        ...boot,
        productName: "WESTERN ANKLE BOOT",
        productUrl: "https://paristexasbrand.com/products/western-b",
        variants: [{ sku: "PX9999XVT0CNERO_35" }],
      }),
    ]);
    expect(families).toHaveLength(2);
  });

  it("does not merge on category or footwear type equality alone", () => {
    const { families } = buildModelFamilies([
      product({
        brand: "THE ATTICO",
        source: "the-attico",
        productName: "Devon Pump",
        productUrl: "https://www.theattico.com/products/devon-pump",
      }),
      product({
        brand: "THE ATTICO",
        source: "the-attico",
        productName: "Elena Pump",
        productUrl: "https://www.theattico.com/products/elena-pump",
      }),
    ]);
    expect(families).toHaveLength(2);
  });

  it("does not merge a marketplace listing into an official family by title", () => {
    const { families } = buildModelFamilies([
      product({
        source: "paris-texas",
        brand: "PARIS TEXAS",
        productName: "Lidia Boot",
        productUrl: "https://paristexasbrand.com/products/lidia-boot",
      }),
      product({
        source: "farfetch",
        brand: "PARIS TEXAS",
        productName: "Lidia Boot",
        productUrl: "https://www.farfetch.com/uk/shopping/women/paris-texas-lidia-boot-item-555.aspx",
      }),
    ]);
    expect(families).toHaveLength(2);
  });

  it("still groups Jeffrey Campbell colorways with a distinctive name", () => {
    const { families } = buildModelFamilies([
      product({
        source: "jeffrey-campbell",
        brand: "JEFFREY CAMPBELL",
        productName: "AGENT",
        productUrl: "https://jeffreycampbellshoes.com/products/agent",
        variants: [{ sku: "AGENT-460-6", color: "Black" }],
      }),
      product({
        source: "jeffrey-campbell",
        brand: "JEFFREY CAMPBELL",
        productName: "AGENT",
        productUrl: "https://jeffreycampbellshoes.com/products/agent-white",
        color: "White",
        cleaned: { color: "White", heelHeight: null },
        variants: [{ sku: "AGENT-212-6", color: "White" }],
      }),
    ]);
    expect(families).toHaveLength(1);
    expect(families[0]?.variantCount).toBe(2);
  });

  it("still groups Schutz colorways via style code", () => {
    const { families } = buildModelFamilies([
      product({
        source: "schutz",
        brand: "SCHUTZ",
        productName: "Julie Suede Pump",
        productUrl: "https://schutz-shoes.com/products/julie-black",
        variants: [{ sku: "S2217900140013", color: "Black" }],
      }),
      product({
        source: "schutz",
        brand: "SCHUTZ",
        productName: "Julie Suede Pump",
        productUrl: "https://schutz-shoes.com/products/julie-brown",
        color: "Brown",
        cleaned: { color: "Brown", heelHeight: null },
        variants: [{ sku: "S2217900140008", color: "Brown" }],
      }),
    ]);
    expect(families).toHaveLength(1);
    expect(families[0]?.groupingConfidence).toBe("HIGH");
  });
});
