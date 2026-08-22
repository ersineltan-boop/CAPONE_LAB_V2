import { describe, expect, it } from "vitest";
import { analyzeProduct } from "../analyzeProduct";
import { cleanHeelHeight, extractColorFromName } from "../cleanText";
import { normalizeColorFamily } from "../normalize/colorFamily";
import { normalizeDetails } from "../normalize/details";
import { normalizeHeelType } from "../normalize/heelType";
import type { PilotProductRaw } from "../types";

function baseProduct(overrides: Partial<PilotProductRaw> = {}): PilotProductRaw {
  return {
    source: "test",
    brand: "TEST",
    productName: "Test Product",
    productUrl: "https://example.com/products/test",
    imageUrl: null,
    category: null,
    color: null,
    material: null,
    toeShape: null,
    heelType: null,
    heelHeight: null,
    details: null,
    discoveredAt: "2026-08-18T00:00:00.000Z",
    ...overrides,
  };
}

describe("cleanHeelHeight", () => {
  it("extracts measurement before CARE text", () => {
    expect(
      cleanHeelHeight(
        "1cm CARE To preserve the natural character of your footwear",
      ),
    ).toBe("1cm");
  });

  it("keeps clean Schutz inches format", () => {
    expect(cleanHeelHeight("4.1 In")).toBe("4.1 In");
  });
});

describe("normalizeColorFamily", () => {
  it("maps Coffee / Chestnut to brown family", () => {
    expect(normalizeColorFamily("Coffee", "High Wedge - Coffee")).toBe("BROWN");
    expect(normalizeColorFamily("Chestnut", "Bunto Woven Loafer - Chestnut")).toBe(
      "BROWN",
    );
  });

  it("maps Burgundy / Wine to burgundy", () => {
    expect(normalizeColorFamily("Vino", "Maddi Vino Nappa")).toBe("BURGUNDY");
    expect(normalizeColorFamily(null, "Pump - Burgundy")).toBe("BURGUNDY");
  });

  it("extracts Black from product name when color missing", () => {
    expect(
      normalizeColorFamily(null, "Bunto Woven Loafer - Black"),
    ).toBe("BLACK");
  });

  it("returns UNKNOWN for unknown color", () => {
    expect(normalizeColorFamily(null, "Mystery Shoe")).toBe("UNKNOWN");
  });
});

describe("normalizeDetails", () => {
  it("detects WOVEN from product name", () => {
    expect(
      normalizeDetails("Bunto Woven Loafer - Black", null, null),
    ).toContain("WOVEN");
  });

  it("detects THONG from product name", () => {
    expect(
      normalizeDetails("Thong Wedge - Black", null, null),
    ).toContain("THONG");
  });
});

describe("normalizeHeelType", () => {
  it("detects WEDGE from product name", () => {
    expect(
      normalizeHeelType(null, "5cm", "Thong Wedge - Black", "WEDGE"),
    ).toBe("WEDGE");
  });
});

describe("analyzeProduct integration", () => {
  it("cleans polluted heelHeight in analyzed output", () => {
    const analyzed = analyzeProduct(
      baseProduct({
        productName: "Opanka Slide - Savannah",
        heelHeight:
          "1cm CARE To preserve the natural character of your footwear",
        material: "Sole height: 1cm CARE instructions follow",
      }),
    );

    expect(analyzed.cleaned.heelHeight).toBe("1cm");
    expect(analyzed.normalized.heelHeightGroup).toBe("FLAT");
  });

  it("preserves raw fields while adding normalized data", () => {
    const raw = baseProduct({
      productName: "Bunto Woven Loafer - Black",
      color: null,
      heelHeight: "1.4cm CARE text",
    });
    const analyzed = analyzeProduct(raw);

    expect(analyzed.productName).toBe(raw.productName);
    expect(analyzed.heelHeight).toBe(raw.heelHeight);
    expect(analyzed.cleaned.color).toBe("Black");
    expect(analyzed.normalized.colorFamily).toBe("BLACK");
    expect(analyzed.normalized.details).toContain("WOVEN");
  });
});

describe("extractColorFromName", () => {
  it("reads trailing color segment", () => {
    expect(extractColorFromName("Suede Opanka Slide - Black/Coffee")).toBe(
      "Black/Coffee",
    );
  });
});
