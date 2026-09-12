import { describe, expect, it } from "vitest";

import { liveProductResearchBrandIds } from "../../operator/policies/domains";
import { originCountryIsNotSalesMarket } from "../../operator/policies";
import { productResearchPrimaryNavIds } from "../../operator/constants";
import { PRIMARY_NAV_ITEMS } from "../../navigation/primaryNav";
import { parseNavigationFromSearch } from "../../navigation/appNavigation";
import { canGroupMarketResearchVariants, marketResearchModelsAreDistinct } from "../grouping";
import {
  assertNoProductResearchLeak,
  findRomaniaBrand,
  getRomaniaCatalog,
  romaniaBrandCards,
  romaniaExcludedNames,
  romaniaRetailerIds,
  visibleRomaniaBrands,
} from "../romania/catalog";
import {
  ADDITIONAL_ROMANIA_BRAND_IDS,
  POLISH_SOLD_IN_ROMANIA_BRAND_IDS,
  ROMANIA_ORIGIN_BRAND_IDS,
  ROMANIA_VISIBLE_BRAND_IDS,
} from "../romania/scope";
import { isUsableMarketResearchImage } from "../images";

describe("Romania market research catalog", () => {
  const catalog = getRomaniaCatalog();
  const brands = visibleRomaniaBrands(catalog);
  const cards = romaniaBrandCards(catalog);

  it("exposes the scoped Romania brand set and hides excluded names", () => {
    expect(brands.map((brand) => brand.id).sort()).toEqual([...ROMANIA_VISIBLE_BRAND_IDS].sort());
    expect(cards.map((card) => card.name)).toEqual([
      "IL PASSO",
      "Musette",
      "EPICA",
      "Marelbo",
      "Papucei",
      "Mihaela Glavan",
      "GRYXX",
      "Wojas",
      "Badura",
      "Gino Rossi",
      "Lasocki",
      "ALDO",
      "Botta",
      "Flavia Passini",
    ]);
    expect(romaniaExcludedNames(catalog)).toEqual(
      expect.arrayContaining(["Anna Cori", "OTTER", "Benvenuti", "Enzo Bertini", "EXÉ", "Tsakiris Mallas", "SANTE"]),
    );
    expect(cards.some((card) => /anna cori|otter|benvenuti|enzo|exé|tsakiris|sante/i.test(card.name))).toBe(
      false,
    );
  });

  it("keeps originCountry separate from the Romania sales market", () => {
    for (const id of ROMANIA_ORIGIN_BRAND_IDS) {
      expect(findRomaniaBrand(id)?.originCountry).toBe("RO");
    }
    for (const id of POLISH_SOLD_IN_ROMANIA_BRAND_IDS) {
      const brand = findRomaniaBrand(id);
      expect(brand?.originCountry).toBe("PL");
      expect(brand?.salesMarket).toBe("RO");
      expect(originCountryIsNotSalesMarket(brand?.originCountry, brand?.markets ?? [])).toBe(true);
    }
    expect(findRomaniaBrand("mr-ro-aldo")?.originCountry).toBe("CA");
    expect(findRomaniaBrand("mr-ro-botta")?.originCountry).toBe("RO");
    for (const id of ADDITIONAL_ROMANIA_BRAND_IDS) {
      expect(findRomaniaBrand(id)?.salesMarket).toBe("RO");
    }
  });

  it("does not treat retailers as brand cards", () => {
    expect(romaniaRetailerIds(catalog)).toEqual(expect.arrayContaining(["otter", "tezyo", "ccc-romania"]));
    expect(cards.some((card) => card.id === "otter")).toBe(false);
    expect(catalog.retailers.every((entry) => entry.showAsBrandCard === false)).toBe(true);
  });

  it("does not leak into Product Research registries or nav", () => {
    expect(() => assertNoProductResearchLeak(catalog)).not.toThrow();
    const productIds = liveProductResearchBrandIds();
    for (const brand of brands) {
      expect(productIds).not.toContain(brand.id);
    }
    expect(productResearchPrimaryNavIds()).toEqual(["brands", "marketplaces", "visual-wall"]);
    expect(PRIMARY_NAV_ITEMS.some((item) => item.id === "market-research")).toBe(true);
    expect(parseNavigationFromSearch("?view=market-research").brandId).toBeNull();
  });

  it("keeps distinct model versions separate and groups only same-name colors", () => {
    expect(marketResearchModelsAreDistinct("TESS", "TESS I")).toBe(true);
    expect(marketResearchModelsAreDistinct("TIJUANA", "TIJUANA I")).toBe(true);

    const ilPasso = findRomaniaBrand("mr-ro-il-passo")!;
    expect(ilPasso.models.map((model) => model.name)).toEqual(
      expect.arrayContaining(["TESS", "TESS I", "TIJUANA", "TIJUANA I"]),
    );
    const musette = findRomaniaBrand("mr-ro-musette")!;
    expect(musette.models.map((model) => model.name)).toEqual(
      expect.arrayContaining(["ELLA A126", "ELLA A253"]),
    );
    const glavan = findRomaniaBrand("mr-ro-mihaela-glavan")!;
    expect(glavan.models.map((model) => model.name)).toEqual(
      expect.arrayContaining(["Dandy Star", "Dandy Star B&W"]),
    );

    const grouped = canGroupMarketResearchVariants(
      { normalizedModelName: "6086", color: "Negru" },
      { normalizedModelName: "6086", color: "Crem" },
    );
    expect(grouped.merge).toBe(true);

    const marelbo = findRomaniaBrand("mr-ro-marelbo")!;
    const model6086 = marelbo.models.find((model) => model.name === "6086");
    expect(model6086?.variants.map((variant) => variant.color)).toEqual(["Capucino", "Negru", "Crem"]);
  });

  it("does not carry score or CAPONE fit fields", () => {
    const serialized = JSON.stringify(catalog);
    expect(serialized).not.toMatch(/"score"|"fitScore"|"rating"|"caponeFit"/i);
  });

  it("supports price, currency and observedAt on product cards", () => {
    const aldo = findRomaniaBrand("mr-ro-aldo")!;
    const stessy = aldo.models.find((model) => model.name === "STESSYLOW 121")?.variants[0];
    expect(stessy?.currentPrice).toBe(299);
    expect(stessy?.listPrice).toBe(499);
    expect(stessy?.currency).toBe("RON");
    expect(stessy?.discountPercent).toBe(40);
    expect(stessy?.observedAt).toBe(catalog.observedAt);

    const papucei = findRomaniaBrand("mr-ro-papucei")!;
    expect(papucei.models[0]?.variants[0]?.currency).toBe("EUR");
  });

  it("rejects logo and badge images", () => {
    expect(isUsableMarketResearchImage("https://cdn.otter.ro/media/logo/stores/3/gryxx_logo.png")).toBe(
      false,
    );
    expect(
      isUsableMarketResearchImage(
        "https://cdn.otter.ro/media/catalog/product/cache/7eb369f27775f2db92648609527c34e5/6/d/6dde0b2f.jpg",
      ),
    ).toBe(true);
  });
});
