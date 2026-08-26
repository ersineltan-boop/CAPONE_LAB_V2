import { describe, expect, it } from "vitest";

import {
  isSafeDistinctiveModelName,
  stripColorwayDescriptors,
  titlesDifferOnlyByColorwayDescriptors,
} from "../safeNameColorway";
import type { RawAnalyzedProduct } from "../types";

function product(name: string, color?: string): RawAnalyzedProduct {
  return {
    source: "test",
    brand: "TEST",
    productName: name,
    productUrl: "https://example.com/p",
    category: "PUMP",
    color: color ?? null,
    material: null,
    imageUrl: null,
    discoveredAt: "2026-08-18T10:00:00.000Z",
    cleaned: { color: color ?? null, heelHeight: null },
    normalized: {
      category: "PUMP",
      colorFamily: "UNKNOWN",
      materialFamily: "UNKNOWN",
      heelType: "UNKNOWN",
      heelHeightGroup: "UNKNOWN",
      toeShape: "UNKNOWN",
      details: [],
      construction: [],
    },
  };
}

describe("safeNameColorway", () => {
  it("requires distinctive model tokens", () => {
    expect(isSafeDistinctiveModelName("banana")).toBe(true);
    expect(isSafeDistinctiveModelName("kenley sandals")).toBe(true);
    expect(isSafeDistinctiveModelName("leather sandal")).toBe(false);
    expect(isSafeDistinctiveModelName("pointed pump")).toBe(false);
    expect(isSafeDistinctiveModelName("slingback heel")).toBe(false);
  });

  it("treats leather/suede naming as colorway-only residuals", () => {
    expect(
      titlesDifferOnlyByColorwayDescriptors(
        product("Helia Low-Cut Pumps"),
        product("Helia Suede Low-Cut Pumps", "Cream"),
      ),
    ).toBe(true);
  });

  it("keeps vinyl/jelly residual as a meaningful difference", () => {
    expect(
      titlesDifferOnlyByColorwayDescriptors(
        product("KENLEY VINYL SANDALS CRYSTAL JELLY"),
        product("KENLEY SANDALS SADDLE LEATHER", "Saddle"),
      ),
    ).toBe(false);
    expect(stripColorwayDescriptors("KENLEY VINYL SANDALS CRYSTAL JELLY")).toContain("vinyl");
  });

  it("treats French argenté / platine / leopard as colorway residuals", () => {
    expect(
      titlesDifferOnlyByColorwayDescriptors(
        product("Cassis - Ballerines cuir tressé marron"),
        product("Cassis - Ballerines cuir tressé argenté"),
      ),
    ).toBe(true);
    expect(
      stripColorwayDescriptors("Valeria 70 Leopard-print Calf Hair Slingbacks"),
    ).toBe(stripColorwayDescriptors("Valeria 70 Buff Patent Slingbacks"));
    expect(
      stripColorwayDescriptors("Valeria 70 Beige Patent Slingback Pumps"),
    ).toBe(stripColorwayDescriptors("Valeria 70 Buff Patent Slingbacks"));
  });
});
