import { describe, expect, it } from "vitest";

import { evaluateFootwearProduct } from "../footwearGate";
import { shopifyProductToPilot } from "../shopify";
import { isWomensFootwearCollection } from "../shopifyCollectionFilter";
import {
  evaluateTotemeFootwearProduct,
  isTotemeAuditCollection,
  isTotemeFootwearCollection,
} from "../totemeFootwear";
import type { PilotSourceConfig } from "../types";

const totemeConfig: PilotSourceConfig = {
  id: "toteme",
  brand: "TOTEME",
  baseUrl: "https://toteme.com",
  collectionPaths: [],
  verifiedFootwearPaths: ["/collections/shoes-boots"],
  maxProducts: 30,
  collectMode: "full",
};

describe("Toteme footwear collections", () => {
  it("crawls verified shoe collections and skips mixed RTW", () => {
    expect(isTotemeFootwearCollection("shoes-boots", "Boots")).toBe(true);
    expect(isTotemeFootwearCollection("shoes-pumps-mules", "Pumps & Mules")).toBe(true);
    expect(isTotemeFootwearCollection("shoes-flats", "Flats")).toBe(true);
    expect(isTotemeFootwearCollection("shoes", "Shoes")).toBe(true);
    expect(isTotemeFootwearCollection("fall-boots", "Fall boots")).toBe(true);
    expect(isTotemeFootwearCollection("new-season", "FW26")).toBe(false);
    expect(isTotemeFootwearCollection("new-in", "New In")).toBe(false);
    expect(isTotemeFootwearCollection("garderob-shoes-accessories", "Shoes & Accessories")).toBe(
      false,
    );
    expect(isTotemeFootwearCollection("men-shoes", "Shoes")).toBe(false);
    expect(isTotemeAuditCollection("new-season", "FW26")).toBe(true);
    expect(isTotemeAuditCollection("new-in", "New In")).toBe(true);
  });
});

