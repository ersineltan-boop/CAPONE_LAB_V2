import { describe, expect, it } from "vitest";

import {
  evaluateFootwearProduct,
  evaluateStoredPilotProduct,
} from "../footwearGate";
import { shopifyProductToPilot } from "../shopify";
import type { PilotSourceConfig } from "../types";

const config: PilotSourceConfig = {
  id: "test",
  brand: "TEST",
  baseUrl: "https://example.com",
  collectionPaths: ["/collections/womens-shoes"],
  verifiedFootwearPaths: ["/collections/womens-shoes"],
  maxProducts: 30,
};

describe("footwear gate", () => {
  it("handbag excluded", () => {
    expect(
      evaluateFootwearProduct({
        title: "Alys Black Suede",
        productType: "Clutch",
        tags: ["Category~Handbags"],
        handle: "bagalys-black-suede",
      }).decision,
    ).toBe("EXCLUDE_NON_FOOTWEAR");
  });

  it("perfume excluded", () => {
    expect(
      evaluateFootwearProduct({
        title: "Eau de Parfum",
        productType: "Fragrance",
        tags: ["PERFUME"],
        handle: "parfum",
      }).decision,
    ).toBe("EXCLUDE_NON_FOOTWEAR");
  });

  it("dress excluded", () => {
    expect(
      evaluateFootwearProduct({
        title: "Slouch waist dress",
        productType: "Dress",
        tags: ["Dresses"],
        handle: "slouch-waist-dress",
      }).decision,
    ).toBe("EXCLUDE_NON_FOOTWEAR");
  });

  it("women's pump accepted via product_type", () => {
    const gate = evaluateFootwearProduct({
      title: "Valerie Low Pump",
      productType: "Pumps",
      tags: ["Heels"],
      handle: "valerie-low-pump",
    });
    expect(gate.decision).toBe("ACCEPT_FOOTWEAR");
    expect(gate.category).toBe("PUMP");
  });

  it("sandal accepted", () => {
    expect(
      evaluateFootwearProduct({
        title: "Phoebe Sandal",
        productType: "Sandals",
        tags: ["Sandals"],
        handle: "phoebe-sandal",
      }).category,
    ).toBe("SANDAL");
  });

  it("ballet flat accepted", () => {
    expect(
      evaluateFootwearProduct({
        title: "Classic Ballet Flat",
        productType: "Flats",
        tags: ["BALLET FLATS"],
        handle: "classic-ballet-flat",
      }).category,
    ).toBe("BALLERINA");
  });

  it("boot accepted", () => {
    expect(
      evaluateFootwearProduct({
        title: "Cindy Boot",
        productType: "Boots",
        tags: ["Boots"],
        handle: "cindy-boot",
      }).category,
    ).toBe("BOOT");
  });

  it("sneaker accepted", () => {
    expect(
      evaluateFootwearProduct({
        title: "Retro Sneaker",
        productType: "Sneakers",
        tags: ["SNEAKERS"],
        handle: "retro-sneaker",
      }).category,
    ).toBe("SNEAKER");
  });

  it("ambiguous product excluded", () => {
    expect(
      evaluateFootwearProduct({
        title: "Ribbed waist skirt",
        productType: "Skirt",
        tags: ["Skirts"],
        handle: "ribbed-waist-skirt",
      }).decision,
    ).toBe("EXCLUDE_NON_FOOTWEAR");
  });

  it("footwear collection product accepted with title support", () => {
    expect(
      evaluateFootwearProduct({
        title: "Soft Loafer",
        productType: "",
        tags: [],
        handle: "soft-loafer",
        collectionPath: "/collections/womens-shoes",
        fromVerifiedFootwearCollection: true,
      }).decision,
    ).toBe("ACCEPT_FOOTWEAR");
  });

  it("non-footwear product from same brand excluded in stored review", () => {
    expect(
      evaluateStoredPilotProduct({
        productName: "T-lock python-embossed crossbody",
        productUrl: "https://example.com/products/t-lock-crossbody",
        category: "PUMP",
      }).decision,
    ).toBe("EXCLUDE_NON_FOOTWEAR");
  });

  it("other footwear without title support excluded in stored review", () => {
    expect(
      evaluateStoredPilotProduct({
        productName: "Soie Malaquais",
        productUrl: "https://example.com/products/001-099009",
        category: "OTHER_FOOTWEAR",
      }).decision,
    ).toBe("EXCLUDE_UNCERTAIN_PRODUCT_TYPE");
  });

  it("lipstick excluded in stored review", () => {
    expect(
      evaluateStoredPilotProduct({
        productName: "Lipstick duo set",
        productUrl: "https://example.com/products/lipstick-set",
        category: "OTHER_FOOTWEAR",
      }).decision,
    ).toBe("EXCLUDE_NON_FOOTWEAR");
  });

  it("scarf-named slingback accepted when footwear title signal exists", () => {
    expect(
      evaluateFootwearProduct({
        title: "Scarf nappa slingbacks black/ecru",
        productType: "Shoes",
        tags: ["Slingbacks"],
        handle: "scarf-nappa-slingbacks",
      }).decision,
    ).toBe("ACCEPT_FOOTWEAR");
  });
});

