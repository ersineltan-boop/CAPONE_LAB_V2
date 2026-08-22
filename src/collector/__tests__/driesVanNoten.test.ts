import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  discoverDriesWomensFootwearCollections,
  driesPilotConfig,
  isDriesMensCollection,
  isDriesWomensFootwearCollection,
  isDriesWomensFootwearProduct,
  mapDriesProductToPilot,
  parseDriesCollectionsJson,
  parseDriesProductsJson,
  sanitizeDriesProductForFootwearGate,
  DRIES_WOMEN_SHOES_PATH,
} from "../driesVanNoten";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("Dries Van Noten adapter", () => {
  const collections = parseDriesCollectionsJson(
    JSON.parse(readFileSync(join(fixtures, "dries-collections.json"), "utf-8")),
  );
  const products = parseDriesProductsJson(
    JSON.parse(readFileSync(join(fixtures, "dries-products.json"), "utf-8")),
  );
  const config = driesPilotConfig();
  const womenShoes = collections.find((item) => item.handle === "women-shoes")!;

  it("detects the women's footwear root and ignores empty/generic shoes plus menswear", () => {
    expect(DRIES_WOMEN_SHOES_PATH).toBe("/collections/women-shoes");
    expect(isDriesWomensFootwearCollection({ handle: "women-shoes", title: "Women's Shoes" })).toBe(
      true,
    );
    expect(isDriesMensCollection({ handle: "men-shoes", title: "Men's Shoes" })).toBe(true);
    expect(isDriesWomensFootwearCollection({ handle: "shoes", title: "Shoes" })).toBe(false);
    expect(isDriesWomensFootwearCollection({ handle: "women-dresses", title: "Women's Dresses" })).toBe(
      false,
    );
    const discovered = discoverDriesWomensFootwearCollections(collections);
    expect(discovered.map((item) => item.handle)).toEqual([
      "women-shoes",
      "sneakers",
      "new-arrivals-women",
    ]);
  });

  it("extracts only women's footwear and keeps source URLs/images", () => {
    const mapped = products
      .map((product) => mapDriesProductToPilot(product, womenShoes, config, "2026-08-21T00:00:00.000Z"))
      .filter((item) => item != null);
    expect(mapped.map((item) => item.productName).sort()).toEqual([
      "Leather slingback pumps",
      "Leather sneakers",
    ]);
    expect(mapped.every((item) => item.productUrl.includes("/products/"))).toBe(true);
    expect(mapped.every((item) => (item.images?.length ?? 0) > 0)).toBe(true);
    expect(mapped.every((item) => item.sourceCategoryName === "Women's Shoes")).toBe(true);
  });

  it("excludes menswear, clothing, and bags", () => {
    expect(
      products.filter((product) => isDriesWomensFootwearProduct(product, DRIES_WOMEN_SHOES_PATH)).map(
        (product) => product.handle,
      ),
    ).toEqual(["leather-sneakers-w", "leather-pumps-w"]);
  });

  it("does not fabricate product data from the collector", () => {
    const unknown = mapDriesProductToPilot(
      {
        title: "Invented pump",
        handle: "invented-pump",
        product_type: "Dresses",
        tags: "WOMEN",
      },
      womenShoes,
      config,
      "2026-08-21T00:00:00.000Z",
    );
    expect(unknown).toBeNull();
    const sanitized = sanitizeDriesProductForFootwearGate(products[0]!);
    expect(normalizeTags(sanitized.tags)).not.toContain("ACCESSORIES");
    expect(products[0]!.title).toBe("Leather sneakers");
  });
});

function normalizeTags(tags: string[] | string | undefined): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  return tags.split(",").map((tag) => tag.trim());
}
