import { describe, expect, it } from "vitest";

import { buildModelFamilies } from "../buildFamilies";
import { isGenericModelTitle, hasDistinctiveModelToken } from "../genericModelTitle";
import { extractZaraProductId, extractFarfetchItemId } from "../sourceIdentity";
import { extractBaseSku, extractParisTexasStyleCode, extractParisTexasColorFromSku, extractStaudStyleCode } from "../styleCode";
import { colorVariantsForFamily } from "../colorVariants";
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

  it("does not merge the same Zara listing ID across incompatible mule vs sandal architecture", () => {
    const { families } = buildModelFamilies([
      product({
        source: "zara",
        brand: "ZARA",
        productName: "PRINTED FUR EFFECT LEATHER MULES",
        productUrl: "https://www.zara.com/us/en/printed-leather-fur-effect-sandals-p13318810.html",
        category: "MULE",
        normalized: {
          category: "MULE",
          colorFamily: "BROWN",
          materialFamily: "LEATHER",
          heelType: "FLAT",
          heelHeightGroup: "FLAT",
          toeShape: "ROUND",
          details: [],
          construction: ["BACKLESS", "CLOSED_TOE"],
        },
      }),
      product({
        source: "zara",
        brand: "ZARA",
        productName: "PRINTED CALF HAIR LEATHER SANDALS",
        productUrl: "https://www.zara.com/us/en/printed-calf-hair-leather-sandals-p13318810.html",
        category: "SANDAL",
        color: "Brown",
        cleaned: { color: "Brown", heelHeight: null },
        normalized: {
          category: "SANDAL",
          colorFamily: "BROWN",
          materialFamily: "LEATHER",
          heelType: "FLAT",
          heelHeightGroup: "FLAT",
          toeShape: "OPEN",
          details: [],
          construction: ["OPEN_TOE"],
        },
      }),
    ]);
    expect(families).toHaveLength(2);
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

  it("does not merge marketplace listings by distinctive name alone", () => {
    const { families } = buildModelFamilies([
      product({
        source: "farfetch",
        brand: "adidas",
        productName: "Tokyo Sneaker",
        productUrl: "https://www.farfetch.com/uk/shopping/women/adidas-tokyo-sneaker-item-111.aspx",
        category: "SNEAKER",
        normalized: {
          category: "SNEAKER",
          colorFamily: "WHITE",
          materialFamily: "LEATHER",
          heelType: "FLAT",
          heelHeightGroup: "FLAT",
          toeShape: "ROUND",
          details: [],
          construction: ["CLOSED_TOE"],
        },
      }),
      product({
        source: "farfetch",
        brand: "adidas",
        productName: "Tokyo Sneaker",
        productUrl: "https://www.farfetch.com/uk/shopping/women/adidas-tokyo-sneaker-item-222.aspx",
        category: "SNEAKER",
        color: "Black",
        cleaned: { color: "Black", heelHeight: null },
        normalized: {
          category: "SNEAKER",
          colorFamily: "BLACK",
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

  it("reconciles official Shopify colorways that share a handle family", () => {
    const { families } = buildModelFamilies([
      product({
        source: "a-emery",
        brand: "A.EMERY",
        productName: "The Elmer Sandal",
        productUrl: "https://aemery.com/products/the-elmer-sandal-black",
        category: "SANDAL",
        normalized: {
          category: "SANDAL",
          colorFamily: "BLACK",
          materialFamily: "LEATHER",
          heelType: "FLAT",
          heelHeightGroup: "FLAT",
          toeShape: "OPEN",
          details: [],
          construction: ["OPEN_TOE"],
        },
      }),
      product({
        source: "a-emery",
        brand: "A.EMERY",
        productName: "The Elmer Sandal Eggshell",
        productUrl: "https://aemery.com/products/the-elmer-sandal-eggshell",
        category: "SANDAL",
        color: "Eggshell",
        cleaned: { color: "Eggshell", heelHeight: null },
        normalized: {
          category: "SANDAL",
          colorFamily: "WHITE",
          materialFamily: "LEATHER",
          heelType: "FLAT",
          heelHeightGroup: "FLAT",
          toeShape: "OPEN",
          details: [],
          construction: ["OPEN_TOE"],
        },
      }),
    ]);
    expect(families).toHaveLength(1);
    expect(families[0]?.groupingReason).toMatch(/handleFamily:|safeNameColorway:/);
  });

  it("reconciles official sneaker colorways split by collector ballet vs sneaker labels", () => {
    const { families } = buildModelFamilies([
      product({
        source: "dolce-vita",
        brand: "DOLCE VITA",
        productName: "TRICIA SNEAKERS DK GREEN SUEDE",
        productUrl: "https://www.dolcevita.com/products/tricia-sneakers-dk-green-suede",
        category: "BALLERINA",
        color: "Dk Green",
        cleaned: { color: "Dk Green", heelHeight: null },
        normalized: {
          category: "BALLERINA",
          colorFamily: "GREEN",
          materialFamily: "SUEDE",
          heelType: "FLAT",
          heelHeightGroup: "FLAT",
          toeShape: "ROUND",
          details: [],
          construction: ["CLOSED_TOE"],
        },
      }),
      product({
        source: "dolce-vita",
        brand: "DOLCE VITA",
        productName: "TRICIA SNEAKERS DK BROWN SUEDE",
        productUrl: "https://www.dolcevita.com/products/tricia-sneakers-dk-brown-suede",
        category: "SNEAKER",
        color: "Dk Brown",
        cleaned: { color: "Dk Brown", heelHeight: null },
        normalized: {
          category: "SNEAKER",
          colorFamily: "BROWN",
          materialFamily: "SUEDE",
          heelType: "FLAT",
          heelHeightGroup: "FLAT",
          toeShape: "ROUND",
          details: [],
          construction: ["CLOSED_TOE"],
        },
      }),
    ]);
    expect(families).toHaveLength(1);
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

  it("keeps Schutz products with conflicting style codes separate", () => {
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
        productUrl: "https://schutz-shoes.com/products/other-black",
        variants: [{ sku: "S2208700750004", color: "Black" }],
      }),
    ]);
    expect(families).toHaveLength(2);
  });
});

describe("verified color recovery", () => {
  it("groups three Zara colors of the same -p style into one family", () => {
    const base = {
      source: "zara",
      brand: "ZARA",
      productName: "Split Suede Loafers",
      productUrl: "https://www.zara.com/us/en/split-suede-loafers-p12504810.html",
      category: "LOAFER" as const,
      normalized: {
        category: "LOAFER" as const,
        colorFamily: "BROWN",
        materialFamily: "SUEDE",
        heelType: "FLAT",
        heelHeightGroup: "FLAT",
        toeShape: "ROUND",
        details: [],
        construction: ["CLOSED_TOE"],
      },
    };
    const { families } = buildModelFamilies([
      product({
        ...base,
        color: "Sandy Brown",
        cleaned: { color: "Sandy Brown", heelHeight: null },
        imageUrl: "https://static.zara.net/brown.jpg",
        variants: [
          {
            color: "Sandy Brown",
            sku: "ZARA-REF-2504/810",
            imageUrl: "https://static.zara.net/brown.jpg",
            images: ["https://static.zara.net/brown.jpg"],
          },
          {
            color: "Ice",
            sku: "ZARA-REF-2504/810",
            imageUrl: "https://static.zara.net/ice.jpg",
            images: ["https://static.zara.net/ice.jpg"],
          },
          {
            color: "Black",
            sku: "ZARA-REF-2504/810",
            imageUrl: "https://static.zara.net/black.jpg",
            images: ["https://static.zara.net/black.jpg"],
          },
        ],
      }),
    ]);
    expect(families).toHaveLength(1);
    expect(families[0]?.variantCount).toBe(3);
    const colors = colorVariantsForFamily(families[0]!);
    expect(colors).toHaveLength(3);
    expect(colors.map((item) => item.color).sort()).toEqual(["Black", "Ice", "Sandy Brown"]);
    expect(new Set(colors.map((item) => item.url)).size).toBe(1);
    expect(new Set(colors.map((item) => item.thumbnail)).size).toBe(3);
  });

  it("does not merge different Zara -p IDs that only share a generic title", () => {
    const { families } = buildModelFamilies([
      product({
        source: "zara",
        brand: "ZARA",
        productName: "Heeled Sandals",
        productUrl: "https://www.zara.com/us/en/heeled-sandals-p12314710.html",
      }),
      product({
        source: "zara",
        brand: "ZARA",
        productName: "Heeled Sandals",
        productUrl: "https://www.zara.com/us/en/heeled-sandals-p11302810.html",
      }),
    ]);
    expect(families).toHaveLength(2);
  });

  it("merges Paris Texas colors that share a PX style after color-suffix stripping", () => {
    expect(extractParisTexasStyleCode("PX1141XVN01DESERTROSE_35")).toBe("PX1141XVN01");
    expect(extractParisTexasStyleCode("PX1141XVN0169622_35")).toBe("PX1141XVN01");
    expect(extractParisTexasColorFromSku("PX1141XVN01IVORY_35")).toBe("IVORY");
    const { families } = buildModelFamilies([
      product({
        source: "paris-texas",
        brand: "PARIS TEXAS",
        productName: "Patent leather mule",
        productUrl: "https://paristexasbrand.com/products/mule-ivory",
        category: "MULE",
        variants: [{ sku: "PX1141XVN01IVORY_35", color: "Ivory" }],
        normalized: {
          category: "MULE",
          colorFamily: "WHITE",
          materialFamily: "PATENT",
          heelType: "STILETTO",
          heelHeightGroup: "HIGH",
          toeShape: "POINTED",
          details: [],
          construction: ["BACKLESS"],
        },
      }),
      product({
        source: "paris-texas",
        brand: "PARIS TEXAS",
        productName: "Patent leather mule",
        productUrl: "https://paristexasbrand.com/products/mule-desert",
        color: "Desert Rose",
        cleaned: { color: "Desert Rose", heelHeight: null },
        category: "MULE",
        variants: [{ sku: "PX1141XVN01DESERTROSE_35", color: "Desert Rose" }],
        normalized: {
          category: "MULE",
          colorFamily: "PINK",
          materialFamily: "PATENT",
          heelType: "STILETTO",
          heelHeightGroup: "HIGH",
          toeShape: "POINTED",
          details: [],
          construction: ["BACKLESS"],
        },
      }),
      product({
        source: "paris-texas",
        brand: "PARIS TEXAS",
        productName: "Patent leather mule",
        productUrl: "https://paristexasbrand.com/products/mule-69622",
        color: "Amarena",
        cleaned: { color: "Amarena", heelHeight: null },
        category: "MULE",
        variants: [{ sku: "PX1141XVN0169622_35", color: "Amarena" }],
        normalized: {
          category: "MULE",
          colorFamily: "RED",
          materialFamily: "PATENT",
          heelType: "STILETTO",
          heelHeightGroup: "HIGH",
          toeShape: "POINTED",
          details: [],
          construction: ["BACKLESS"],
        },
      }),
    ]);
    expect(families).toHaveLength(1);
    expect(families[0]?.variantCount).toBe(3);
  });

  it("does not merge Paris Texas PX1141 patent mule with a different PX1141 material style", () => {
    const { families } = buildModelFamilies([
      product({
        source: "paris-texas",
        brand: "PARIS TEXAS",
        productName: "Patent leather mule",
        productUrl: "https://paristexasbrand.com/products/patent",
        category: "MULE",
        variants: [{ sku: "PX1141XVN01NERO_35", color: "Nero" }],
        normalized: {
          category: "MULE",
          colorFamily: "BLACK",
          materialFamily: "PATENT",
          heelType: "STILETTO",
          heelHeightGroup: "HIGH",
          toeShape: "POINTED",
          details: [],
          construction: ["BACKLESS"],
        },
      }),
      product({
        source: "paris-texas",
        brand: "PARIS TEXAS",
        productName: "Mirrored leather mule",
        productUrl: "https://paristexasbrand.com/products/mirror",
        category: "MULE",
        variants: [{ sku: "PX1141XNPMRARGENTO_35", color: "Argento" }],
        normalized: {
          category: "MULE",
          colorFamily: "SILVER",
          materialFamily: "LEATHER",
          heelType: "STILETTO",
          heelHeightGroup: "HIGH",
          toeShape: "POINTED",
          details: [],
          construction: ["BACKLESS"],
        },
      }),
    ]);
    expect(families).toHaveLength(2);
  });

  it("groups Staud colorways that share a verified style code", () => {
    expect(extractStaudStyleCode("F25F1028LN-TRUF-35")).toBe("F25F1028");
    expect(extractStaudStyleCode("F25F1028VR-SYR-36")).toBe("F25F1028");
    const { families } = buildModelFamilies([
      product({
        source: "staud",
        brand: "STAUD",
        productName: "Sebastian Ankle Boot | Truffle",
        productUrl: "https://staud.clothing/products/sebastian-ankle-boot-truffle",
        variants: [{ sku: "F25F1028LN-TRUF-35", color: "Truffle" }],
      }),
      product({
        source: "staud",
        brand: "STAUD",
        productName: "Sebastian Ankle Boot | Syrah",
        productUrl: "https://staud.clothing/products/sebastian-ankle-boot-syrah",
        color: "Syrah",
        cleaned: { color: "Syrah", heelHeight: null },
        variants: [{ sku: "F25F1028VR-SYR-35", color: "Syrah" }],
      }),
    ]);
    expect(families).toHaveLength(1);
    expect(families[0]?.variantCount).toBe(2);
  });

  it("keeps one saved family for a multi-color model", () => {
    const { families } = buildModelFamilies([
      product({
        source: "jeffrey-campbell",
        brand: "JEFFREY CAMPBELL",
        productName: "AGENT",
        productUrl: "https://jeffreycampbellshoes.com/products/agent",
        color: "Black",
        variants: [
          { sku: "AGENT-460-6", color: "Black", imageUrl: "https://cdn.example.com/black.jpg" },
          { sku: "AGENT-212-6", color: "White", imageUrl: "https://cdn.example.com/white.jpg" },
        ],
      }),
    ]);
    expect(families).toHaveLength(1);
    expect(families[0]?.variantCount).toBe(2);
    expect(colorVariantsForFamily(families[0]!)).toHaveLength(2);
  });

  it("does not family-merge a generic title even when SKUs are missing", () => {
    const { families } = buildModelFamilies([
      product({
        source: "the-row",
        brand: "THE ROW",
        productName: "Loafer",
        productUrl: "https://www.therow.com/products/loafer-black",
      }),
      product({
        source: "the-row",
        brand: "THE ROW",
        productName: "Loafer",
        productUrl: "https://www.therow.com/products/loafer-brown",
      }),
    ]);
    expect(families).toHaveLength(2);
  });

  it("does not name-merge distinctive titles onto conflicting verified styles", () => {
    const boot = {
      source: "paris-texas",
      brand: "PARIS TEXAS",
      productName: "WESTERN ANKLE BOOT",
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
        productUrl: "https://paristexasbrand.com/products/western-unknown",
      }),
      product({
        ...boot,
        productUrl: "https://paristexasbrand.com/products/western-a",
        variants: [{ sku: "PX1119XVT0CNERO_35" }],
      }),
      product({
        ...boot,
        productUrl: "https://paristexasbrand.com/products/western-b",
        variants: [{ sku: "PX9999XVT0CNERO_35" }],
      }),
    ]);
    expect(families).toHaveLength(3);
  });

  it("does not merge generic sandal titles by handle color suffix", () => {
    const { families } = buildModelFamilies([
      product({
        source: "aeyde",
        brand: "AEYDE",
        productName: "Sandal",
        productUrl: "https://www.aeyde.com/products/sandal-black",
      }),
      product({
        source: "aeyde",
        brand: "AEYDE",
        productName: "Sandal",
        productUrl: "https://www.aeyde.com/products/sandal-white",
        color: "White",
        cleaned: { color: "White", heelHeight: null },
      }),
    ]);
    expect(families).toHaveLength(2);
  });

  it("merges official Shopify color handles that share a distinctive model stem", () => {
    const { families } = buildModelFamilies([
      product({
        source: "aeyde",
        brand: "AEYDE",
        productName: "Dex Black Nappa",
        productUrl: "https://www.aeyde.com/products/dex-black-nappa",
        color: "Black",
        cleaned: { color: "Black", heelHeight: null },
      }),
      product({
        source: "aeyde",
        brand: "AEYDE",
        productName: "Dex Moka Nappa",
        productUrl: "https://www.aeyde.com/products/dex-moka-nappa",
        color: "Moka",
        cleaned: { color: "Moka", heelHeight: null },
      }),
    ]);
    expect(families).toHaveLength(1);
    expect(families[0]?.groupingConfidence).toBe("HIGH");
    expect(families[0]?.groupingReason).toContain("handleFamily:");
  });

  it("does not merge official and marketplace listings that share a style code", () => {
    const { families } = buildModelFamilies([
      product({
        source: "schutz",
        brand: "SCHUTZ",
        productName: "Julie Suede Pump",
        productUrl: "https://schutz-shoes.com/products/julie-black",
        variants: [{ sku: "S2217900140013", color: "Black" }],
      }),
      product({
        source: "farfetch",
        brand: "SCHUTZ",
        productName: "Julie Suede Pump",
        productUrl: "https://www.farfetch.com/shopping/women/schutz-julie-item-999.aspx",
        variants: [{ sku: "S2217900140008", color: "Brown" }],
      }),
    ]);
    expect(families).toHaveLength(2);
  });

  it("does not merge the same distinctive name across brands", () => {
    const { families } = buildModelFamilies([
      product({
        source: "aeyde",
        brand: "AEYDE",
        productName: "Uma Mary-jane Flats",
        productUrl: "https://www.aeyde.com/products/uma-black",
      }),
      product({
        source: "schutz",
        brand: "SCHUTZ",
        productName: "Uma Mary-jane Flats",
        productUrl: "https://schutz-shoes.com/products/uma-black",
      }),
    ]);
    expect(families).toHaveLength(2);
  });

  it("does not merge the same Larroude style code across sneaker and mule", () => {
    const { families } = buildModelFamilies([
      product({
        source: "larroude",
        brand: "LARROUDE",
        productName: "Stella Sneaker Teal Suede",
        productUrl: "https://larroude.com/stella-sneaker",
        category: "SNEAKER",
        variants: [{ sku: "L415-STEL-5.0-TEAL-3054", color: "Teal" }],
        normalized: {
          category: "SNEAKER",
          colorFamily: "GREEN",
          materialFamily: "SUEDE",
          heelType: "OTHER",
          heelHeightGroup: "UNKNOWN",
          toeShape: "ROUND",
          details: [],
          construction: ["LACE_UP"],
        },
      }),
      product({
        source: "larroude",
        brand: "LARROUDE",
        productName: "Stella Mule Teal Suede",
        productUrl: "https://larroude.com/stella-mule",
        category: "MULE",
        variants: [{ sku: "L415-STEL-5.0-TEAL-3055", color: "Teal" }],
        normalized: {
          category: "MULE",
          colorFamily: "GREEN",
          materialFamily: "SUEDE",
          heelType: "OTHER",
          heelHeightGroup: "UNKNOWN",
          toeShape: "ROUND",
          details: [],
          construction: ["BACKLESS"],
        },
      }),
    ]);
    expect(families).toHaveLength(2);
  });

  it("handle-merges distinctive AEYDE colors when SKUs are not a verified style identity", () => {
    const { families } = buildModelFamilies([
      product({
        source: "aeyde",
        brand: "AEYDE",
        productName: "Uma Mary-jane Flats",
        productUrl: "https://www.aeyde.com/products/uma-black",
        variants: [{ sku: "UMA-BLK-36", color: "Black" }],
      }),
      product({
        source: "aeyde",
        brand: "AEYDE",
        productName: "Uma Mary-jane Flats",
        productUrl: "https://www.aeyde.com/products/uma-cream",
        color: "Cream",
        cleaned: { color: "Cream", heelHeight: null },
        variants: [{ sku: "UMA-CRM-36", color: "Cream" }],
      }),
    ]);
    expect(families).toHaveLength(1);
    expect(families[0]?.variantCount).toBe(2);
    expect(families[0]?.groupingReason).toContain("handleFamily:");
  });

  it("does not merge Relan mesh flats with Relan leather flats", () => {
    const { families } = buildModelFamilies([
      product({
        source: "dolce-vita",
        brand: "DOLCE VITA",
        productName: "RELAN BALLET FLATS GOLD DISTRESSED LEATHER",
        productUrl: "https://dolcevita.com/products/relan-ballet-flats-gold-distressed-leather",
      }),
      product({
        source: "dolce-vita",
        brand: "DOLCE VITA",
        productName: "RELAN MESH BALLET FLATS CHILI MESH",
        productUrl: "https://dolcevita.com/products/relan-mesh-ballet-flats-chili-mesh",
      }),
    ]);
    expect(families).toHaveLength(2);
  });

  it("does not merge Dolly wood and Dolly clear despite a shared Larroude style prefix", () => {
    const { families } = buildModelFamilies([
      product({
        source: "larroude",
        brand: "LARROUDE",
        productName: "Dolly X Wood Sandal Caramel Leather",
        productUrl: "https://larroude.com/products/dolly-wood",
        category: "SANDAL",
        variants: [{ sku: "L131-DOLL-5.0-CARA-1001", color: "Caramel" }],
        normalized: {
          category: "SANDAL",
          colorFamily: "BROWN",
          materialFamily: "LEATHER",
          heelType: "BLOCK",
          heelHeightGroup: "MID",
          toeShape: "OPEN",
          details: [],
          construction: ["OPEN_TOE"],
        },
      }),
      product({
        source: "larroude",
        brand: "LARROUDE",
        productName: "Dolly Clear Sandal Black Patent Leather",
        productUrl: "https://larroude.com/products/dolly-clear",
        category: "SANDAL",
        variants: [{ sku: "L131-DOLL-5.0-BLCK-1002", color: "Black" }],
        normalized: {
          category: "SANDAL",
          colorFamily: "BLACK",
          materialFamily: "PATENT",
          heelType: "BLOCK",
          heelHeightGroup: "MID",
          toeShape: "OPEN",
          details: [],
          construction: ["OPEN_TOE"],
        },
      }),
    ]);
    expect(families).toHaveLength(2);
  });

  it("does not merge Malone Maureen mesh with leather flats", () => {
    const { families } = buildModelFamilies([
      product({
        source: "malone-souliers",
        brand: "MALONE SOULIERS",
        productName: "Maureen Black Sequin Mesh Flat Mules",
        productUrl: "https://malonesouliers.com/products/maureen-mesh",
        variants: [{ sku: "MAUREEN FLAT 1", color: "Black" }],
      }),
      product({
        source: "malone-souliers",
        brand: "MALONE SOULIERS",
        productName: "Maureen White Leather Flat Mules",
        productUrl: "https://malonesouliers.com/products/maureen-leather",
        variants: [{ sku: "MAUREEN FLAT 2", color: "White" }],
      }),
    ]);
    expect(families).toHaveLength(2);
  });

  it("keeps Malone Maureen leather colorways together", () => {
    const { families } = buildModelFamilies([
      product({
        source: "malone-souliers",
        brand: "MALONE SOULIERS",
        productName: "Maureen White Leather Flat Mules",
        productUrl: "https://malonesouliers.com/products/maureen-white",
        variants: [{ sku: "MAUREEN FLAT 2", color: "White" }],
      }),
      product({
        source: "malone-souliers",
        brand: "MALONE SOULIERS",
        productName: "Maureen Taupe Leather Flat Mules",
        productUrl: "https://malonesouliers.com/products/maureen-taupe",
        color: "Taupe",
        cleaned: { color: "Taupe", heelHeight: null },
        variants: [{ sku: "MAUREEN FLAT 3", color: "Taupe" }],
      }),
    ]);
    expect(families).toHaveLength(1);
  });

  it("does not merge Malone Maureen satin with leather flats", () => {
    const { families } = buildModelFamilies([
      product({
        source: "malone-souliers",
        brand: "MALONE SOULIERS",
        productName: "Maureen Burgundy Satin Flat Mules",
        productUrl: "https://malonesouliers.com/products/maureen-satin",
        variants: [{ sku: "MAUREEN FLAT 4", color: "Burgundy" }],
      }),
      product({
        source: "malone-souliers",
        brand: "MALONE SOULIERS",
        productName: "Maureen White Leather Flat Mules",
        productUrl: "https://malonesouliers.com/products/maureen-leather",
        variants: [{ sku: "MAUREEN FLAT 2", color: "White" }],
      }),
    ]);
    expect(families).toHaveLength(2);
  });

  it("does not merge a mule and a sandal that share a style prefix", () => {
    const { families } = buildModelFamilies([
      product({
        source: "larroude",
        brand: "LARROUDE",
        productName: "Demo Mule Caramel Leather",
        productUrl: "https://larroude.com/products/demo-mule",
        category: "MULE",
        variants: [{ sku: "L199-DEMO-5.0-CARA-1001", color: "Caramel" }],
        normalized: {
          category: "MULE",
          colorFamily: "BROWN",
          materialFamily: "LEATHER",
          heelType: "BLOCK",
          heelHeightGroup: "MID",
          toeShape: "OPEN",
          details: [],
          construction: ["OPEN_TOE"],
        },
      }),
      product({
        source: "larroude",
        brand: "LARROUDE",
        productName: "Demo Sandal Black Leather",
        productUrl: "https://larroude.com/products/demo-sandal",
        category: "SANDAL",
        variants: [{ sku: "L199-DEMO-5.0-BLCK-1002", color: "Black" }],
        normalized: {
          category: "SANDAL",
          colorFamily: "BLACK",
          materialFamily: "LEATHER",
          heelType: "BLOCK",
          heelHeightGroup: "MID",
          toeShape: "OPEN",
          details: [],
          construction: ["OPEN_TOE"],
        },
      }),
    ]);
    expect(families).toHaveLength(2);
  });

  it("keeps Ancient Greek Aeropi colors that share style 12456", () => {
    const { families } = buildModelFamilies([
      product({
        source: "ancient-greek-sandals",
        brand: "ANCIENT GREEK SANDALS",
        productName: "Aeropi Ballet Flat",
        productUrl: "https://ancient-greek-sandals.com/products/aeropi",
        variants: [{ sku: "12456_1069_00039", color: "Black" }],
      }),
      product({
        source: "ancient-greek-sandals",
        brand: "ANCIENT GREEK SANDALS",
        productName: "Aeropi Ballet Flat",
        productUrl: "https://ancient-greek-sandals.com/products/aeropi-13",
        color: "Gold",
        cleaned: { color: "Gold", heelHeight: null },
        variants: [{ sku: "12456_1069_00374", color: "Gold" }],
      }),
    ]);
    expect(families).toHaveLength(1);
    expect(families[0]?.groupingReason).toContain("styleCode:12456");
  });

  it("does not keep Alohas Rosalind leather and mesh as one family", () => {
    const { families } = buildModelFamilies([
      product({
        source: "alohas",
        brand: "ALOHAS",
        productName: "Rosalind Ballet Flats",
        productUrl: "https://alohas.io/products/rosalind-black-leather-ballet-flats",
        variants: [{ sku: "S100303-0435", color: "Black" }],
      }),
      product({
        source: "alohas",
        brand: "ALOHAS",
        productName: "Rosalind Ballet Flats",
        productUrl: "https://alohas.io/products/rosalind-mesh-black-leather-ballet-flats",
        color: "Mesh Black",
        cleaned: { color: "Mesh Black", heelHeight: null },
        variants: [{ sku: "S101545-0135", color: "Mesh Black" }],
      }),
    ]);
    expect(families).toHaveLength(2);
  });

  it("recovers Carel Kina colorways via safe distinctive name evidence", () => {
    const kinas = Array.from({ length: 10 }, (_, index) =>
      product({
        source: "carel",
        brand: "CAREL",
        productName: "Kina",
        productUrl: `https://carel.fr/products/kina-${index}`,
        color: `Color ${index}`,
        cleaned: { color: `Color ${index}`, heelHeight: null },
        variants: [{ sku: `36061015891${index.toString().padStart(2, "0")}`, color: `Color ${index}` }],
      }),
    );
    const { families } = buildModelFamilies(kinas);
    expect(families).toHaveLength(1);
    expect(families[0]?.groupingReason).toContain("safeNameColorway:");
  });

  it("recovers Carel Banana slingback colorways with matching construction", () => {
    const { families } = buildModelFamilies([
      product({
        source: "carel",
        brand: "CAREL",
        productName: "Banana - Babies slingback cuir verni bleu marine",
        productUrl: "https://carel.fr/products/banana-1",
        category: "SLINGBACK",
        normalized: {
          category: "SLINGBACK",
          colorFamily: "BLUE",
          materialFamily: "PATENT",
          heelType: "BLOCK",
          heelHeightGroup: "LOW",
          toeShape: "ROUND",
          details: [],
          construction: ["CLOSED_TOE"],
        },
      }),
      product({
        source: "carel",
        brand: "CAREL",
        productName: "Banana - Babies slingback cuir verni rouge",
        productUrl: "https://carel.fr/products/banana-2",
        category: "SLINGBACK",
        color: "Rouge",
        cleaned: { color: "Rouge", heelHeight: null },
        normalized: {
          category: "SLINGBACK",
          colorFamily: "RED",
          materialFamily: "PATENT",
          heelType: "BLOCK",
          heelHeightGroup: "LOW",
          toeShape: "ROUND",
          details: [],
          construction: ["CLOSED_TOE"],
        },
      }),
    ]);
    expect(families).toHaveLength(1);
    expect(families[0]?.groupingReason).toContain("safeNameColorway:");
  });

  it("does not name-merge Kenley jelly with Kenley leather", () => {
    const { families } = buildModelFamilies([
      product({
        source: "dolce-vita",
        brand: "DOLCE VITA",
        productName: "KENLEY VINYL SANDALS CRYSTAL JELLY",
        productUrl: "https://dolcevita.com/products/kenley-crystal",
        category: "SANDAL",
        normalized: {
          category: "SANDAL",
          colorFamily: "CLEAR",
          materialFamily: "SYNTHETIC",
          heelType: "BLOCK",
          heelHeightGroup: "MID",
          toeShape: "OPEN",
          details: [],
          construction: ["OPEN_TOE"],
        },
      }),
      product({
        source: "dolce-vita",
        brand: "DOLCE VITA",
        productName: "KENLEY SANDALS SADDLE LEATHER",
        productUrl: "https://dolcevita.com/products/kenley-leather",
        category: "SANDAL",
        color: "Saddle",
        cleaned: { color: "Saddle", heelHeight: null },
        normalized: {
          category: "SANDAL",
          colorFamily: "BROWN",
          materialFamily: "LEATHER",
          heelType: "BLOCK",
          heelHeightGroup: "MID",
          toeShape: "OPEN",
          details: [],
          construction: ["OPEN_TOE"],
        },
      }),
    ]);
    expect(families).toHaveLength(2);
  });

  it("recovers Helia leather/suede colorways via safe name evidence", () => {
    const { families } = buildModelFamilies([
      product({
        source: "aeyde",
        brand: "AEYDE",
        productName: "Helia Low-Cut Pumps",
        productUrl: "https://www.aeyde.com/products/helia-black",
      }),
      product({
        source: "aeyde",
        brand: "AEYDE",
        productName: "Helia Suede Low-Cut Pumps",
        productUrl: "https://www.aeyde.com/products/helia-suede-cream",
        color: "Cream",
        cleaned: { color: "Cream", heelHeight: null },
      }),
    ]);
    expect(families).toHaveLength(1);
    expect(families[0]?.groupingReason).toMatch(/safeNameColorway:|handleFamily:/);
  });

  it("does not name-merge generic sandal titles", () => {
    const { families } = buildModelFamilies([
      product({
        source: "dolce-vita",
        brand: "DOLCE VITA",
        productName: "Leather Sandal Black",
        productUrl: "https://dolcevita.com/products/leather-sandal-black",
        category: "SANDAL",
        normalized: {
          category: "SANDAL",
          colorFamily: "BLACK",
          materialFamily: "LEATHER",
          heelType: "FLAT",
          heelHeightGroup: "FLAT",
          toeShape: "OPEN",
          details: [],
          construction: ["OPEN_TOE"],
        },
      }),
      product({
        source: "dolce-vita",
        brand: "DOLCE VITA",
        productName: "Leather Sandal Brown",
        productUrl: "https://dolcevita.com/products/leather-sandal-brown",
        category: "SANDAL",
        color: "Brown",
        cleaned: { color: "Brown", heelHeight: null },
        normalized: {
          category: "SANDAL",
          colorFamily: "BROWN",
          materialFamily: "LEATHER",
          heelType: "FLAT",
          heelHeightGroup: "FLAT",
          toeShape: "OPEN",
          details: [],
          construction: ["OPEN_TOE"],
        },
      }),
    ]);
    expect(families).toHaveLength(2);
  });

  it("does not name-merge Carel résille mesh with leather Kina", () => {
    const { families } = buildModelFamilies([
      product({
        source: "carel",
        brand: "CAREL",
        productName: "Kina - Escarpins babies résille et cuir noir",
        productUrl: "https://www.carel.fr/products/kina-escarpins-babies-resille-et-cuir-noir",
      }),
      product({
        source: "carel",
        brand: "CAREL",
        productName: "Kina - Escarpins babies cuir verni noir",
        productUrl: "https://www.carel.fr/products/kina-escarpins-babies-cuir-verni-noir",
      }),
    ]);
    expect(families).toHaveLength(2);
  });

  it("handle-merges AEYDE Ellie creamy/glass colorways with the core Ellie stem", () => {
    const { families } = buildModelFamilies([
      product({
        source: "aeyde",
        brand: "AEYDE",
        productName: "Ellie Almond-Toe Flats",
        productUrl: "https://www.aeyde.com/products/ellie-black-nappa",
      }),
      product({
        source: "aeyde",
        brand: "AEYDE",
        productName: "Ellie Almond-Toe Flats",
        productUrl: "https://www.aeyde.com/products/ellie-creamy-snake",
        color: "Creamy",
        cleaned: { color: "Creamy", heelHeight: null },
      }),
      product({
        source: "aeyde",
        brand: "AEYDE",
        productName: "Ellie Almond-Toe Flats",
        productUrl: "https://www.aeyde.com/products/ellie-glass-nappa",
        color: "Glass",
        cleaned: { color: "Glass", heelHeight: null },
      }),
    ]);
    expect(families).toHaveLength(1);
  });

  it("splits Alias Mae Lana products that only share the name", () => {
    const { families } = buildModelFamilies([
      product({
        source: "alias-mae",
        brand: "ALIAS MAE",
        productName: "Lana",
        productUrl: "https://aliasmae.com.au/products/lana",
        variants: [
          { color: "Black Tumble" },
          { color: "Choc Tumble" },
          { color: "Bone Tumble" },
          { color: "Silver Crinkle" },
        ],
      }),
      product({
        source: "alias-mae",
        brand: "ALIAS MAE",
        productName: "Lana",
        productUrl: "https://aliasmae.com.au/products/lana-satin",
        variants: [
          { color: "Black Satin" },
          { color: "Petrol Satin" },
          { color: "Ballet Satin" },
          { color: "Denim Satin" },
        ],
      }),
      product({
        source: "alias-mae",
        brand: "ALIAS MAE",
        productName: "Lana",
        productUrl: "https://aliasmae.com.au/products/lana-cracked",
        variants: [{ color: "Ivory Cracked" }, { color: "Silver Cracked" }],
      }),
    ]);
    expect(families).toHaveLength(3);
  });

  it("keeps construction-conflicting colorways as separate families", () => {
    const { families } = buildModelFamilies([
      product({
        source: "alohas",
        brand: "ALOHAS",
        productName: "Rosalind Ballet Flats",
        productUrl: "https://alohas.io/products/rosalind-black-leather-ballet-flats",
      }),
      product({
        source: "alohas",
        brand: "ALOHAS",
        productName: "Rosalind Mesh Ballet Flats",
        productUrl: "https://alohas.io/products/rosalind-mesh-black-leather-ballet-flats",
        color: "Mesh Black",
        cleaned: { color: "Mesh Black", heelHeight: null },
      }),
    ]);
    expect(families).toHaveLength(2);
  });
});
