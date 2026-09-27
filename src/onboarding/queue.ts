import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { isValidHttpUrl, normalizeBrandName, normalizeOfficialUrl } from "../registry/build/normalize";
import type { BrandUniverseEntry } from "../registry/build/types";
import { buildAdapterWorkQueue, priorityBrandRank } from "./adapterWorkQueue";
import {
  ADAPTER_WORK_QUEUE_PATH,
  INITIAL_ONBOARDING_BRANDS,
  ONBOARDING_MAX_ACTIVATIONS_PER_RUN,
  ONBOARDING_MAX_ATTEMPTS_PER_RUN,
  ONBOARDING_RETRY_DAYS,
  QUEUE_PATH,
  RETRYABLE_STATUSES,
  TERMINAL_SKIP_STATUSES,
  isRetryDue,
} from "./policy";
import type {
  BrandOnboardingQueueEntry,
  BrandOnboardingQueueFile,
  OnboardingStatus,
} from "./types";

const TRACKING_PRIORITY_ORDER: Record<BrandUniverseEntry["trackingPriority"], number> = {
  P1: 1,
  P2: 2,
  P3: 3,
};

export function emptyQueueEntry(
  brand: string,
  slug: string,
  priority: number,
  sourceUrl: string | null = null,
): BrandOnboardingQueueEntry {
  return {
    brand,
    slug,
    priority,
    status: "PENDING",
    attempts: 0,
    lastAttemptAt: null,
    nextRetryAt: null,
    sourceUrl,
    detectedPlatform: null,
    collectorStrategy: null,
    blocker: null,
    productsFound: 0,
    activatedAt: null,
    notes: null,
  };
}

export function createInitialQueue(
  sourceUrls: Record<string, string | null> = {},
  now = new Date(),
): BrandOnboardingQueueFile {
  return {
    version: 1,
    updatedAt: now.toISOString(),
    policy: {
      maxAttemptsPerRun: ONBOARDING_MAX_ATTEMPTS_PER_RUN,
      maxActivationsPerRun: ONBOARDING_MAX_ACTIVATIONS_PER_RUN,
      retryDays: ONBOARDING_RETRY_DAYS,
    },
    entries: INITIAL_ONBOARDING_BRANDS.map((item) =>
      emptyQueueEntry(
        item.brand,
        item.slug,
        item.priority,
        item.sourceUrl ?? sourceUrls[item.slug] ?? null,
      ),
    ),
  };
}

export function mergeQueueWithDefaults(
  current: BrandOnboardingQueueFile | null,
  sourceUrls: Record<string, string | null> = {},
  now = new Date(),
): BrandOnboardingQueueFile {
  const base = current ?? createInitialQueue(sourceUrls, now);
  const bySlug = new Map(base.entries.map((entry) => [entry.slug, entry]));
  for (const item of INITIAL_ONBOARDING_BRANDS) {
    const preferredSourceUrl = item.sourceUrl ?? sourceUrls[item.slug] ?? null;
    const existing = bySlug.get(item.slug);
    if (existing) {
      if (!existing.sourceUrl && preferredSourceUrl) {
        existing.sourceUrl = preferredSourceUrl;
      }
      continue;
    }
    bySlug.set(
      item.slug,
      emptyQueueEntry(item.brand, item.slug, item.priority, preferredSourceUrl),
    );
  }
  return {
    version: 1,
    updatedAt: now.toISOString(),
    policy: {
      maxAttemptsPerRun: ONBOARDING_MAX_ATTEMPTS_PER_RUN,
      maxActivationsPerRun: ONBOARDING_MAX_ACTIVATIONS_PER_RUN,
      retryDays: ONBOARDING_RETRY_DAYS,
    },
    entries: [...bySlug.values()].sort((a, b) => a.priority - b.priority),
  };
}

/**
 * Keeps historical queue state, then appends every eligible inactive universe
 * brand. Universe order is not trusted: new priorities are deterministic.
 */
