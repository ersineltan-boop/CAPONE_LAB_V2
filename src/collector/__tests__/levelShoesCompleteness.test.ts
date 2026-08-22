import { describe, expect, it } from "vitest";

import {
  extractMagentoFootwearCategoryUrls,
  identityFromLevelShoesSlug,
  parseLevelShoesListingHtml,
  extractStructuredBrand,
  parseNextDataJson,
  extractLevelShoesFootwearCategories,
  productsFromApolloState,
} from "../levelShoes";
import { mergeProductCatalog } from "../mergeProducts";
import { filterVerifiedNewForSource } from "../../source/sourceProductQuery";
import { enrichFamilyWithSightings } from "../../newArrivals/sourceSightings";
import type { ModelFamily } from "../../modelFamily/types";
import { createNotVerifiedNewness } from "../../newArrivals/newness";

const PAGE_ONE = `
  <a href="https://www.levelshoes.com/aquazzura-tequila-75-mules-white-leather-women-high-heels-rxyz7z.html">One</a>
  <img src="https://assets.levelshoes.com/media/catalog/product/a.jpg" />
`;

const PAGE_TWO = `
  <a href="https://www.levelshoes.com/tom-ford-padlock-pump-black-leather-women-high-heels-abcde1.html">Two</a>
  <a href="https://www.levelshoes.com/golden-goose-superstar-white-leather-women-sneakers-fghij2.html">Three</a>
`;

function family(overrides: Partial<ModelFamily> = {}): ModelFamily {
  return {
    modelFamilyId: "aquazzura--tequila",
    brand: "Aquazzura",
    canonicalName: "Tequila",
    category: "MULE",
    representativeProductId: "https://www.levelshoes.com/aquazzura-tequila.html",
    representativeImage: null,
    representativeImages: [],
    variantCount: 1,
    variants: [],
    allImages: [],
    sourceProductIds: ["https://www.levelshoes.com/aquazzura-tequila.html"],
    groupingConfidence: "HIGH",
    groupingReason: "test",
    ...overrides,
  };
}

