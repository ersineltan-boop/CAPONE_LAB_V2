import { describe, expect, it } from "vitest";

import type { PilotProduct } from "../types";
import { validateFreePeopleStaging } from "../validateFreePeopleStaging";

function stagingProduct(
  overrides: Partial<PilotProduct> & { sku?: string } = {},
): PilotProduct {
  const sku = overrides.sku ?? "108576950_023";
  return {
    source: overrides.source ?? "free-people",
    brand: overrides.brand ?? "Birkenstock",
    productName: overrides.productName ?? "Amsterdam Wrapped Clogs",
    productUrl:
      overrides.productUrl ??
      `https://www.freepeople.com/shop/${sku.replace("_", "-")}/?color=023`,
    imageUrl: overrides.imageUrl ?? `https://images.urbndata.com/is/image/FreePeople/${sku}_a`,
    images: overrides.images ?? [`https://images.urbndata.com/is/image/FreePeople/${sku}_a`],
    category: "MULE",
    color: overrides.color ?? "Taupe",
    material: null,
    toeShape: null,
    heelType: null,
    heelHeight: null,
    details: overrides.details ?? "price=100 colorSource=pinia-slice",
    discoveredAt: "2026-09-12T00:00:00.000Z",
    variants: overrides.variants ?? [{ title: "Clogs", color: "Taupe", sku }],
    ...overrides,
  };
}

describe("validateFreePeopleStaging", () => {
  it("does not require the historical 1075 product or 134 brand snapshot", () => {
    const products = [
      stagingProduct({ sku: "108576950_023", brand: "Birkenstock" }),
      stagingProduct({ sku: "90404021_022", brand: "Jeffrey Campbell" }),
      stagingProduct({ sku: "111222333_001", brand: "UGG" }),
    ];
    expect(products).toHaveLength(3);
    expect(new Set(products.map((item) => item.brand)).size).toBe(3);
    expect(validateFreePeopleStaging(products)).toEqual([]);
  });

  it("allows a healthy catalog whose counts changed from a previous collection", () => {
    const products = Array.from({ length: 40 }, (_, index) =>
      stagingProduct({
        sku: `${200000000 + index}_001`,
        brand: index % 2 === 0 ? "Birkenstock" : "UGG",
      }),
    );
    expect(products).not.toHaveLength(1075);
    expect(new Set(products.map((item) => item.brand)).size).not.toBe(134);
    expect(validateFreePeopleStaging(products)).toEqual([]);
  });

  it("blocks zero or invalid staging", () => {
    expect(validateFreePeopleStaging([])).toContain("staging product count must be greater than 0");
    expect(validateFreePeopleStaging([stagingProduct({ source: "farfetch" })]).some((item) =>
      item.includes("non free-people"),
    )).toBe(true);
    expect(validateFreePeopleStaging([stagingProduct({ brand: "" })]).some((item) =>
      /empty brands|at least one brand/.test(item),
    )).toBe(true);
  });

  it("blocks duplicate Free People identities", () => {
    const first = stagingProduct({ sku: "108576950_023", brand: "Birkenstock" });
    const duplicate = stagingProduct({
      sku: "108576950_023",
      brand: "UGG",
      productUrl: "https://www.freepeople.com/shop/other-listing/?color=001",
    });
    const errors = validateFreePeopleStaging([first, duplicate]);
    expect(errors.some((item) => item.includes("duplicate identities"))).toBe(true);
  });

  it("blocks missing identities and house-brand mapping", () => {
    const missingIdentity = stagingProduct({
      sku: "no-style",
      variants: [{ title: "x", color: "Black", sku: "abc" }],
      imageUrl: "https://example.com/no-style.jpg",
      images: ["https://example.com/no-style.jpg"],
      productUrl: "https://example.com/not-free-people",
    });
    expect(validateFreePeopleStaging([missingIdentity]).some((item) => item.includes("identity"))).toBe(
      true,
    );
    expect(
      validateFreePeopleStaging([stagingProduct({ brand: "FREE PEOPLE" })]).some((item) =>
        item.includes("FREE PEOPLE brand"),
      ),
    ).toBe(true);
  });
});
