export const ONBOARDING_STATUSES = [
  "PENDING",
  "PROBING",
  "VALIDATING",
  "READY",
  "ACTIVE",
  "PARTIAL",
  "BLOCKED",
  "PRIORITY_BLOCKED",
  "CUSTOM_ADAPTER_REQUIRED",
  "FAILED",
  "STORAGE_LIMIT",
] as const;

export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export const ONBOARDING_PLATFORMS = [
  "SHOPIFY",
  "INDITEX-LIKE PUBLIC CATALOG",
  "SALESFORCE COMMERCE",
  "NEXT.JS PUBLIC DATA",
  "STRUCTURED-DATA CATALOG",
  "SITEMAP PRODUCT CRAWL",
  "EXISTING CAPONE ADAPTER",
  "UNKNOWN",
] as const;

export type OnboardingPlatform = (typeof ONBOARDING_PLATFORMS)[number];

export type OnboardingStrategy =
  | "existing-adapter"
  | "shopify-public"
  | "inditex-like-catalog"
  | "sitemap-product-crawl"
  | "structured-data"
  | "html-listing"
  | "salesforce-public"
  | "nextjs-public-data"
  | "none";

export interface BrandOnboardingQueueEntry {
  brand: string;
  slug: string;
  priority: number;
  status: OnboardingStatus;
  attempts: number;
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
  sourceUrl: string | null;
  detectedPlatform: OnboardingPlatform | null;
  collectorStrategy: OnboardingStrategy | null;
  blocker: string | null;
  productsFound: number;
  activatedAt: string | null;
  notes: string | null;
}

export interface BrandOnboardingQueueFile {
  version: 1;
  updatedAt: string;
  policy: {
    maxAttemptsPerRun: number;
    maxActivationsPerRun: number;
    retryDays: number;
  };
  entries: BrandOnboardingQueueEntry[];
}

export interface BrandOnboardingAttemptReport {
  brand: string;
  slug: string;
  attemptedAt: string;
  detectedPlatform: OnboardingPlatform | null;
  sourceStrategy: OnboardingStrategy | null;
  status: OnboardingStatus;
  productsFound: number;
  families: number | null;
  realMultiColorFamilies: number | null;
  verifiedNewArrivals: number | null;
  galleryImageCoverage: number | null;
  categoriesFound: string[];
  blocker: string | null;
  marketplaceCoverage: {
    farfetch: number;
    levelShoes: number;
  } | null;
  activationDecision: "activate" | "partial" | "skip" | "blocked" | "dry-run";
  notes: string | null;
}

export interface BrandOnboardingReportFile {
  version: 1;
  generatedAt: string;
  dryRun: boolean;
  summary: {
    activeBrandsBefore: number;
    activeBrandsAfter: number;
    attempted: number;
    activated: number;
    partial: number;
    blocked: number;
    customAdapterRequired: number;
    failed: number;
    storageStatus: "ok" | "STORAGE_LIMIT" | "not-checked";
  };
  attempts: BrandOnboardingAttemptReport[];
}

export interface OnboardingAdapterConfig {
  platform: OnboardingPlatform;
  strategy: OnboardingStrategy;
  sourceUrl: string;
  locale?: string;
  collectionPaths?: string[];
  footwearPaths?: string[];
}

export interface OnboardingAdapterFile {
  version: 1;
  updatedAt: string;
  adapters: Record<string, OnboardingAdapterConfig>;
}

export interface OnboardingRunOptions {
  dryRun: boolean;
  limit?: number;
  maxActivations?: number;
  only?: string[];
  now?: Date;
}

export interface ProbeSampleProduct {
  productUrl: string;
  productName: string;
  imageUrl: string | null;
  images: string[];
  color: string | null;
  sku: string | null;
  sourceCategoryName: string | null;
}

export interface ProbeResult {
  platform: OnboardingPlatform;
  strategy: OnboardingStrategy;
  status: OnboardingStatus;
  sourceUrl: string | null;
  locale?: string;
  collectionPaths: string[];
  footwearPaths: string[];
  products: ProbeSampleProduct[];
  blocker: string | null;
  notes: string | null;
}
