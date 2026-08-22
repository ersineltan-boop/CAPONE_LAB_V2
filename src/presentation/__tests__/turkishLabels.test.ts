import { describe, expect, it } from "vitest";

import {
  getCategoryLabel,
  getCategoryLabelForCard,
  getChipLabel,
  getPeriodLabel,
  getStatusLabel,
  getTaxonomyChipLabel,
  getTaxonomyValueLabel,
} from "../turkishLabels";

describe("turkishLabels", () => {
  it("maps primary categories to Turkish labels", () => {
    expect(getCategoryLabel("BALLET_FLAT")).toBe("Babet");
    expect(getCategoryLabel("BOOT")).toBe("Bot / Çizme");
    expect(getCategoryLabel("UNCLASSIFIED")).toBe("Sınıflandırılmamış");
  });

  it("hides UNCLASSIFIED on product cards", () => {
    expect(getCategoryLabelForCard("UNCLASSIFIED")).toBeNull();
    expect(getCategoryLabelForCard("BALLET_FLAT")).toBe("Babet");
  });

  it("maps taxonomy enum values to Turkish labels", () => {
    expect(getTaxonomyValueLabel("POINTED")).toBe("Sivri Burun");
    expect(getTaxonomyValueLabel("ELONGATED")).toBe("Uzatılmış");
    expect(
      getTaxonomyValueLabel("SLINGBACK", { field: "backConstruction" }),
    ).toBe("Arkası Bantlı");
  });

  it("maps feature status labels", () => {
    expect(getStatusLabel("UNKNOWN")).toBe("Belirlenemedi");
    expect(getStatusLabel("KNOWN")).toBe("Biliniyor");
  });

  it("maps chip labels without leaking raw enums", () => {
    expect(getChipLabel("BALLET_FLAT")).toBe("Babet");
    expect(getChipLabel("SLINGBACK", { field: "backConstruction" })).toBe(
      "Arkası Bantlı",
    );
    expect(getChipLabel("POINTED")).toBe("Sivri Burun");
    expect(getChipLabel("BALLET_SNEAKER")).toBe("Balet Sneaker");
    expect(getTaxonomyChipLabel("BALLET_FLAT", "BALLET_FLAT")).toBe("Babet");
    expect(getTaxonomyChipLabel("UNCLASSIFIED", "UNCLASSIFIED")).toBeNull();
  });

  it("maps period labels", () => {
    expect(getPeriodLabel("7D")).toBe("Son 7 Gün");
    expect(getPeriodLabel("7D", { compact: true })).toBe("7 Gün");
  });
});
