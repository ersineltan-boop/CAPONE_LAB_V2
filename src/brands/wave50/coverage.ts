import type { WaveCoverage } from "./types";

export function buildWaveCoverage(input: {
  sourceTotal: number | null;
  collected: number;
  excluded: number;
  paginationExhausted: boolean;
  galleryComplete: number;
  taxonomyPassed: boolean;
  womenFootwearOnly: boolean;
  sampleOnly: boolean;
}): WaveCoverage {
  const sourceTotal = input.sourceTotal;
  const collected = Math.max(0, input.collected);
  const missing = sourceTotal === null ? null : Math.max(0, sourceTotal - collected);
  const coverage =
    sourceTotal === null
      ? null
      : sourceTotal === 0
        ? 0
        : Math.round((collected / sourceTotal) * 10_000) / 100;

  return {
    sourceTotal,
    collected,
    missing,
    coverage,
    excluded: Math.max(0, input.excluded),
    paginationExhausted: input.paginationExhausted,
    galleryComplete: input.galleryComplete,
    taxonomyPassed: input.taxonomyPassed,
    womenFootwearOnly: input.womenFootwearOnly,
    sampleOnly: input.sampleOnly,
  };
}

export function fullCatalogPassBlocker(coverage: WaveCoverage): string | null {
  if (coverage.sampleOnly) return "SAMPLE_NOT_FULL_CATALOG";
  if (!coverage.womenFootwearOnly) return "WOMENS_FOOTWEAR_SCOPE_NOT_VERIFIED";
  if (!coverage.paginationExhausted) return "PAGINATION_NOT_EXHAUSTED";
  if (coverage.sourceTotal === null) return "SOURCE_TOTAL_NOT_VERIFIED";
  if (coverage.sourceTotal <= 0) return "EMPTY_CATALOG";
  if (coverage.collected !== coverage.sourceTotal || coverage.missing !== 0) {
    return "FULL_CATALOG_COVERAGE_NOT_VERIFIED";
  }
  if (!coverage.taxonomyPassed) return "TAXONOMY_QA_FAILED";
  if (coverage.galleryComplete !== coverage.collected) return "GALLERY_QA_INCOMPLETE";
  if (coverage.coverage !== 100) return "COVERAGE_BELOW_100";
  return null;
}
