import { describe, expect, it } from "vitest";
import type { ModelFamily } from "../../modelFamily/types";
import { filterSavedProducts } from "../savedProductFilters";
import { emptyResearchState } from "../types";

function family(id: string, brand: string, name: string, sourceId: string): ModelFamily {
  return {
    modelFamilyId: id,
    brand,
    canonicalName: name,
    category: null,
    representativeProductId: id,
    representativeImage: null,
    representativeImages: [],
    variantCount: 0,
    variants: [],
    allImages: [],
    sourceProductIds: [],
    groupingConfidence: "HIGH",
    groupingReason: "",
    sourceSightings: [{
      sourceId,
      sourceLabel: sourceId,
      firstSeenAt: "2026-11-20",
      lastSeenAt: "2026-11-27",
    }],
  };
}

const families = [
  family("heel", "Prada", "Slingback", "farfetch"),
  family("flat", "ZARA", "Babet", "zara"),
  family("boot", "Prada", "Chunky Boot", "prada"),
];
const states = new Map([
  ["heel", { ...emptyResearchState("heel"), savedAt: "2026-11-21", note: "İnce şerit dene." }],
  ["flat", { ...emptyResearchState("flat"), savedAt: "2026-11-22", note: "  " }],
  ["boot", { ...emptyResearchState("boot"), savedAt: "2026-11-23", note: "Kauçuk taban." }],
]);
const defaultFilters = { query: "", brand: "ALL", source: "ALL", withNotes: false };

describe("saved product filters", () => {
  it("finds a product by its note, brand or model, with Turkish input", () => {
    for (const query of ["  INCE SERIT ", "slingback"]) {
      expect(filterSavedProducts(families, states, { ...defaultFilters, query })).toEqual([families[0]]);
    }
    expect(filterSavedProducts(families, states, { ...defaultFilters, query: "prada" }))
      .toEqual([families[2], families[0]]);
  });

  it("keeps newest saves first and combines notes with brand and source", () => {
    expect(filterSavedProducts(families, states, defaultFilters))
      .toEqual([families[2], families[1], families[0]]);
    expect(filterSavedProducts(families, states, { ...defaultFilters, withNotes: true }))
      .toEqual([families[2], families[0]]);
    expect(filterSavedProducts(families, states, {
      ...defaultFilters,
      brand: "Prada",
      source: "farfetch",
      withNotes: true,
    })).toEqual([families[0]]);
  });
});
