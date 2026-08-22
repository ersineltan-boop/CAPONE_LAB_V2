export type BrandSegment =
  | "DIRECTIONAL"
  | "LUXURY"
  | "PREMIUM"
  | "CONTEMPORARY"
  | "MASS_MARKET"
  | "UNCLASSIFIED";

export type BrandRole =
  | "LEADER"
  | "EARLY_ADOPTER"
  | "MARKET"
  | "RETAIL"
  | "UNCLASSIFIED";

export type ClassificationStatus = "UNREVIEWED" | "REVIEWED";

export type TrackingPriority = "P1" | "P2" | "P3";

export type CollectorType =
  | "UNKNOWN"
  | "SHOPIFY_PUBLIC"
  | "SHOPIFY_JSON"
  | "STRUCTURED_DATA"
  | "CUSTOM_ADAPTER"
  | "LINK_ONLY"
  | "UNSUPPORTED";

export type CollectionStatus =
  | "READY_AUTOMATIC"
  | "NEEDS_PROBE"
  | "NEEDS_CUSTOM_ADAPTER"
  | "NEEDS_FOOTWEAR_CONFIG"
  | "LINK_ONLY"
  | "FAILED"
  | "DISABLED";

export type CollectionDiscoveryStatus =
  | "VERIFIED"
  | "AUTO_DISCOVERED"
  | "UNKNOWN"
  | "NOT_FOUND"
  | "NEEDS_MANUAL_CONFIG";

export interface BrandRegistryEntry {
  id: string;
  brand: string;
  country: string;
  city?: string;
  segment: BrandSegment;
  role: BrandRole;
  /** Kadın ayakkabısı üzerindeki doğrudan etki — 0–100 */
  footwearInfluence: number;
  /** Genel moda yönü etkisi — 0–100; footwearInfluence ile aynı kabul edilmez */
  directionalInfluence: number;
  /** Ticari / pazar etkisi — 0–100 */
  commercialInfluence: number;
  trackingPriority: TrackingPriority;
  officialUrl: string | null;
  /** Opsiyonel koleksiyon giriş URL'si; boşsa officialUrl kullanılır */
  collectionUrl?: string | null;
  collectionPaths: readonly string[];
  footwearCollectionUrls?: readonly string[];
  footwearCollectionHandles?: readonly string[];
  collectionDiscoveryStatus?: CollectionDiscoveryStatus;
  collectorType: CollectorType;
  collectionStatus: CollectionStatus;
  productLimit: number;
  /** Smart backfill üst sınırı — en yeni footwear ürün kayıtları */
  backfillLimit?: number;
  newArrivalUrls?: readonly string[];
  newArrivalCollectionHandles?: readonly string[];
  newArrivalDiscoveryStatus?: "VERIFIED" | "NEEDS_PROBE" | "NOT_SUPPORTED";
  newArrivalEvidenceStrategy?: string;
  supportsMultipleImages: boolean;
  /** Pilot cache'den okumayı dene (mevcut pilot markalar için) */
  preferPilotCache?: boolean;
  /** İlişkili keşif kaynakları (source id veya referans etiketi) */
  discoverySources: readonly string[];
  isActive: boolean;
  notes: string;
  /** Premium/Commercial/Directional sınıflandırma durumu */
  classificationStatus: ClassificationStatus;
  /** REVIEWED + sınıflandırılmış markalar Radar influence scoring'e dahil edilir */
  radarEligible: boolean;
}

export const BRAND_SEGMENTS: readonly BrandSegment[] = [
  "DIRECTIONAL",
  "LUXURY",
  "PREMIUM",
  "CONTEMPORARY",
  "MASS_MARKET",
  "UNCLASSIFIED",
] as const;

export const BRAND_ROLES: readonly BrandRole[] = [
  "LEADER",
  "EARLY_ADOPTER",
  "MARKET",
  "RETAIL",
  "UNCLASSIFIED",
] as const;

export const CLASSIFICATION_STATUSES: readonly ClassificationStatus[] = [
  "UNREVIEWED",
  "REVIEWED",
] as const;

export const COLLECTOR_TYPES: readonly CollectorType[] = [
  "UNKNOWN",
  "SHOPIFY_PUBLIC",
  "SHOPIFY_JSON",
  "STRUCTURED_DATA",
  "CUSTOM_ADAPTER",
  "LINK_ONLY",
  "UNSUPPORTED",
] as const;

export const COLLECTION_STATUSES: readonly CollectionStatus[] = [
  "READY_AUTOMATIC",
  "NEEDS_PROBE",
  "NEEDS_CUSTOM_ADAPTER",
  "NEEDS_FOOTWEAR_CONFIG",
  "LINK_ONLY",
  "FAILED",
  "DISABLED",
] as const;

export const TRACKING_PRIORITIES: readonly TrackingPriority[] = [
  "P1",
  "P2",
  "P3",
] as const;
