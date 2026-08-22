import { describe, expect, it } from "vitest";

import { assignPrimaryCategory } from "../assignCategory";
import { buildTaxonomyFromAssignmentInput, buildTaxonomyFromProduct } from "../buildTaxonomy";
import { buildTaxonomyCompletenessReport } from "../completeness";
import { featureKnown, featureNotApplicable, featureUnknown, isValidKnownFeature } from "../featureHelpers";
import type { FootwearTaxonomyV1 } from "../types";
import type { RawAnalyzedProduct } from "../../modelFamily/types";

function minimalProduct(overrides: Partial<RawAnalyzedProduct> = {}): RawAnalyzedProduct {
  return {
    source: "test",
    brand: "TEST",
    productName: "Generic shoe",
    productUrl: "https://example.com/product",
    imageUrl: null,
    category: null,
    color: null,
    material: null,
    discoveredAt: "2026-08-01T00:00:00.000Z",
    cleaned: { heelHeight: null, color: null },
    normalized: {
      category: null,
      colorFamily: "UNKNOWN",
      materialFamily: "UNKNOWN",
      heelType: "UNKNOWN",
      heelHeightGroup: "UNKNOWN",
      toeShape: "UNKNOWN",
      details: [],
      construction: [],
    },
    ...overrides,
  };
}

describe("assignPrimaryCategory boundary cases", () => {
  it("Ballet sneaker -> SNEAKER + BALLET influence", () => {
    const result = assignPrimaryCategory({ productName: "Ballet sneaker in leather" });
    expect(result.primaryCategory).toBe("SNEAKER");
    expect(result.hybridInfluences).toContain("BALLET");
  });

  it("Loafer mule / backless horsebit -> MULE + LOAFER influence", () => {
    const result = assignPrimaryCategory({
      productName: "Backless horsebit loafer mule",
      construction: ["BACKLESS"],
    });
    expect(result.primaryCategory).toBe("MULE");
    expect(result.hybridInfluences).toContain("LOAFER");
  });

  it("55 mm pointed slingback pump -> PUMP", () => {
    const result = assignPrimaryCategory({
      productName: "55 mm pointed slingback pump",
      construction: ["SLINGBACK"],
      heelHeightGroup: "MID",
      cleanedHeelHeight: "55 mm",
    });
    expect(result.primaryCategory).toBe("PUMP");
  });

  it("10 mm slingback ballet flat -> BALLET_FLAT", () => {
    const result = assignPrimaryCategory({
      productName: "10 mm slingback ballet flat",
      construction: ["SLINGBACK"],
      cleanedHeelHeight: "10 mm",
      heelHeightGroup: "LOW",
    });
    expect(result.primaryCategory).toBe("BALLET_FLAT");
  });

  it("Thong sandal -> SANDAL", () => {
    const result = assignPrimaryCategory({ productName: "Leather thong sandal" });
    expect(result.primaryCategory).toBe("SANDAL");
  });

  it("Closed-toe covered-vamp backless mule -> MULE", () => {
    const result = assignPrimaryCategory({
      productName: "Closed toe covered vamp backless mule",
      construction: ["BACKLESS"],
    });
    expect(result.primaryCategory).toBe("MULE");
  });

  it("Chelsea ankle boot -> BOOT", () => {
    const result = assignPrimaryCategory({ productName: "Chelsea ankle boot" });
    expect(result.primaryCategory).toBe("BOOT");
  });

  it("Jute wedge espadrille -> ESPADRILLE", () => {
    const result = assignPrimaryCategory({ productName: "Jute wedge espadrille" });
    expect(result.primaryCategory).toBe("ESPADRILLE");
  });

  it("Platform Derby -> OXFORD_DERBY", () => {
    const result = assignPrimaryCategory({ productName: "Platform Derby shoe" });
    expect(result.primaryCategory).toBe("OXFORD_DERBY");
  });

  it("Platform clog -> CLOG", () => {
    const result = assignPrimaryCategory({ productName: "Platform clog" });
    expect(result.primaryCategory).toBe("CLOG");
  });

  it("Insufficient evidence -> UNCLASSIFIED", () => {
    const result = assignPrimaryCategory({ productName: "Serena" });
    expect(result.primaryCategory).toBe("UNCLASSIFIED");
  });
});

