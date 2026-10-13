import type { FootwearCategory } from "../types";

export type SalesforceCatalogStatus = "FULL" | "PARTIAL" | "BLOCKED" | "FAILED";

export type SalesforceGender = "FEMALE" | "MALE" | "UNKNOWN";

export type SalesforceQuarantineReason =
  | "non-footwear"
  | "mens"
  | "uncertain"
  | "missing-gallery"
  | "missing-size"
  | "missing-sku"
  | "off-scope";

export interface SalesforceScope {
  brand: string;
  slug: string;
  officialUrl: string;
  storefront: "en-us";
  country: "US";
  collectionUrl: string;
  collectionId: string;
  sourceStrategy: string;
  storefrontCurrency: string | null;
}

export interface SalesforceSizeSku {
  size: string;
  displaySize: string | null;
  sku: string | null;
  selectable: boolean | null;
}

export interface SalesforceColorway {
  sourceDescription?: string;
  sourceHsCode?: string;
  productId: string;
  productUrl: string;
  productName: string;
  color: string | null;
  material: string | null;
  /** Colourway SKU when the storefront publishes one. Size-specific SKUs stay on sizes. */
  sku: string | null;
  category: FootwearCategory | null;
  images: string[];
  sizes: SalesforceSizeSku[];
  modelCode: string;
  gender: SalesforceGender;
  sourceCategoryId: string | null;
  sourceCategoryName: string | null;
  inNewArrivals: false;
  isNew: false;
  hasNewBadge: false;
}

export interface SalesforceQuarantine {
  productId: string;
  productUrl: string;
  productName: string;
  reason: SalesforceQuarantineReason;
}

export interface SalesforceModelCard {
  modelFamilyId: string;
  brand: string;
  canonicalName: string;
  modelCode: string;
  category: FootwearCategory | null;
  coverImage: string | null;
  images: string[];
  colorways: SalesforceColorway[];
  isNew: false;
}

// Pure evidence types may be consumed by browser-facing model types.
// Keep collector implementation and platform APIs out of these shared types.
export interface CasadeiPageEvidence {
  url: string;
  offset: number | null;
  total: number | null;
  rawCount: number;
  products: Array<{productId: string; productUrl: string}>;
}
export interface CasadeiReconciliation {
  pages: CasadeiPageEvidence[];
  replayPages: CasadeiPageEvidence[];
  duplicateOccurrences: number;
  uniqueProductCount: number;
}

export interface SalesforceCatalog {
  casadeiReconciliation?: CasadeiReconciliation;
  scope: SalesforceScope;
  collectedAt: string;
  status: SalesforceCatalogStatus;
  blocker: string | null;
  sourceReportedTotal: number | null;
  scopeProductUrls: string[];
  accepted: SalesforceColorway[];
  quarantined: SalesforceQuarantine[];
  families: SalesforceModelCard[];
  pagesVisited: string[];
  paginationExhausted: boolean;
  errors: string[];
  newProducts: number;
  attempts?: Array<{ url: string; status: number; title: string | null }>;
}

export interface SalesforceHttpResult {
  ok: boolean;
  status: number;
  text: string;
  url: string;
  error?: string;
}

export interface SalesforceHttp {
  fetchText(url: string): Promise<SalesforceHttpResult>;
}
