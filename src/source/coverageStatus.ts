import type { SourceCoverageStatus } from "./types";

export const FULL_COVERAGE_MATCH_RATIO = 0.9;

export interface CoverageStatusInput {
  uniqueProductCount: number;
  sourceReportedProductCount?: number | null;
  paginationExhausted?: boolean;
  hitLegacyCap?: boolean;
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
  if (input.collectionStatus === "FAILED" && unique === 0) return "FAILED";
  if (errors.length > 0 && unique === 0) return "FAILED";
  if (unique === 0) {
    return input.collectionStatus === "NEEDS_PROBE" ? "NEEDS_PROBE" : "PARTIAL";
  }
  if (input.hitLegacyCap) return "PARTIAL";

  const discrepancy = coverageDiscrepancyWarning(unique, reported);
  if (discrepancy) return "PARTIAL";

  if (
    input.paginationExhausted === true &&
    input.footwearRootDiscovered !== false &&
    (reported == null || unique >= reported * FULL_COVERAGE_MATCH_RATIO)
  ) {
    return "FULL";
  }

  return "PARTIAL";
}
