import { describe, expect, it } from "vitest";

import { resolveCoverageStatus } from "../coverageStatus";

describe("source coverage status", () => {
  it("cannot be FULL when the source count is much larger than collected", () => {
    expect(
      resolveCoverageStatus({
        uniqueProductCount: 118,
        sourceReportedProductCount: 700,
        paginationExhausted: true,
        footwearRootDiscovered: true,
      }),
    ).toBe("PARTIAL");
  });

  it("is FULL only when pagination exhausted and counts agree", () => {
    expect(
      resolveCoverageStatus({
        uniqueProductCount: 680,
        sourceReportedProductCount: 700,
        paginationExhausted: true,
        footwearRootDiscovered: true,
      }),
    ).toBe("FULL");
  });

  it("marks empty probe sources as NEEDS_PROBE", () => {
    expect(
      resolveCoverageStatus({
        uniqueProductCount: 0,
        collectionStatus: "NEEDS_PROBE",
      }),
    ).toBe("NEEDS_PROBE");
  });

  it("does not mark FULL when the collection crawl safety ceiling was hit", () => {
    expect(
      resolveCoverageStatus({
        uniqueProductCount: 800,
        sourceReportedProductCount: 820,
        paginationExhausted: true,
        footwearRootDiscovered: true,
        hitCollectionCrawlCap: true,
      }),
    ).toBe("PARTIAL");
  });

  it("does not mark FULL for NEEDS_CUSTOM_ADAPTER sources", () => {
    expect(
      resolveCoverageStatus({
        uniqueProductCount: 12,
        paginationExhausted: true,
        collectionStatus: "NEEDS_CUSTOM_ADAPTER",
      }),
    ).toBe("NEEDS_CUSTOM_ADAPTER");
  });

  it("does not mark a listing crawl FULL without pagination exhaustion", () => {
    expect(
      resolveCoverageStatus({
        uniqueProductCount: 40,
        paginationExhausted: false,
        footwearRootDiscovered: true,
      }),
    ).toBe("PARTIAL");
  });

  it("does not mark FULL when a crawl finished without errors but has no source total", () => {
    expect(
      resolveCoverageStatus({
        uniqueProductCount: 50,
        paginationExhausted: true,
        footwearRootDiscovered: true,
        errors: [],
      }),
    ).toBe("PARTIAL");
  });

  it("does not mark FULL from a tiny reported collection when the catalog is larger", () => {
    expect(
      resolveCoverageStatus({
        uniqueProductCount: 334,
        sourceReportedProductCount: 81,
        paginationExhausted: true,
        footwearRootDiscovered: true,
      }),
    ).toBe("PARTIAL");
  });
});
