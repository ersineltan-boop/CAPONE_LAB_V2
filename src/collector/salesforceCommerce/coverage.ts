import type {
  SalesforceCatalogStatus,
  SalesforceColorway,
  SalesforceQuarantine,
  SalesforceQuarantineReason,
} from "./types";

export interface SalesforceAssessmentInput {
  blocked: boolean;
  sourceReportedTotal: number | null;
  scopeProductUrls: readonly string[];
  accepted: readonly SalesforceColorway[];
  quarantined: readonly SalesforceQuarantine[];
  paginationExhausted: boolean;
  pageErrors: readonly string[];
}

export interface SalesforceAssessment {
  status: SalesforceCatalogStatus;
  blocker: string | null;
  newProducts: number;
}

const INCOMPLETE_REASONS = new Set<SalesforceQuarantineReason>([
  "missing-gallery",
  "missing-size",
  "missing-sku",
  "uncertain",
  "off-scope",
]);

function sizeRecordsComplete(colorway: SalesforceColorway): boolean {
  if (colorway.sizes.length === 0) return false;
  return Boolean(colorway.sku) || colorway.sizes.some((size) => Boolean(size.sku));
}

/**
 * FULL means the same storefront, country, and collection was paginated to the
 * source total, every URL is either women's footwear or an explicit quarantine,
 * and accepted colourways keep real galleries plus size SKUs.
 * A blocked source is never FULL. The first catalog is a baseline: nothing is NEW.
 */
export function assessSalesforceCatalog(input: SalesforceAssessmentInput): SalesforceAssessment {
  const newProducts = input.accepted.filter((product) => product.isNew || product.hasNewBadge || product.inNewArrivals).length;
  if (input.blocked) {
    return { status: "BLOCKED", blocker: "OFFICIAL_STOREFRONT_BLOCKED", newProducts };
  }
  if (input.pageErrors.length > 0 && input.scopeProductUrls.length === 0) {
    return { status: "FAILED", blocker: "SOURCE_REQUEST_FAILED", newProducts };
  }
  if (input.sourceReportedTotal === null) {
    return { status: "PARTIAL", blocker: "SOURCE_TOTAL_UNKNOWN", newProducts };
  }
  if (!input.paginationExhausted) {
    return { status: "PARTIAL", blocker: "PAGINATION_NOT_EXHAUSTED", newProducts };
  }
  if (input.scopeProductUrls.length !== input.sourceReportedTotal) {
    return { status: "PARTIAL", blocker: "SOURCE_TOTAL_NOT_RECONCILED", newProducts };
  }
  if (input.accepted.length + input.quarantined.length !== input.scopeProductUrls.length) {
    return { status: "PARTIAL", blocker: "SCOPE_URLS_NOT_CLASSIFIED", newProducts };
  }
  if (input.quarantined.some((item) => INCOMPLETE_REASONS.has(item.reason))) {
    return { status: "PARTIAL", blocker: "INCOMPLETE_PRODUCT_RECORDS", newProducts };
  }
  if (input.accepted.some((product) => product.images.length === 0 || !sizeRecordsComplete(product))) {
    return { status: "PARTIAL", blocker: "GALLERY_OR_SKU_INCOMPLETE", newProducts };
  }
  if (newProducts > 0) {
    return { status: "PARTIAL", blocker: "BASELINE_MARKED_NEW", newProducts };
  }
  if (input.pageErrors.length > 0) {
    return { status: "PARTIAL", blocker: "PAGE_ERRORS", newProducts };
  }
  return { status: "FULL", blocker: null, newProducts: 0 };
}

export function decideSalesforcePublish(input: {
  previousAccepted: number | null;
  status: SalesforceCatalogStatus;
  acceptedFootwear: number;
}): { publish: boolean; retainPrevious: boolean; blocker: string | null } {
  const hasPrevious = input.previousAccepted !== null && input.previousAccepted > 0;
  if (input.status !== "FULL" || input.acceptedFootwear === 0) {
    return {
      publish: false,
      retainPrevious: hasPrevious,
      blocker: input.status === "FULL" ? "EMPTY_OR_FAILED_COLLECT" : input.status,
    };
  }
  if (
    hasPrevious &&
    input.previousAccepted !== null &&
    input.acceptedFootwear < input.previousAccepted * 0.6
  ) {
    return {
      publish: false,
      retainPrevious: true,
      blocker: "CATASTROPHIC_CATALOG_DROP",
    };
  }
  return { publish: true, retainPrevious: false, blocker: null };
}
