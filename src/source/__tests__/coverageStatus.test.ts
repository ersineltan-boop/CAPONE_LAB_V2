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

  it("does not mark a listing crawl FULL without pagination exhaustion", () => {
    expect(
      resolveCoverageStatus({
        uniqueProductCount: 40,
        paginationExhausted: false,
        footwearRootDiscovered: true,
      }),
    ).toBe("PARTIAL");
  });
});