describe("Level Shoes completeness", () => {
  it("parses Next.js listing JSON for brand, gallery, and source categories", () => {
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          menuCategories: [
            {
              name: "Women",
              webUrlKey: "women",
              children: [
                {
                  name: "Shoes",
                  webUrlKey: "women/shoes",
                  children: [
                    {
                      name: "Boots",
                      webUrlKey: "women/shoes/boots",
                      action: { url: "https://www.levelshoes.com/women/shoes/boots", type: "plp" },
                    },
                  ],
                },
              ],
            },
          ],
          __APOLLO_STATE__: {
            ROOT_QUERY: {
              "_productList:{}": {
                products: [
                  {
                    name: "Tequila 75 mules",
                    brandName: "Paris Texas",
                    action: {
                      url: "https://www.levelshoes.com/paris-texas-tequila-75-mules-white-leather-women-mules-rxyz7z.html",
                    },
                    imagePreviewGallery: [
                      { url: "https://assets.levelshoes.com/media/catalog/product/a_1.jpg" },
                      { url: "https://assets.levelshoes.com/media/catalog/product/a_2.jpg" },
                    ],
                    bottomBadges: [{ text: "NEW" }],
                  },
                ],
              },
            },
          },
        },
      },
    })}</script>`;
    const next = parseNextDataJson(html);
    const pageProps = (next?.props as { pageProps: Record<string, unknown> }).pageProps;
    expect(extractLevelShoesFootwearCategories(pageProps.menuCategories)).toEqual([
      { url: "https://www.levelshoes.com/women/shoes/boots", name: "Boots" },
    ]);
    const products = productsFromApolloState(
      pageProps.__APOLLO_STATE__ as Record<string, unknown>,
      "https://www.levelshoes.com/women/shoes/boots",
      "2026-08-21T00:00:00.000Z",
    );
    expect(products).toHaveLength(1);
    expect(products[0]?.brand).toBe("Paris Texas");
    expect(products[0]?.images.length).toBe(2);
    expect(products[0]?.hasNewBadge).toBe(true);
  });
  it("adds later-page products instead of stopping at page one", () => {
    const first = parseLevelShoesListingHtml(
      PAGE_ONE,
      "https://www.levelshoes.com/women/shoes.html",
      "2026-08-21T00:00:00.000Z",
    );
    const second = parseLevelShoesListingHtml(
      PAGE_TWO,
      "https://www.levelshoes.com/women/shoes.html?p=2",
      "2026-08-21T00:00:00.000Z",
    );
    const merged = mergeProductCatalog(first, second);
    expect(first.length).toBeGreaterThan(0);
    expect(merged.length).toBeGreaterThan(first.length);
  });

  it("extracts Magento footwear categories from live-style links", () => {
    const html = `
      <a href="https://www.levelshoes.com/women/shoes.html">Shoes</a>
      <a href="https://www.levelshoes.com/women/shoes/boots.html">Boots</a>
      <a href="https://www.levelshoes.com/women/shoes/sandals.html">Sandals</a>
      <a href="https://www.levelshoes.com/women/shoes/new.html">New</a>
    `;
    expect(extractMagentoFootwearCategoryUrls(html, "https://www.levelshoes.com/women/shoes.html")).toEqual(
      expect.arrayContaining([
        { url: "https://www.levelshoes.com/women/shoes/boots.html", name: "Boots" },
        { url: "https://www.levelshoes.com/women/shoes/sandals.html", name: "Sandals" },
      ]),
    );
  });

  it("prefers structured brand data over slug tokens", () => {
    const html = `<div itemprop="brand" content="Paris Texas"></div>`;
    expect(extractStructuredBrand(html)).toBe("Paris Texas");
    expect(identityFromLevelShoesSlug("paris-texas-nicole-women-sandals-abcde.html").brand).toBe(
      "Paris Texas",
    );
  });

  it("rejects truncated slug brands such as Tom, Golden, Paris, Agni", () => {
    expect(identityFromLevelShoesSlug("tom-ford-padlock-women-pumps-abcde.html").brand).toBe("Tom Ford");
    expect(identityFromLevelShoesSlug("golden-goose-superstar-women-sneakers-fghij.html").brand).toBe(
      "Golden Goose",
    );
    expect(identityFromLevelShoesSlug("tom-mystery-women-mules-zzzzz.html").brand).toBe("Unknown");
    expect(identityFromLevelShoesSlug("agni-unknown-women-sandals-yyyyy.html").brand).toBe("Unknown");
  });

  it("does not duplicate a product that belongs to two Level Shoes categories", () => {
    const shoes = parseLevelShoesListingHtml(
      PAGE_ONE,
      "https://www.levelshoes.com/women/shoes.html",
      "2026-08-21T00:00:00.000Z",
    );
    const mules = parseLevelShoesListingHtml(
      PAGE_ONE,
      "https://www.levelshoes.com/women/shoes/mules.html",
      "2026-08-21T00:00:00.000Z",
    );
    const merged = mergeProductCatalog(shoes, mules);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.sourceCategories?.map((item) => item.categoryName).sort()).toEqual(
      expect.arrayContaining(["Mules", "Shoes"]),
    );
  });

  it("does not treat firstSeen as New, but a real New collection does", () => {
    const products = [
      {
        productUrl: "https://www.levelshoes.com/aquazzura-tequila.html",
        source: "level-shoes",
        brand: "Aquazzura",
        productName: "Tequila",
        discoveredAt: "2026-08-21T00:00:00.000Z",
        isNewArrivalsCollection: false,
        sourceCategories: [],
      },
    ];
    const notNew = enrichFamilyWithSightings(family(), products as never);
    expect(notNew.sourceSightings?.some((item) => item.newness?.status === "VERIFIED_NEW")).toBe(false);

    const verified = enrichFamilyWithSightings(
      family({
        sourceSightings: [
          {
            sourceId: "level-shoes",
            sourceLabel: "Level Shoes",
            sourceKind: "LUXURY_MARKETPLACE",
            firstSeenAt: "2026-08-01T00:00:00.000Z",
            lastSeenAt: "2026-08-21T00:00:00.000Z",
            newness: createNotVerifiedNewness(),
          },
        ],
      }),
      [
        {
          ...products[0],
          isNewArrivalsCollection: true,
          collectionPath: "/women/shoes/new.html",
          sourceCategoryName: "New In",
        },
      ] as never,
    );
    const asFamily = family({ ...verified });
    expect(filterVerifiedNewForSource([asFamily], "level-shoes").length).toBeGreaterThan(0);
  });
});
