import { describe, expect, it } from "vitest";
import { savedBrandOptions } from "../savedBrandOptions";

describe("saved product brand options", () => {
  it("includes marketplace-only brands alongside registered brands", () => {
    expect(savedBrandOptions(["PRETTY BALLERINAS"], ["Christian Louboutin"]))
      .toEqual(["Christian Louboutin", "PRETTY BALLERINAS"]);
  });

  it("deduplicates repeated products and registered/saved overlap", () => {
    expect(savedBrandOptions(["ALOHAS"], ["ALOHAS", "Prada", "Prada"]))
      .toEqual(["ALOHAS", "Prada"]);
  });

  it("preserves exact values used by brand filtering", () => {
    const values = ["ALAÏA", "Jil Sander", "JIL SANDER", "Étoile"];
    const options = savedBrandOptions([], values);
    for (const brand of values) expect(options).toContain(brand);
    expect(options).toHaveLength(values.length);
  });

  it("handles no saved products and ignores empty labels without mutating inputs", () => {
    const registered = ["ZARA", "ALOHAS", "", "   "];
    expect(savedBrandOptions(registered, [])).toEqual(["ALOHAS", "ZARA"]);
    expect(registered).toEqual(["ZARA", "ALOHAS", "", "   "]);
    expect(savedBrandOptions([], [])).toEqual([]);
  });

  it("drops a marketplace-only brand when it is no longer among saved brands", () => {
    expect(savedBrandOptions(["ZARA"], ["Prada"])).toContain("Prada");
    expect(savedBrandOptions(["ZARA"], [])).toEqual(["ZARA"]);
  });
});
