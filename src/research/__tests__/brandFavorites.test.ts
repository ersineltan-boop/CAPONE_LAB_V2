import { describe, expect, it, beforeEach } from "vitest";

import {
  BRAND_FAVORITE_STORAGE_KEY,
  getBrandFavoriteRepository,
  resetBrandFavoriteRepositoryForTests,
} from "../brandFavoritesRepository";
import { brandSummariesForIndex } from "../../catalog/brandIndexFromSummary";
import type { CatalogSummary } from "../../catalog/types";
import { countryGroupId } from "../../brands/countryGrouping";

const summary: CatalogSummary = {
  generatedAt: "2026-08-21T00:00:00.000Z",
  brands: [
    {
      brandId: "jeffrey-campbell",
      brandName: "JEFFREY CAMPBELL",
      country: "USA",
      productCount: 625,
      verifiedNewCount: 10,
      images: [],
    },
    {
      brandId: "the-row",
      brandName: "THE ROW",
      country: "Italy",
      productCount: 105,
      verifiedNewCount: 2,
      images: [],
    },
  ],
  marketplaces: [],
};

describe("brand favorites", () => {
  beforeEach(() => {
    resetBrandFavoriteRepositoryForTests();
  });

  it("saves and unsaves a brand without touching collector catalogs", () => {
    const repo = getBrandFavoriteRepository();
    repo.setSaved("jeffrey-campbell", true);
    expect(repo.isSaved("jeffrey-campbell")).toBe(true);
    repo.setSaved("jeffrey-campbell", false);
    expect(repo.isSaved("jeffrey-campbell")).toBe(false);
    expect(BRAND_FAVORITE_STORAGE_KEY).toBe("capone-lab-v2-brand-favorites-v1");
    expect(BRAND_FAVORITE_STORAGE_KEY.includes("brand-universe")).toBe(false);
    expect(BRAND_FAVORITE_STORAGE_KEY.includes("catalog")).toBe(false);
  });

  it("filters Kaydettiğim Markalar and intersects country", () => {
    const repo = getBrandFavoriteRepository();
    repo.setSaved("jeffrey-campbell", true);
    repo.setSaved("the-row", true);
    const saved = new Set(repo.getAll().map((item) => item.brandId));
    const italy = countryGroupId("Italy");
    const cards = brandSummariesForIndex(summary, italy).filter((card) => saved.has(card.brandId));
    expect(cards.map((card) => card.brandId)).toEqual(["the-row"]);
  });
});