describe("taxonomy completeness", () => {
  it("excludes NOT_APPLICABLE from completeness denominator", () => {
    const taxonomy: FootwearTaxonomyV1 = {
      version: 1,
      primaryCategory: "SANDAL",
      hybridInfluences: [],
      global: {
        toeShape: featureKnown("POINTED"),
        toeLength: featureUnknown(),
        toeOpening: featureKnown("OPEN"),
        backConstruction: featureKnown("BACKLESS"),
        vampHeight: featureUnknown(),
        heelHeightClass: featureKnown("FLAT"),
        heelHeightMm: featureUnknown(),
        heelType: featureKnown("NONE"),
        soleProfile: featureUnknown(),
        platformConstruction: featureUnknown(),
        closureFeatures: featureUnknown(),
        strapFeatures: featureKnown(["T_STRAP"]),
        sideConstruction: featureUnknown(),
        hardwareType: featureUnknown(),
        hardwareIntensity: featureUnknown(),
        embellishmentFeatures: featureUnknown(),
        materialFamily: featureUnknown(),
        colorFamily: featureUnknown(),
        surfacePattern: featureUnknown(),
      },
      categorySpecific: {
        strapConfiguration: featureKnown("T_STRAP"),
        shaftHeight: featureNotApplicable(),
      },
      derivedStyleTags: [],
    };

    const report = buildTaxonomyCompletenessReport([
      {
        modelFamilyId: "test",
        brand: "TEST",
        canonicalName: "Test",
        category: "SANDAL",
        primaryCategory: "SANDAL",
        taxonomy,
        representativeProductId: "x",
        representativeImage: null,
        representativeImages: [],
        variantCount: 1,
        variants: [],
        allImages: [],
        sourceProductIds: ["x"],
        groupingConfidence: "HIGH",
        groupingReason: "test",
      },
    ]);

    expect(report.categoryKnownCount).toBe(1);
    expect(report.averageFeatureCompletenessPercent).toBeGreaterThan(0);
  });
});

describe("buildTaxonomyFromAssignmentInput", () => {
  it("does not infer heelHeightMm without explicit mm in text", () => {
    const taxonomy = buildTaxonomyFromAssignmentInput({
      productName: "High heel pump",
      heelHeightGroup: "HIGH",
    });
    expect(taxonomy.global.heelHeightMm.status).toBe("UNKNOWN");
  });

  it("stores explicit heelHeightMm from product text only", () => {
    const taxonomy = buildTaxonomyFromAssignmentInput({
      productName: "55 mm pointed pump",
      heelHeightGroup: "MID",
      cleanedHeelHeight: "55 mm",
    });
    expect(taxonomy.global.heelHeightMm.value).toBe(55);
    expect(taxonomy.global.heelHeightMm.source).toBe("PRODUCT_TEXT");
  });
});

