import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  collectFreePeople,
  extractFreePeopleStyleNumber,
  isFreePeopleAntiBot,
  isFreePeopleNonFootwear,
  parseFreePeopleJsonLd,
  parseFreePeoplePiniaCategory,
  type FreePeopleCategoryState,
} from "../freePeople";
import {
  extractSourceIdentity,
  listingIdentityKey,
  sourceChannelOf,
} from "../../modelFamily/sourceIdentity";
import { buildModelFamilies } from "../../modelFamily/buildFamilies";
import type { RawAnalyzedProduct } from "../../modelFamily/types";

const FIXTURE = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures/free-people-pinia-category.json"), "utf-8"),
) as FreePeopleCategoryState;

function analyzed(
  overrides: Partial<RawAnalyzedProduct> & { brand: string; productUrl: string; productName: string },
): RawAnalyzedProduct {
  return {
    source: "jeffrey-campbell",
    category: "SNEAKER",
    color: "Black",
    material: "Leather",
    imageUrl: "https://example.com/a.jpg",
    discoveredAt: "2026-08-24T00:00:00.000Z",
    cleaned: { color: "Black", heelHeight: null },
    normalized: {
      category: "SNEAKER",
      colorFamily: "BLACK",
      materialFamily: "LEATHER",
      heelType: "FLAT",
      heelHeightGroup: "LOW",
      toeShape: "ROUND",
      details: [],
      construction: ["CLOSED_TOE"],
    },
    ...overrides,
  };
}

describe("Free People anti-bot probe", () => {
  it("treats Akamai 403 interstitials as anti-bot", () => {
    expect(isFreePeopleAntiBot(403, '<html><div id="cmsg"></div></html>')).toBe(true);
    expect(isFreePeopleAntiBot(200, "<html>" + "product".repeat(400) + "</html>")).toBe(false);
  });

  it("does not collect into production from the default collectFreePeople entry", async () => {
    const result = await collectFreePeople();
    expect(result.products).toEqual([]);
    expect(result.blocker).toMatch(/staging-only/i);
  });
});

describe("Free People Pinia retailer parser", () => {
  const parsed = parseFreePeoplePiniaCategory(FIXTURE, {
    discoveredAt: "2026-08-24T00:00:00.000Z",
  });

  it("keeps listed retailer brands and does not map them to FREE PEOPLE", () => {
    const brands = parsed.products.map((product) => product.brand).sort();
    expect(brands).toContain("Birkenstock");
    expect(brands).toContain("UGG");
    expect(brands).toContain("We The Free");
    expect(brands).toContain("FP Collection");
    expect(brands).toContain("Jeffrey Campbell");
    expect(brands.every((brand) => brand !== "FREE PEOPLE")).toBe(true);
    expect(parsed.products.every((product) => product.source === "free-people")).toBe(true);
  });

  it("dedupes color tiles of the same style and keeps gallery images", () => {
    const birk = parsed.products.find((product) => product.brand === "Birkenstock");
    expect(birk).toBeTruthy();
    expect(birk!.variants.map((variant) => variant.color)).toEqual(
      expect.arrayContaining(["Charcoal", "Taupe", "Pure Sage"]),
    );
    expect(birk!.images?.length).toBeGreaterThanOrEqual(3);
    expect(parsed.stats.duplicateCount).toBeGreaterThan(0);
  });

  it("rejects socks, tights, and editorial tiles", () => {
    expect(parsed.products.some((product) => /sock|tights/i.test(product.productName))).toBe(false);
    expect(parsed.stats.nonFootwearRejected).toBeGreaterThanOrEqual(2);
    expect(parsed.stats.editorialSkipped).toBeGreaterThanOrEqual(1);
  });

  it("keeps high-top sneakers that the global bag/top gate would otherwise drop", () => {
    expect(isFreePeopleNonFootwear("Jeffrey Campbell High-Top Sneakers", "jeffrey-campbell-high-top-sneakers")).toBe(
      false,
    );
    expect(parsed.products.some((product) => product.brand === "Jeffrey Campbell")).toBe(true);
  });

  it("parses JSON-LD ItemList brands when Pinia is missing", () => {
    const html = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "fixtures/free-people-itemlist.jsonld.html"),
      "utf-8",
    );
    const jsonLd = parseFreePeopleJsonLd(html);
    expect(jsonLd.products).toHaveLength(1);
    expect(jsonLd.products[0]?.brand).toBe("UGG");
    expect(jsonLd.products[0]?.source).toBe("free-people");
  });

  it("keeps listed prices on Pinia tiles", () => {
    expect(parsed.products.find((product) => product.brand === "UGG")?.details).toMatch(/price=150/);
  });

  it("recovers face color from Scene7 image code when faceOutColorCode is blank", () => {
    const salomon = parsed.products.find((product) => product.brand === "Salomon");
    expect(salomon).toBeTruthy();
    expect(salomon!.color).toBe("Vanilla Ice / Ftw Silver");
    expect(salomon!.productUrl).toContain("color=053");
    expect(salomon!.details).toMatch(/colorSource=pinia-slice/);
    expect(salomon!.details).toMatch(/colorCode=053/);
    expect(parsed.stats.colorEmpty).toBe(0);
    expect(parsed.stats.colorFromPiniaSlice).toBeGreaterThanOrEqual(1);
  });
});

describe("Free People marketplace identity", () => {
  it("keys Free People listings by style number and marketplace channel", () => {
    const product = analyzed({
      source: "free-people",
      brand: "Jeffrey Campbell",
      productName: "High-Top Sneakers",
      productUrl: "https://www.freepeople.com/shop/jeffrey-campbell-high-top-sneakers/?color=001",
      imageUrl: "https://images.urbndata.com/is/image/FreePeople/104131586_001_a",
      variants: [{ sku: "104131586_001", color: "White" }],
    });
    expect(extractFreePeopleStyleNumber({ sku: "104131586_001" })).toBe("104131586");
    expect(listingIdentityKey(product)).toBe("free-people:104131586");
    expect(sourceChannelOf("free-people")).toBe("MARKETPLACE");
    expect(extractSourceIdentity(product).kind).toBe("FREE_PEOPLE_STYLE_NUMBER");
  });

  it("does not merge Free People tiles into an official brand family with the same style code", () => {
    const official = analyzed({
      source: "jeffrey-campbell",
      brand: "Jeffrey Campbell",
      productName: "High-Top Sneakers",
      productUrl: "https://jeffreycampbell.com/products/high-top-sneakers",
      variants: [{ sku: "104131586-BLK", color: "Black" }],
    });
    const retailer = analyzed({
      source: "free-people",
      brand: "Jeffrey Campbell",
      productName: "High-Top Sneakers",
      productUrl: "https://www.freepeople.com/shop/jeffrey-campbell-high-top-sneakers/?color=001",
      variants: [{ sku: "104131586_001", color: "White" }],
    });
    const { families } = buildModelFamilies([official, retailer]);
    expect(families).toHaveLength(2);
    expect(families.some((family) => family.sourceProductIds.length === 2)).toBe(false);
  });
});