describe("shopifyProductToPilot strict gate", () => {
  it("maps verified footwear shopify product", () => {
    const product = shopifyProductToPilot(
      {
        id: 1,
        title: "Lyra Sandal",
        handle: "lyra-sandal",
        body_html: "<p>Leather sandal</p>",
        product_type: "Sandals",
        tags: ["Sandals"],
        images: [{ src: "https://cdn.example.com/shoe.jpg" }],
        options: [{ name: "Color", values: ["Platinum"] }],
        variants: [{ title: "5 / Platinum", option1: "5", option2: "Platinum", sku: "SKU1" }],
      },
      config,
      "2026-08-18T00:00:00.000Z",
      "/collections/womens-shoes",
    );

    expect(product?.category).toBe("SANDAL");
  });

  it("rejects dress from footwear collection context", () => {
    const product = shopifyProductToPilot(
      {
        id: 2,
        title: "Ribbed waist skirt",
        handle: "ribbed-waist-skirt",
        product_type: "Skirt",
        tags: ["Skirts"],
      },
      config,
      "2026-08-18T00:00:00.000Z",
      "/collections/womens-shoes",
    );

    expect(product).toBeNull();
  });
});

describe("localized footwear completeness", () => {
  it("accepts Portuguese shoe product types", () => {
    expect(
      evaluateFootwearProduct({
        title: "Soca Lisboa",
        productType: "Socas",
        tags: ["Calçado"],
        handle: "soca-lisboa",
      }).decision,
    ).toBe("ACCEPT_FOOTWEAR");
  });

  it("accepts products from a verified Portuguese footwear collection even without English terms", () => {
    expect(
      evaluateFootwearProduct({
        title: "Lisboa Preto",
        productType: "",
        tags: [],
        handle: "lisboa-preto",
        collectionPath: "/collections/socas-e-mules",
        fromVerifiedFootwearCollection: true,
      }).decision,
    ).toBe("ACCEPT_FOOTWEAR");
  });

  it("excludes shipping protection and thermal tights", () => {
    expect(
      evaluateFootwearProduct({
        title: "Shipping Protection by Route",
        handle: "routeins",
        fromVerifiedFootwearCollection: true,
      }).decision,
    ).toBe("EXCLUDE_NON_FOOTWEAR");
    expect(
      evaluateFootwearProduct({
        title: "Sheer Illusion Thermal Tights Black",
        handle: "sheer-illusion-thermal-tights-black",
        fromVerifiedFootwearCollection: true,
      }).decision,
    ).toBe("EXCLUDE_NON_FOOTWEAR");
  });

  it("does not exclude belt sandals or cap-toe footwear", () => {
    expect(
      evaluateFootwearProduct({
        title: "Double Belt Sandal",
        handle: "double-belt-sandal",
        fromVerifiedFootwearCollection: true,
      }).decision,
    ).toBe("ACCEPT_FOOTWEAR");
    expect(
      evaluateFootwearProduct({
        title: "Cap Toe Oxford",
        handle: "cap-toe-oxford",
        fromVerifiedFootwearCollection: true,
      }).decision,
    ).toBe("ACCEPT_FOOTWEAR");
    expect(
      evaluateFootwearProduct({
        title: "Autry Windspin Suede Low-Top Sneakers",
        handle: "autry-windspin-suede-low-top-sneakers",
        fromVerifiedFootwearCollection: true,
      }).decision,
    ).toBe("ACCEPT_FOOTWEAR");
    expect(
      evaluateFootwearProduct({
        title: "Treasures Toe Ring Sandals",
        handle: "treasures-toe-ring-sandals",
        fromVerifiedFootwearCollection: true,
      }).decision,
    ).toBe("ACCEPT_FOOTWEAR");
    expect(
      evaluateFootwearProduct({
        title: "Broken Heel ankle sock boots",
        handle: "broken-heel-ankle-sock-boots",
        fromVerifiedFootwearCollection: true,
      }).decision,
    ).toBe("ACCEPT_FOOTWEAR");
  });

  it("does not treat Shopify collection: merchandising tags as product type", () => {
    expect(
      evaluateFootwearProduct({
        title: "Nappa over-the-knee boots bark",
        productType: "Shoes",
        tags: ["collection:FW26_womenswear", "collection:tote", "collection: New in"],
        handle: "nappa-over-the-knee-boots-bark",
        fromVerifiedFootwearCollection: true,
      }).decision,
    ).toBe("ACCEPT_FOOTWEAR");
  });

  it("Portuguese sapatilha + explicit ténis in title classifies as sneaker", () => {
    expect(
      evaluateFootwearProduct({
        title: "TÉNIS EXE RUNNER WHITE",
        productType: "Shoes",
        tags: ["SAPATILHAS E TÉNIS"],
        handle: "tenis-exe-runner-white",
        collectionPath: "/collections/sapatilhas-e-tenis",
        fromVerifiedFootwearCollection: true,
      }).category,
    ).toBe("SNEAKER");
  });

  it("true ballet / ballerina evidence stays ballerina", () => {
    expect(
      evaluateFootwearProduct({
        title: "Classic Ballet Flat",
        productType: "Flats",
        tags: ["BALLET FLATS"],
        handle: "classic-ballet-flat",
      }).category,
    ).toBe("BALLERINA");
  });

  it("hybrid ballerina sneaker stays sneaker", () => {
    expect(
      evaluateFootwearProduct({
        title: "Leather ballerina sneakers",
        productType: "Sneakers",
        handle: "leather-ballerina-sneakers",
        fromVerifiedFootwearCollection: true,
      }).category,
    ).toBe("SNEAKER");
  });

  it("ambiguous sapatilha in mixed tenis collection stays conservative OTHER", () => {
    expect(
      evaluateFootwearProduct({
        title: "SAPATILHA EXE 134-10 GREY/BLACK",
        productType: "Shoes",
        handle: "sapatilha-exe-134-10-grey-black",
        collectionPath: "/collections/sapatilhas-e-tenis",
        tags: ["SAPATILHAS E TÉNIS"],
        fromVerifiedFootwearCollection: true,
      }).category,
    ).toBe("OTHER_FOOTWEAR");
  });

  it("sapatilha alone without mixed tenis collection stays ballerina", () => {
    expect(
      evaluateFootwearProduct({
        title: "SAPATILHA CLASSICA NUDE",
        productType: "Shoes",
        handle: "sapatilha-classica-nude",
        collectionPath: "/collections/sapatilhas",
        fromVerifiedFootwearCollection: true,
      }).category,
    ).toBe("BALLERINA");
  });

  it("excludes confirmed clothing such as jumpers and hoodies", () => {
    expect(
      evaluateFootwearProduct({
        title: "Merino Lace Up Hem Jumper",
        handle: "lmk15m-0660-black-black",
      }).decision,
    ).toBe("EXCLUDE_NON_FOOTWEAR");
    expect(
      evaluateFootwearProduct({
        title: "Boxy Pony Kid Print Hoodie",
        handle: "5498p73c-m-1364-black",
      }).decision,
    ).toBe("EXCLUDE_NON_FOOTWEAR");
  });

  it("does not exclude merino footwear when title names a shoe silhouette", () => {
    expect(
      evaluateFootwearProduct({
        title: "Merino shearling mules",
        handle: "merino-shearling-mules",
      }).decision,
    ).not.toBe("EXCLUDE_NON_FOOTWEAR");
  });
});
