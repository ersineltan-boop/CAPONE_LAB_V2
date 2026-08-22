import {
  CLOUD_REFRESH_CORE_DATA_PATHS,
  CLOUD_REFRESH_MODEL_FAMILY_DIR,
  CLOUD_REFRESH_TRACKED_DATA_PATHS,
  normalizeRepoPath,
  shouldStageCloudRefreshPath,
} from "../refresh/refreshPolicy";
import type { OnboardingStatus } from "./types";

export const ONBOARDING_RETRY_DAYS = 7;
export const ONBOARDING_MAX_ATTEMPTS_PER_RUN = 5;
export const ONBOARDING_MAX_ACTIVATIONS_PER_RUN = 3;
export const ONBOARDING_STORAGE_LIMIT_BYTES = 90 * 1024 * 1024;
export const ONBOARDING_GITHUB_FILE_HARD_LIMIT_BYTES = 100 * 1024 * 1024;

export const QUEUE_PATH = "data/registry/brand-onboarding-queue.json";
export const REPORT_PATH = "data/registry/brand-onboarding-report.json";
export const ADAPTERS_PATH = "data/onboarding/brand-adapters.json";
export const STAGING_DIR = "data/onboarding/staging";
export const UNIVERSE_PATH = "data/registry/brand-universe.json";
export const BRANDS_TS_PATH = "src/registry/data/brands.ts";
export const UNIVERSE_REPORT_PATH = "data/registry/brand-universe-report.json";

export const INITIAL_ONBOARDING_BRANDS: readonly {
  brand: string;
  slug: string;
  priority: number;
}[] = [
  { brand: "MAISON MARGIELA", slug: "maison-margiela", priority: 1 },
  { brand: "ISABEL MARANT", slug: "isabel-marant", priority: 2 },
  { brand: "MANGO", slug: "mango", priority: 3 },
  { brand: "MASSIMO DUTTI", slug: "massimo-dutti", priority: 4 },
  { brand: "COS", slug: "cos", priority: 5 },
  { brand: "GANNI", slug: "ganni", priority: 6 },
  { brand: "AQUAZZURA", slug: "aquazzura", priority: 7 },
  { brand: "GIANVITO ROSSI", slug: "gianvito-rossi", priority: 8 },
  { brand: "STUART WEITZMAN", slug: "stuart-weitzman", priority: 9 },
  { brand: "SAM EDELMAN", slug: "sam-edelman", priority: 10 },
  { brand: "VAGABOND", slug: "vagabond-shoemakers", priority: 11 },
];

export const EXISTING_DEDICATED_ADAPTER_IDS = new Set(["zara", "dries-van-noten"]);

export const PRIORITY_BRAND_SLUGS = new Set(
  INITIAL_ONBOARDING_BRANDS.filter((item) => item.priority <= 2).map((item) => item.slug),
);

export const RETRYABLE_STATUSES = new Set<OnboardingStatus>([
  "PENDING",
  "BLOCKED",
  "PRIORITY_BLOCKED",
  "CUSTOM_ADAPTER_REQUIRED",
  "FAILED",
  "PARTIAL",
]);

export const TERMINAL_SKIP_STATUSES = new Set<OnboardingStatus>(["ACTIVE", "STORAGE_LIMIT"]);

export const ONBOARDING_EXTRA_STAGE_PATHS = [
  QUEUE_PATH,
  REPORT_PATH,
  ADAPTERS_PATH,
  UNIVERSE_PATH,
  BRANDS_TS_PATH,
  UNIVERSE_REPORT_PATH,
] as const;

const BLOCKED_ONBOARDING_PREFIXES = [
  "public/data/catalog/",
  "dist/",
  "node_modules/",
  "logs/",
  "data/onboarding/staging/",
] as const;

export function stagingDirForBrand(slug: string): string {
  return `${STAGING_DIR}/${slug}`;
}

export function retryAt(from: Date, days = ONBOARDING_RETRY_DAYS): string {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function isRetryDue(nextRetryAt: string | null, now: Date): boolean {
  if (!nextRetryAt) return true;
  return Date.parse(nextRetryAt) <= now.getTime();
}

export function storageLimitStatus(bytes: number): "ok" | "STORAGE_LIMIT" {
  return bytes >= ONBOARDING_STORAGE_LIMIT_BYTES ? "STORAGE_LIMIT" : "ok";
}

export function exceedsGithubHardLimit(bytes: number): boolean {
  return bytes >= ONBOARDING_GITHUB_FILE_HARD_LIMIT_BYTES;
}

export function shouldStageOnboardingPath(path: string): boolean {
  const normalized = normalizeRepoPath(path);
  if (!normalized) return false;
  if (BLOCKED_ONBOARDING_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
  if (normalized.startsWith(".env")) return false;
  if (normalized.endsWith(".log")) return false;
  if ((ONBOARDING_EXTRA_STAGE_PATHS as readonly string[]).includes(normalized)) return true;
  return shouldStageCloudRefreshPath(normalized);
}

export function onboardingPublishAllowlist(): string[] {
  return [
    ...CLOUD_REFRESH_CORE_DATA_PATHS,
    CLOUD_REFRESH_MODEL_FAMILY_DIR,
    ...CLOUD_REFRESH_TRACKED_DATA_PATHS,
    ...ONBOARDING_EXTRA_STAGE_PATHS,
  ];
}

export interface PublishGateInput {
  testsPassed: boolean;
  buildPassed: boolean;
  storageStatus: "ok" | "STORAGE_LIMIT";
  trackedFileTooLarge: boolean;
}

export function canPublishOnboardingCommit(input: PublishGateInput): boolean {
  return (
    input.testsPassed &&
    input.buildPassed &&
    input.storageStatus === "ok" &&
    !input.trackedFileTooLarge
  );
}
