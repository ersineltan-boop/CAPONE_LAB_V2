import type { SourceCoverageStatus } from "./types";

export const FULL_COVERAGE_MATCH_RATIO = 0.9;

export interface CoverageStatusInput {
  uniqueProductCount: number;
  sourceReportedProductCount?: number | null;
  paginationExhausted?: boolean;
  hitLegacyCap?: boolean;
  hitCollectionCrawlCap?: boolean;
  collectionStatus?: string;
  errors?: string[];
  footwearRootDiscovered?: boolean;
}

export function coverageDiscrepancyWarning(
  uniqueProductCount: number,
  sourceReportedProductCount: number | null | undefined,
): string | null {
  if (
    sourceReportedProductCount == null ||
    !Number.isFinite(sourceReportedProductCount) ||
    sourceReportedProductCount <= 0
  ) {
    return null;
  }
  if (uniqueProductCount >= sourceReportedProductCount * FULL_COVERAGE_MATCH_RATIO) {
    return null;
  }
  return `Kaynak ${sourceReportedProductCount} ürün bildiriyor, collector ${uniqueProductCount} benzersiz ürün aldı`;
}

export function resolveCoverageStatus(input: CoverageStatusInput): SourceCoverageStatus {
  const errors = input.errors ?? [];
  const unique = input.uniqueProductCount;
  const reported = input.sourceReportedProductCount ?? null;

  if (input.collectionStatus === "NEEDS_PROBE") return "NEEDS_PROBE";
  if (input.collectionStatus === "NEEDS_CUSTOM_ADAPTER") return "NEEDS_CUSTOM_ADAPTER";
  if (input.collectionStatus === "FAILED" && unique === 0) return "FAILED";
  if (errors.length > 0 && unique === 0) return "FAILED";
  if (unique === 0) {
    return input.collectionStatus === "NEEDS_PROBE" ? "NEEDS_PROBE" : "PARTIAL";
  }
  if (input.hitLegacyCap) return "PARTIAL";
  if (input.hitCollectionCrawlCap) return "PARTIAL";

  const discrepancy = coverageDiscrepancyWarning(unique, reported);
  if (discrepancy) return "PARTIAL";
  if (reported != null && reported > 0 && unique > reported * 1.25) {
    return "PARTIAL";
  }

  // Never mark FULL just because a crawl finished without errors.
  // FULL requires exhausted pagination AND agreement with a source women's footwear total.
  if (
    input.paginationExhausted === true &&
    input.footwearRootDiscovered !== false &&
    reported != null &&
    reported > 0 &&
    unique >= reported * FULL_COVERAGE_MATCH_RATIO
  ) {
    return "FULL";
  }

  return "PARTIAL";
}
