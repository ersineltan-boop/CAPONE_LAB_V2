import type { FootwearCategory } from "../../collector/types";
import type { NewnessEvidenceType } from "../../newArrivals/newness";

export const WAVE_BRAND_TARGET = 100;
export const WAVE_ACCESSIBLE_COLLECT_LIMIT = 50;
export const WAVE_COLLECTOR_CONCURRENCY = 10;

export type WaveDisposition =
  | "ACCESSIBLE"
  | "SOURCE_UNAVAILABLE"
  | "CUSTOM_ADAPTER_REQUIRED";

export interface WaveBrandSeed {
  slug: string;
  brand: string;
  officialUrl: string;
  womenCollectionPath?: string;
  newArrivalsPath?: string;
  referenceFootwearTotal?: number;
  referenceNewArrivals?: number;
}

export interface WaveHttpResponse {
  ok: boolean;
  status: number;
  url: string;
  data: unknown | null;
  text: string;
  error?: string;
}

export interface WaveHttp {
  fetch(url: string): Promise<WaveHttpResponse>;
}

export interface WaveColorway {
  productUrl: string;
  handle: string;
  title: string;
  color: string | null;
  sku: string | null;
  images: string[];
  category: FootwearCategory;
  productType: string;
  inNewArrivals: boolean;
  isNew: boolean;
  newnessEvidence: NewnessEvidenceType | null;
}

export interface WaveModelFamily {
  modelFamilyId: string;
  brand: string;
  canonicalName: string;
  category: FootwearCategory;
  images: string[];
  variants: WaveColorway[];
  isNew: boolean;
  groupingReason: "shopify-variant-tag" | "handle-family" | "single-product";
}

export interface WaveCoverage {
  sourceTotal: number | null;
  collected: number;
  missing: number | null;
  coverage: number | null;
  excluded: number;
  paginationExhausted: boolean;
  galleryComplete: number;
  taxonomyPassed: boolean;
  womenFootwearOnly: boolean;
  sampleOnly: boolean;
}

export interface WaveCatalog {
  slug: string;
  brand: string;
  officialUrl: string;
  snapshotId: string;
  collectedAt: string;
  catalogPaths: string[];
  newArrivalsPaths: string[];
  coverage: WaveCoverage;
  newArrivalsFootwear: number;
  referenceFootwearTotal: number | null;
  referenceNewArrivals: number | null;
  referenceFootwearMatch: boolean | null;
  referenceNewArrivalsMatch: boolean | null;
  families: WaveModelFamily[];
  productUrls: string[];
}

export interface WaveBrandOutcome {
  slug: string;
  brand: string;
  officialUrl: string;
  disposition: WaveDisposition;
  platform: "SHOPIFY" | "UNKNOWN";
  attemptedAt: string;
  fullCatalogPassed: boolean;
  published: boolean;
  lastGoodRetained: boolean;
  blocker: string | null;
  coverage: WaveCoverage | null;
  newArrivalsFootwear: number | null;
  families: number | null;
  referenceFootwearMatch: boolean | null;
  referenceNewArrivalsMatch: boolean | null;
}

export interface WaveRunReport {
  version: 1;
  generatedAt: string;
  concurrency: number;
  attempted: number;
  accessible: number;
  fullCatalogPassed: number;
  publishedCatalogs: number;
  customAdapter: number;
  sourceUnavailable: number;
  stagingProducts: number;
  universeBrandsBefore: number;
  universeBrandsAfter: number;
  activeBrandsBefore: number;
  activeBrandsAfter: number;
  netNewUniverseBrands: number;
  netNewActiveBrands: number;
  newActivations: Array<{ slug: string; brand: string }>;
  /** Model families already on brand pages before the full-catalog shard link. */
  initialSiteDeliveryFamilies: number;
  siteDeliveryFamilies: number;
  siteDeliveryProducts: number;
  collectTargets: number;
  outcomes: WaveBrandOutcome[];
}
