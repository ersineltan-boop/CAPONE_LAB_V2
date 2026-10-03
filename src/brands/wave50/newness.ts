import type { NewnessEvidenceType } from "../../newArrivals/newness";

export interface NewnessInput {
  productUrl: string;
  inNewArrivals: boolean;
  hasNewBadge?: boolean;
}

export interface AssignedNewness {
  isNew: boolean;
  newnessEvidence: NewnessEvidenceType | null;
}

/**
 * Baseline catalogs are not bulk-marked NEW.
 * NEW requires official New Arrivals membership or an explicit source badge. A newly discovered URL
 * is catalog discovery, not evidence of a new release.
 */
export function assignProductNewness(
  product: NewnessInput,
  _previousUrls: ReadonlySet<string> | null,
): AssignedNewness {
  if (product.inNewArrivals) {
    return { isNew: true, newnessEvidence: "NEW_ARRIVALS_COLLECTION" };
  }
  if (product.hasNewBadge) {
    return { isNew: true, newnessEvidence: "SOURCE_BADGE" };
  }
  return { isNew: false, newnessEvidence: null };
}
