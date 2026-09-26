import type { BrandUniverseEntry, BrandUniverseFile } from "../registry/build/types";
import type {
  BrandOnboardingQueueEntry,
  BrandOnboardingQueueFile,
  BrandOnboardingReportFile,
  OnboardingStatus,
} from "../onboarding/types";
import type { BrandDiscoveryReport, DiscoveredBrandCandidate } from "../onboarding/discovery";
import { PRIORITY_BRAND_IDS, priorityBrandRank } from "../onboarding/adapterWorkQueue";

export type DashboardFilter =
  | "ALL"
  | "PRIORITY"
  | "TONIGHT"
  | "READY"
  | "PARTIAL"
  | "CUSTOM_ADAPTER_REQUIRED"
  | "BLOCKED"
  | "DISCOVERED";

export interface DashboardBrand {
  id: string;
  brand: string;
  country: string;
  officialUrl: string | null;
  isActive: boolean;
  status: OnboardingStatus;
  attempts: number;
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
  productsFound: number;
  blocker: string | null;
  platform: string | null;
  priority: number;
  isTonight: boolean;
  isPriority: boolean;
}

export interface BrandOnboardingDashboard {
  generatedAt: string;
  lastRunAt: string | null;
  nextRunLabel: string;
  summary: {
    active: number;
    candidatePool: number;
    tonight: number;
    readyOrActivated: number;
    customAdapter: number;
    blocked: number;
    discovered: number;
  };
  brands: DashboardBrand[];
  discoveries: DiscoveredBrandCandidate[];
}

const RETRYABLE = new Set<OnboardingStatus>([
  "PENDING",
  "BLOCKED",
  "PRIORITY_BLOCKED",
  "FAILED",
  "PARTIAL",
  "READY",
]);

function fallbackStatus(entry: BrandUniverseEntry): OnboardingStatus {
  if (entry.isActive) return "ACTIVE";
  if (entry.collectionStatus === "NEEDS_CUSTOM_ADAPTER") return "CUSTOM_ADAPTER_REQUIRED";
  if (entry.collectionStatus === "FAILED") return "FAILED";
  if (entry.collectionStatus === "DISABLED") return "BLOCKED";
  return "PENDING";
}

function due(entry: DashboardBrand, now: Date): boolean {
  if (!RETRYABLE.has(entry.status)) return false;
  if (!entry.officialUrl) return false;
  if (entry.status === "BLOCKED" && !/^https?:\/\//i.test(entry.officialUrl)) return false;
  if (!entry.nextRetryAt) return true;
  return Date.parse(entry.nextRetryAt) <= now.getTime();
}

export function buildBrandOnboardingDashboard(
  universe: BrandUniverseFile,
  queue: BrandOnboardingQueueFile,
  report: BrandOnboardingReportFile,
  discovery: BrandDiscoveryReport,
  now = new Date(),
): BrandOnboardingDashboard {
  const queueBySlug = new Map(queue.entries.map((entry) => [entry.slug, entry]));
  const fallbackPriority = new Map(
    universe.brands
      .filter((entry) => !entry.isActive)
      .sort((a, b) => a.brand.localeCompare(b.brand, "tr"))
      .map((entry, index) => [entry.id, 10_000 + index]),
  );
  const brands: DashboardBrand[] = universe.brands.map((entry) => {
    const queued: BrandOnboardingQueueEntry | undefined = queueBySlug.get(entry.id);
    return {
      id: entry.id,
      brand: entry.brand,
      country: entry.country,
      officialUrl: entry.officialUrl || null,
      isActive: entry.isActive,
      status: queued?.status ?? fallbackStatus(entry),
      attempts: queued?.attempts ?? 0,
      lastAttemptAt: queued?.lastAttemptAt ?? null,
      nextRetryAt: queued?.nextRetryAt ?? null,
      productsFound: queued?.productsFound ?? 0,
      blocker: queued?.blocker ?? null,
      platform: queued?.detectedPlatform ?? null,
      priority: queued?.priority ?? fallbackPriority.get(entry.id) ?? 99_999,
      isTonight: false,
      isPriority: PRIORITY_BRAND_IDS.includes(entry.id),
    };
  });

  const tonightIds = new Set(
    brands
      .filter((entry) => !entry.isActive && due(entry, now))
      .sort((a, b) => priorityBrandRank(a.id) - priorityBrandRank(b.id) || a.priority - b.priority || a.brand.localeCompare(b.brand, "tr"))
      .slice(0, Math.max(0, queue.policy.maxAttemptsPerRun))
      .map((entry) => entry.id),
  );
  for (const brand of brands) brand.isTonight = tonightIds.has(brand.id);

  return {
    generatedAt: discovery.generatedAt,
    lastRunAt: report.generatedAt || null,
    nextRunLabel: "Her gün 00:30 Türkiye saati",
    summary: {
      active: brands.filter((entry) => entry.isActive).length,
      candidatePool: brands.filter((entry) => !entry.isActive).length,
      tonight: tonightIds.size,
      readyOrActivated: brands.filter(
        (entry) => entry.status === "READY" || (entry.status === "ACTIVE" && entry.attempts > 0),
      ).length,
      customAdapter: brands.filter((entry) => entry.status === "CUSTOM_ADAPTER_REQUIRED").length,
      blocked: brands.filter((entry) =>
        ["BLOCKED", "PRIORITY_BLOCKED", "FAILED", "STORAGE_LIMIT"].includes(entry.status),
      ).length,
      discovered: discovery.candidates.length,
    },
    brands: brands.sort((a, b) => {
      if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1;
      if (a.isPriority && b.isPriority) {
        return priorityBrandRank(a.id) - priorityBrandRank(b.id);
      }
      if (a.isTonight !== b.isTonight) return a.isTonight ? -1 : 1;
      if (a.isActive !== b.isActive) return a.isActive ? 1 : -1;
      return a.priority - b.priority || a.brand.localeCompare(b.brand, "tr");
    }),
    discoveries: discovery.candidates,
  };
}

export function statusLabel(status: OnboardingStatus): string {
  const labels: Record<OnboardingStatus, string> = {
    PENDING: "Sırada",
    PROBING: "Kaynak inceleniyor",
    VALIDATING: "Kalite kontrolünde",
    READY: "Yüklemeye hazır",
    ACTIVE: "Aktif",
    PARTIAL: "Eksik kapsam",
    BLOCKED: "Engelli",
    PRIORITY_BLOCKED: "Kaynak engeli",
    CUSTOM_ADAPTER_REQUIRED: "Özel adaptör gerekli",
    FAILED: "Başarısız",
    STORAGE_LIMIT: "Depolama sınırı",
  };
  return labels[status];
}