describe("taxonomy data quality — no default fabrication", () => {
  it("no back evidence -> backConstruction UNKNOWN", () => {
    const taxonomy = buildTaxonomyFromProduct(
      minimalProduct({ productName: "Leather loafer", category: "LOAFER" }),
    );
    expect(taxonomy.global.backConstruction.status).toBe("UNKNOWN");
    expect(taxonomy.global.backConstruction.value).toBeNull();
  });

  it("MULE with category evidence -> backConstruction BACKLESS DERIVED", () => {
    const taxonomy = buildTaxonomyFromProduct(
      minimalProduct({
        productName: "Backless horsebit loafer mule",
        normalized: {
          category: null,
          colorFamily: "UNKNOWN",
          materialFamily: "UNKNOWN",
          heelType: "UNKNOWN",
          heelHeightGroup: "UNKNOWN",
          toeShape: "UNKNOWN",
          details: [],
          construction: ["BACKLESS"],
        },
      }),
    );
    expect(taxonomy.primaryCategory).toBe("MULE");
    expect(taxonomy.global.backConstruction.value).toBe("BACKLESS");
    expect(["PRODUCT_TEXT", "DERIVED"]).toContain(taxonomy.global.backConstruction.source);
  });

  it("legacy MULE category derives BACKLESS when no direct back text", () => {
    const taxonomy = buildTaxonomyFromProduct(
      minimalProduct({
        productName: "Serena leather slide",
        category: "MULE",
        normalized: {
          category: "MULE",
          colorFamily: "UNKNOWN",
          materialFamily: "UNKNOWN",
          heelType: "UNKNOWN",
          heelHeightGroup: "UNKNOWN",
          toeShape: "UNKNOWN",
          details: [],
          construction: [],
        },
      }),
    );
    expect(taxonomy.primaryCategory).toBe("MULE");
    expect(taxonomy.global.backConstruction.value).toBe("BACKLESS");
    expect(taxonomy.global.backConstruction.source).toBe("DERIVED");
  });

  it("BALLET_FLAT with no back evidence must NOT default CLOSED", () => {
    const taxonomy = buildTaxonomyFromProduct(
      minimalProduct({
        productName: "10 mm ballet flat",
        cleaned: { heelHeight: "10 mm", color: null },
        normalized: {
          category: "BALLERINA",
          colorFamily: "UNKNOWN",
          materialFamily: "UNKNOWN",
          heelType: "UNKNOWN",
          heelHeightGroup: "LOW",
          toeShape: "UNKNOWN",
          details: [],
          construction: [],
        },
      }),
    );
    expect(taxonomy.primaryCategory).toBe("BALLET_FLAT");
    expect(taxonomy.global.backConstruction.value).not.toBe("CLOSED");
    expect(taxonomy.global.backConstruction.status).toBe("UNKNOWN");
  });

  it("PUMP with no back evidence must NOT default CLOSED", () => {
    const taxonomy = buildTaxonomyFromProduct(
      minimalProduct({
        productName: "55 mm pointed pump",
        cleaned: { heelHeight: "55 mm", color: null },
        normalized: {
          category: "PUMP",
          colorFamily: "UNKNOWN",
          materialFamily: "UNKNOWN",
          heelType: "STILETTO",
          heelHeightGroup: "MID",
          toeShape: "POINTED",
          details: [],
          construction: [],
        },
      }),
    );
    expect(taxonomy.primaryCategory).toBe("PUMP");
    expect(taxonomy.global.backConstruction.value).not.toBe("CLOSED");
    expect(taxonomy.global.backConstruction.status).toBe("UNKNOWN");
  });

  it("no platform evidence -> platformConstruction UNKNOWN", () => {
    const taxonomy = buildTaxonomyFromProduct(minimalProduct({ productName: "Classic pump" }));
    expect(taxonomy.global.platformConstruction.status).toBe("UNKNOWN");
    expect(taxonomy.global.platformConstruction.value).not.toBe("NONE");
  });

  it("no heel evidence -> heelHeightClass UNKNOWN when group is UNKNOWN", () => {
    const taxonomy = buildTaxonomyFromProduct(minimalProduct({ productName: "Serena flat" }));
    expect(taxonomy.global.heelHeightClass.status).toBe("UNKNOWN");
    expect(taxonomy.global.heelType.status).toBe("UNKNOWN");
  });

  it("no toe opening evidence -> toeOpening UNKNOWN (not default CLOSED)", () => {
    const taxonomy = buildTaxonomyFromProduct(minimalProduct({ productName: "Classic loafer" }));
    expect(taxonomy.global.toeOpening.status).toBe("UNKNOWN");
    expect(taxonomy.global.toeOpening.value).not.toBe("CLOSED");
  });

  it("KNOWN features must never have source UNKNOWN", () => {
    const taxonomy = buildTaxonomyFromProduct(
      minimalProduct({
        productName: "Slingback pump",
        normalized: {
          category: "PUMP",
          colorFamily: "UNKNOWN",
          materialFamily: "UNKNOWN",
          heelType: "BLOCK",
          heelHeightGroup: "MID",
          toeShape: "POINTED",
          details: [],
          construction: ["SLINGBACK"],
        },
      }),
    );

    for (const feature of Object.values(taxonomy.global)) {
      expect(isValidKnownFeature(feature)).toBe(true);
    }
  });

  it("legacy category assignment records LEGACY_CATEGORY provenance", () => {
    const taxonomy = buildTaxonomyFromProduct(
      minimalProduct({
        productName: "Serena",
        category: "LOAFER",
        normalized: {
          category: "LOAFER",
          colorFamily: "UNKNOWN",
          materialFamily: "UNKNOWN",
          heelType: "UNKNOWN",
          heelHeightGroup: "UNKNOWN",
          toeShape: "UNKNOWN",
          details: [],
          construction: [],
        },
      }),
    );
    expect(taxonomy.categoryProvenance).toBe("LEGACY_CATEGORY");
  });
});
