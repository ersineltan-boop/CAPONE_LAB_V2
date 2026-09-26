import { describe, expect, it } from "vitest";

import { PRIMARY_NAV_ITEMS, isPrimaryNavView } from "../primaryNav";
import { buildNavigationSearch, parseNavigationFromSearch } from "../appNavigation";
import { PAZAR_OZETI_ENABLED } from "../../components/visualWall/visualWallSections";

describe("appNavigation", () => {
  it("defaults to brands view", () => {
    const state = parseNavigationFromSearch("");
    expect(state.view).toBe("brands");
  });

  it("parses brand detail navigation", () => {
    const state = parseNavigationFromSearch("?view=brands&brand=ugg&brandName=UGG");
    expect(state.view).toBe("brands");
    expect(state.brandId).toBe("ugg");
    expect(state.brandName).toBe("UGG");
  });

  it("builds marketplace detail search", () => {
    expect(
      buildNavigationSearch({
        view: "marketplaces",
        brandId: null,
        brandName: null,
        marketplaceId: "mytheresa",
        sourceCategoryId: null,
        marketCountryId: null,
        marketBrandId: null,
      }),
    ).toBe("?view=marketplaces&marketplace=mytheresa");
  });

  it("parses market research brand navigation without using Product Research params", () => {
    const state = parseNavigationFromSearch("?view=market-research&mrBrand=mr-ro-botta");
    expect(state.view).toBe("market-research");
    expect(state.marketCountryId).toBe("romania");
    expect(state.marketBrandId).toBe("mr-ro-botta");
    expect(state.brandId).toBeNull();
    expect(state.marketplaceId).toBeNull();
  });

  it("builds market research search with isolated mrBrand param", () => {
    expect(
      buildNavigationSearch({
        view: "market-research",
        brandId: null,
        brandName: null,
        marketplaceId: null,
        sourceCategoryId: null,
        marketCountryId: "romania",
        marketBrandId: "mr-ro-il-passo",
      }),
    ).toBe("?view=market-research&mrBrand=mr-ro-il-passo");
  });
});

describe("primary navigation", () => {
  it("exposes catalog, automation, visual and saved navigation", () => {
    expect(PRIMARY_NAV_ITEMS.map((item) => item.label)).toEqual([
      "MARKALAR",
      "PAZARYERLERİ",
      "OTOMATİK YÜKLEME",
      "VISUAL",
      "KAYDETTİKLERİM",
    ]);
    expect(PRIMARY_NAV_ITEMS.some((item) => item.id === "market-research")).toBe(false);
    expect(PRIMARY_NAV_ITEMS.some((item) => item.id === "visual-wall")).toBe(true);
    expect(isPrimaryNavView("visual-wall")).toBe(true);
  });

  it("keeps the visual-wall route parseable", () => {
    expect(parseNavigationFromSearch("?view=visual-wall").view).toBe("visual-wall");
  });

  it("keeps the automatic brand loading route parseable", () => {
    expect(parseNavigationFromSearch("?view=brand-automation").view).toBe("brand-automation");
  });

  it("does not expose Pazar Özeti on Visual", () => {
    expect(PAZAR_OZETI_ENABLED).toBe(false);
  });
});
