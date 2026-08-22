import type {
  BrandRole,
  BrandSegment,
  ClassificationStatus,
  CollectionStatus,
  CollectorType,
  TrackingPriority,
} from "../types/brand";

export type BrandUniverseSourceType = "BRAND";

/** brand-universe.json kaydı — influenceRole registry'deki role alanına map edilir. */
export interface BrandUniverseEntry {
  id: string;
  brand: string;
  officialUrl: string;
  country: string;
  city?: string;
  segment: BrandSegment;
  influenceRole: BrandRole;
  trackingPriority: TrackingPriority;
  isActive: boolean;
  collectorType: CollectorType;
  collectionStatus: CollectionStatus;
  footwearFocus?: string;
  womenFootwearRelevant: boolean;
  sourceType: BrandUniverseSourceType;
  notes: string;

  /** Registry genişletilmiş alanları — mevcut markalar için korunur */
  footwearInfluence: number;
  directionalInfluence: number;
  commercialInfluence: number;
  collectionUrl?: string | null;
  collectionPaths: string[];
  footwearCollectionUrls?: string[];
  footwearCollectionHandles?: string[];
  collectionDiscoveryStatus?: import("../types/brand").CollectionDiscoveryStatus;
  productLimit: number;
  backfillLimit?: number;
  supportsMultipleImages: boolean;
  preferPilotCache?: boolean;
  discoverySources: string[];
  classificationStatus: ClassificationStatus;
  radarEligible: boolean;
}

export interface BrandUniverseFile {
  version: 1;
  generatedAt?: string;
  brands: BrandUniverseEntry[];
}

export interface BrandUniverseValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  brandId?: string;
}

export interface BrandProbeCacheEntry {
  brandId: string;
  brand: string;
  officialUrl: string;
  detectedCollectorType: CollectorType;
  collectionStatus: CollectionStatus;
  probedAt: string;
  reachable: boolean;
  recommendation: string;
}

export interface BrandProbeCacheFile {
  version: 1;
  updatedAt: string;
  entries: Record<string, BrandProbeCacheEntry>;
}

export interface BrandUniverseBuildReport {
  generatedAt: string;
  totalBrands: number;
  activeBrands: number;
  inactiveBrands: number;
  readyAutomatic: number;
  needsProbe: number;
  needsCustomAdapter: number;
  failed: number;
  countryCounts: Record<string, number>;
  segmentCounts: Record<string, number>;
  priorityCounts: Record<string, number>;
  collectorTypeCounts: Record<string, number>;
  duplicateWarnings: string[];
  validationErrors: string[];
  probeCacheApplied: number;
  unreviewedBrands: number;
  radarIneligibleBrands: number;
}
