import type { WaveCatalog, WaveCoverage } from "./types";
import { fullCatalogPassBlocker } from "./coverage";

const CATASTROPHIC_DROP = 0.4;

export interface LastGoodDecision {
  publish: boolean;
  retainPrevious: boolean;
  blocker: string | null;
}

export function decideLastGoodPublish(input: {
  previousCollected: number | null;
  candidate: Pick<WaveCatalog, "productUrls"> | null;
  coverage: WaveCoverage | null;
  referenceFootwearTotal?: number | null;
  referenceNewArrivals?: number | null;
  newArrivalsFootwear?: number | null;
}): LastGoodDecision {
  if (!input.candidate || !input.coverage || input.candidate.productUrls.length === 0) {
    return {
      publish: false,
      retainPrevious: input.previousCollected !== null,
      blocker: input.coverage ? fullCatalogPassBlocker(input.coverage) ?? "EMPTY_OR_FAILED_COLLECT" : "EMPTY_OR_FAILED_COLLECT",
    };
  }

  const blocker = fullCatalogPassBlocker(input.coverage);
  if (blocker) {
    return {
      publish: false,
      retainPrevious: input.previousCollected !== null,
      blocker,
    };
  }

  if (
    input.referenceFootwearTotal != null &&
    input.candidate.productUrls.length !== input.referenceFootwearTotal
  ) {
    return {
      publish: false,
      retainPrevious: input.previousCollected !== null,
      blocker: "REFERENCE_FOOTWEAR_MISMATCH",
    };
  }
  if (
    input.referenceNewArrivals != null &&
    input.newArrivalsFootwear !== input.referenceNewArrivals
  ) {
    return {
      publish: false,
      retainPrevious: input.previousCollected !== null,
      blocker: "REFERENCE_NEW_ARRIVALS_MISMATCH",
    };
  }

  if (
    input.previousCollected !== null &&
    input.previousCollected > 0 &&
    input.candidate.productUrls.length < input.previousCollected * (1 - CATASTROPHIC_DROP)
  ) {
    return {
      publish: false,
      retainPrevious: true,
      blocker: "CATASTROPHIC_CATALOG_DROP",
    };
  }

  return { publish: true, retainPrevious: false, blocker: null };
}