export function mergeQueueWithUniverseCandidates(
  current: BrandOnboardingQueueFile | null,
  universeBrands: readonly BrandUniverseEntry[],
  now = new Date(),
): BrandOnboardingQueueFile {
  const sourceUrls = Object.fromEntries(
    universeBrands.map((entry) => [entry.id, entry.officialUrl || null]),
  );
  const base = mergeQueueWithDefaults(current, sourceUrls, now);
  const bySlug = new Map(base.entries.map((entry) => [entry.slug, { ...entry }]));
  const seenNames = new Map(
    base.entries.map((entry) => [normalizeBrandName(entry.brand), entry.slug]),
  );
  const seenUrls = new Map(
    base.entries
      .filter((entry) => entry.sourceUrl)
      .map((entry) => [normalizeOfficialUrl(entry.sourceUrl!), entry.slug]),
  );
  let nextPriority = Math.max(0, ...base.entries.map((entry) => entry.priority)) + 1;

  const candidates = universeBrands
    .filter((entry) => !entry.isActive && entry.womenFootwearRelevant)
    .sort((a, b) => {
      const priority =
        TRACKING_PRIORITY_ORDER[a.trackingPriority] - TRACKING_PRIORITY_ORDER[b.trackingPriority];
      return priority || a.brand.localeCompare(b.brand, "tr");
    });

  for (const candidate of candidates) {
    const sourceUrl = candidate.officialUrl?.trim() || null;
    const existing = bySlug.get(candidate.id);
    if (existing) {
      if (!existing.sourceUrl && sourceUrl && isValidHttpUrl(sourceUrl)) {
        existing.sourceUrl = sourceUrl;
      }
      continue;
    }

    const normalizedName = normalizeBrandName(candidate.brand);
    const normalizedUrl = sourceUrl ? normalizeOfficialUrl(sourceUrl) : null;
    if (seenNames.has(normalizedName)) continue;
    if (normalizedUrl && seenUrls.has(normalizedUrl)) continue;

    const entry = emptyQueueEntry(candidate.brand, candidate.id, nextPriority, sourceUrl);
    nextPriority += 1;
    if (!sourceUrl || !isValidHttpUrl(sourceUrl)) {
      entry.status = "BLOCKED";
      entry.blocker = "valid officialUrl required";
    } else if (
      candidate.collectionStatus === "NEEDS_CUSTOM_ADAPTER" ||
      candidate.collectorType === "CUSTOM_ADAPTER"
    ) {
      entry.status = "CUSTOM_ADAPTER_REQUIRED";
      entry.blocker = "official source requires a dedicated collector";
    } else if (candidate.collectionStatus === "DISABLED") {
      entry.status = "BLOCKED";
      entry.blocker = "brand is disabled in the universe registry";
    } else if (candidate.collectionStatus === "FAILED") {
      entry.status = "FAILED";
      entry.blocker = "previous universe probe failed";
    }

    bySlug.set(candidate.id, entry);
    seenNames.set(normalizedName, candidate.id);
    if (normalizedUrl) seenUrls.set(normalizedUrl, candidate.id);
  }

  return {
    ...base,
    updatedAt: now.toISOString(),
    entries: [...bySlug.values()].sort((a, b) => a.priority - b.priority),
  };
}

export function selectQueueCandidates(
  queue: BrandOnboardingQueueFile,
  options: {
    now?: Date;
    limit?: number;
    only?: string[];
    skipSlugs?: Set<string>;
  } = {},
): BrandOnboardingQueueEntry[] {
  const now = options.now ?? new Date();
  const limit = options.limit ?? queue.policy.maxAttemptsPerRun;
  const only = options.only?.map((value) => value.trim().toLowerCase()) ?? null;
  const skip = options.skipSlugs ?? new Set<string>();

  const eligible = queue.entries
    .filter((entry) => {
      if (skip.has(entry.slug)) return false;
      if (only && !only.includes(entry.slug) && !only.includes(entry.brand.toLowerCase())) {
        return false;
      }
      if (TERMINAL_SKIP_STATUSES.has(entry.status)) return false;
      if (entry.status === "BLOCKED" && (!entry.sourceUrl || !isValidHttpUrl(entry.sourceUrl))) return false;
      if (!RETRYABLE_STATUSES.has(entry.status) && entry.status !== "READY") return false;
      if (!isRetryDue(entry.nextRetryAt, now)) return false;
      return true;
    })
    .sort((a, b) => priorityBrandRank(a.slug) - priorityBrandRank(b.slug) || a.priority - b.priority);
  const selected = eligible.slice(0, Math.max(0, limit));

  // Keep luxury brands first, but reserve one discovery attempt when all nightly
  // slots would otherwise be spent on the fixed priority list. Explicit --only
  // requests and smaller diagnostic runs retain their exact selection order.
  if (!only && limit >= 5 && selected.length === limit &&
      selected.every((entry) => priorityBrandRank(entry.slug) !== Number.MAX_SAFE_INTEGER)) {
    const unprobed = eligible.find((entry) =>
      priorityBrandRank(entry.slug) === Number.MAX_SAFE_INTEGER &&
      entry.status === "PENDING" && Boolean(entry.sourceUrl && isValidHttpUrl(entry.sourceUrl)),
    );
    if (unprobed) selected[selected.length - 1] = unprobed;
  }
  return selected;
}

export function remainingActivationSlots(
  maxActivations: number,
  alreadyActivated: number,
): number {
  return Math.max(0, maxActivations - alreadyActivated);
}

export function blockedDoesNotConsumeActivationQuota(
  status: OnboardingStatus,
): boolean {
  return (
    status === "BLOCKED" ||
    status === "PRIORITY_BLOCKED" ||
    status === "CUSTOM_ADAPTER_REQUIRED" ||
    status === "FAILED" ||
    status === "STORAGE_LIMIT"
  );
}

export async function loadQueueFile(root: string): Promise<BrandOnboardingQueueFile | null> {
  try {
    const raw = JSON.parse(await readFile(join(root, QUEUE_PATH), "utf-8")) as BrandOnboardingQueueFile;
    if (raw.version !== 1 || !Array.isArray(raw.entries)) return null;
    return raw;
  } catch {
    return null;
  }
}

export async function saveQueueFile(
  root: string,
  queue: BrandOnboardingQueueFile,
): Promise<void> {
  const path = join(root, QUEUE_PATH);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(queue, null, 2), "utf-8");
  const adapterPath = join(root, ADAPTER_WORK_QUEUE_PATH);
  await mkdir(dirname(adapterPath), { recursive: true });
  await writeFile(adapterPath, JSON.stringify(buildAdapterWorkQueue(queue), null, 2), "utf-8");
}

export function updateQueueEntry(
  queue: BrandOnboardingQueueFile,
  slug: string,
  patch: Partial<BrandOnboardingQueueEntry>,
  now = new Date(),
): BrandOnboardingQueueFile {
  return {
    ...queue,
    updatedAt: now.toISOString(),
    entries: queue.entries.map((entry) =>
      entry.slug === slug ? { ...entry, ...patch } : entry,
    ),
  };
}
