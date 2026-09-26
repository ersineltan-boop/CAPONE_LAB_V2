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
 * NEW requires official New Arrivals membership, or a product URL that
 * appears only after a previous last-good catalog exists.
 */
export function assignProductNewness(
  product: NewnessInput,
  previousUrls: ReadonlySet<string> | null,
): AssignedNewness {
  if (product.inNewArrivals) {
    return { isNew: true, newnessEvidence: "NEW_ARRIVALS_COLLECTION" };
  }
  if (previousUrls && !previousUrls.has(product.productUrl)) {
    return { isNew: true, newnessEvidence: "CATALOG_DIFF" };
  }
  return { isNew: false, newnessEvidence: null };
}
