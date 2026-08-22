import { describe, expect, it } from "vitest";

import {
  collectZaraImageUrls,
  extractZaraCommercialComponents,
  parseZaraCategoryTree,
  selectZaraWomensFootwearCategories,
  zaraComponentToProduct,
  zaraProductUrl,
  type ZaraCategoryNode,
} from "../zara";

const VIEW_ALL: ZaraCategoryNode = {
  id: 2419160,
  name: "VIEW ALL",
  seoKeyword: "woman-shoes",
  seoCategoryId: 1251,
  path: ["WOMAN", "SHOES", "VIEW ALL"],
  subcategories: [],
};

describe("Zara women's footwear adapter", () => {
  it("builds a product URL from seo keyword and id", () => {
    expect(
      zaraProductUrl({ keyword: "leather-heel-shoes", seoProductId: "12345" }, 99),
    ).toBe("https://www.zara.com/us/en/leather-heel-shoes-p12345.html");
    expect(zaraProductUrl({ keyword: "", seoProductId: "1" })).toBeNull();
  });

  it("skips editorial components without a name", () => {
    const products = extractZaraCommercialComponents({
      productGroups: [
        {
          elements: [
            {
              type: "editorial",
              commercialComponents: [{ id: 1, name: "", seo: { keyword: "", irrelevant: true } }],
            },
            {
              type: "product",
              commercialComponents: [
                {
                  id: 2,
                  name: "LEATHER HIGH-HEEL SHOES",
                  familyName: "SHOES",
                  subfamilyName: "HIGH HEELS",
                  colorList: "Black | Burgundy",
                  seo: { keyword: "leather-high-heel-shoes", seoProductId: "322343252" },
                  xmedia: [
                    {
                      url: "https://static.zara.net/photos/example.jpg?w={width}",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    const mapped = products
      .map((component) => zaraComponentToProduct(component, VIEW_ALL, "2026-08-22T00:00:00.000Z"))
      .filter(Boolean);
    expect(mapped).toHaveLength(1);
    expect(mapped[0]?.productName).toBe("LEATHER HIGH-HEEL SHOES");
    expect(mapped[0]?.color).toBe("Black");
    expect(mapped[0]?.source).toBe("zara");
    expect(mapped[0]?.images?.[0]).toContain("w=1200");
  });

  it("selects woman shoes categories and excludes mixed bag merchandising", () => {
    const tree = parseZaraCategoryTree({
      categories: [
        {
          id: 1881757,
          name: "WOMAN",
          sectionName: "WOMAN",
          subcategories: [
            {
              id: 2642760,
              name: "SHOES | ACCESSORIES",
              subcategories: [
                {
                  id: 2419159,
                  name: "SHOES",
                  key: "I2024-MUJER-ZAPATOS",
                  seo: { keyword: "woman-shoes", seoCategoryId: 1251 },
                  subcategories: [
                    { id: 2419074, name: "BALLET FLATS", seo: { keyword: "woman-shoes-ballet-flats" } },
                    { id: 2541935, name: "SHOES | BAGS" },
                  ],
                },
              ],
            },
          ],
        },
        { id: 1885841, name: "MAN", sectionName: "MAN", subcategories: [{ id: 1, name: "SHOES" }] },
      ],
    });
    const selected = selectZaraWomensFootwearCategories(tree);
    expect(selected.some((item) => item.name === "SHOES")).toBe(true);
    expect(selected.some((item) => item.name === "BALLET FLATS")).toBe(true);
    expect(selected.some((item) => item.name === "SHOES | BAGS")).toBe(false);
    expect(selected.some((item) => item.path.includes("MAN"))).toBe(false);
  });

  it("collects nested xmedia image URLs", () => {
    expect(
      collectZaraImageUrls({
        xmedia: [{ layers: [{ url: "https://static.zara.net/a.jpg?w={width}" }, { url: "https://static.zara.net/b.svg" }] }],
      }),
    ).toEqual(["https://static.zara.net/a.jpg?w=1200"]);
  });

  it("collects listing images from detail.colors xmedia and deliveryUrl", () => {
    expect(
      collectZaraImageUrls({
        xmedia: [],
        detail: {
          colors: [
            {
              xmedia: [
                {
                  extraInfo: {
                    deliveryUrl:
                      "https://static.zara.net/assets/public/example/07001640251-a3.jpg?ts=1",
                  },
                },
              ],
            },
          ],
        },
      }),
    ).toEqual(["https://static.zara.net/assets/public/example/07001640251-a3.jpg?ts=1"]);
  });
});
