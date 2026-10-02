import type { NewnessEvidenceType } from "../../newArrivals/newness";

export interface NewnessInput {
  productUrl: string;
  inNewArrivals: boolean;
}

export interface AssignedNewness {
  isNew: boolean;
  newnessEvidence: NewnessEvidenceType | null;
}

/**
 * Baseline catalogs are not bulk-marked NEW.
 * NEW requires official New Arrivals membership. A newly discovered URL
 * is catalog discovery, not evidence of a new release.
 */
export function assignProductNewness(
  product: NewnessInput,
  _previousUrls: ReadonlySet<string> | null,
): AssignedNewness {
  if (product.inNewArrivals) {
    return { isNew: true, newnessEvidence: "NEW_ARRIVALS_COLLECTION" };
  }
  return { isNew: false, newnessEvidence: null };
}