describe("Toteme product gate", () => {
  it("rejects apparel even from a verified shoe collection or New In", () => {
    const dress = evaluateTotemeFootwearProduct({
      title: "Slouch waist dress",
      productType: "Dress",
      tags: ["collection:shoes-boots", "Dresses"],
      handle: "slouch-waist-dress",
      collectionPath: "/collections/shoes-boots",
      fromVerifiedFootwearCollection: true,
    });
    expect(dress.decision).toBe("EXCLUDE_NON_FOOTWEAR");
    expect(dress.matchedSignals.some((signal) => signal.includes("apparel"))).toBe(true);

    const knit = evaluateTotemeFootwearProduct({
      title: "Classic alpaca crew knit pale blue",
      productType: "Knitwear",
      tags: ["collection:new-season"],
      handle: "classic-alpaca-crew-knit-pale-blue",
      collectionPath: "/collections/new-season",
      fromVerifiedFootwearCollection: true,
    });
    expect(knit.decision).toBe("EXCLUDE_NON_FOOTWEAR");

    const coat = shopifyProductToPilot(
      {
        id: 1,
        title: "Wool coat",
        handle: "wool-coat",
        product_type: "Coats",
        tags: ["collection:shoes-boots"],
      },
      totemeConfig,
      "2026-08-22T00:00:00.000Z",
      "/collections/new-in",
    );
    expect(coat).toBeNull();
  });

  it("rejects bags and non-footwear accessories, including unknown accessories", () => {
    expect(
      evaluateTotemeFootwearProduct({
        title: "Classic croco bag black",
        productType: "Bags",
        tags: ["collection:shoes-boots"],
        handle: "classic-croco-bag-black",
        collectionPath: "/collections/shoes-boots",
        fromVerifiedFootwearCollection: true,
      }).decision,
    ).toBe("EXCLUDE_NON_FOOTWEAR");

    expect(
      evaluateTotemeFootwearProduct({
        title: "Soft nappa tote",
        productType: "Tote",
        tags: [],
        handle: "soft-nappa-tote",
        fromVerifiedFootwearCollection: true,
      }).matchedSignals.some((signal) => signal.includes("bag")),
    ).toBe(true);

    expect(
      evaluateTotemeFootwearProduct({
        title: "Croco embossed passport holder black",
        productType: "Accessories",
        tags: ["collection:garderob-shoes-accessories"],
        handle: "croco-embossed-passport-holder-black",
        collectionPath: "/collections/garderob-shoes-accessories",
        fromVerifiedFootwearCollection: true,
      }).decision,
    ).toBe("EXCLUDE_NON_FOOTWEAR");

    expect(
      evaluateTotemeFootwearProduct({
        title: "The Object",
        productType: "",
        tags: ["collection:new-season"],
        handle: "the-object",
        collectionPath: "/collections/new-season",
        fromVerifiedFootwearCollection: true,
      }).decision,
    ).toBe("EXCLUDE_UNCERTAIN_PRODUCT_TYPE");
  });

  it("accepts legitimate footwear from the authoritative Shoes collection without type/title keywords", () => {
    const city = evaluateTotemeFootwearProduct({
      title: "The City",
      productType: "",
      tags: [],
      handle: "the-city",
      collectionPath: "/collections/shoes",
      fromVerifiedFootwearCollection: true,
    });
    expect(city.decision).toBe("ACCEPT_FOOTWEAR");
    expect(city.validationMethod).toBe("VERIFIED_FOOTWEAR_COLLECTION");

    expect(
      evaluateTotemeFootwearProduct({
        title: "The City",
        productType: "",
        tags: [],
        handle: "the-city",
        collectionPath: "/collections/new-season",
      }).decision,
    ).not.toBe("ACCEPT_FOOTWEAR");
  });

  it("still rejects apparel and bags even inside /collections/shoes", () => {
    expect(
      evaluateTotemeFootwearProduct({
        title: "Slouch waist dress",
        productType: "Dress",
        handle: "slouch-waist-dress",
        collectionPath: "/collections/shoes",
        fromVerifiedFootwearCollection: true,
      }).decision,
    ).toBe("EXCLUDE_NON_FOOTWEAR");
    expect(
      evaluateTotemeFootwearProduct({
        title: "Classic croco bag black",
        productType: "Bags",
        handle: "classic-croco-bag-black",
        collectionPath: "/collections/shoes",
        fromVerifiedFootwearCollection: true,
      }).decision,
    ).toBe("EXCLUDE_NON_FOOTWEAR");
  });

  it("retains real Toteme footwear with product_type or title evidence", () => {
    const boots = evaluateTotemeFootwearProduct({
      title: "Nappa over-the-knee boots bark",
      productType: "Shoes",
      tags: ["collection:new-season"],
      handle: "nappa-over-the-knee-boots-bark",
      collectionPath: "/collections/shoes-boots",
    });
    expect(boots.decision).toBe("ACCEPT_FOOTWEAR");
    expect(boots.category).toBe("BOOT");

    const pumps = shopifyProductToPilot(
      {
        id: 2,
        title: "Classic croco-embossed slingbacks dark brown",
        handle: "classic-croco-embossed-slingbacks-dark-brown-1",
        product_type: "Shoes",
        tags: ["Slingbacks"],
      },
      totemeConfig,
      "2026-08-22T00:00:00.000Z",
      "/collections/shoes-pumps-mules",
    );
    expect(pumps?.category).toBe("SLINGBACK");

    const flats = evaluateTotemeFootwearProduct({
      title: "Soft nappa ballerinas black",
      productType: "Shoes",
      handle: "soft-nappa-ballerinas-black",
      collectionPath: "/collections/shoes-flats",
    });
    expect(flats.decision).toBe("ACCEPT_FOOTWEAR");
  });
});

describe("generic mixed-catalog defenses used by Toteme", () => {
  it("does not treat generic New In as a women's footwear collection", () => {
    expect(isWomensFootwearCollection("new-in", "New In")).toBe(false);
    expect(isWomensFootwearCollection("new-season", "FW26")).toBe(false);
    expect(isWomensFootwearCollection("shoes-boots", "Boots")).toBe(true);
  });

  it("does not treat Shopify collection merchandising tags as footwear evidence", () => {
    expect(
      evaluateFootwearProduct({
        title: "The Object",
        productType: "",
        tags: ["collection:shoes-boots"],
        handle: "the-object",
      }).decision,
    ).toBe("EXCLUDE_UNCERTAIN_PRODUCT_TYPE");
  });
});
