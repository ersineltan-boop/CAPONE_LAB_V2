import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
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
      emptyQueueEntry(item.brand, item.slug, item.priority, sourceUrls[item.slug] ?? null),
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
    const existing = bySlug.get(item.slug);
    if (existing) {
      if (!existing.sourceUrl && sourceUrls[item.slug]) {
        existing.sourceUrl = sourceUrls[item.slug] ?? null;
      }
      continue;
    }
    bySlug.set(
      item.slug,
      emptyQueueEntry(item.brand, item.slug, item.priority, sourceUrls[item.slug] ?? null),
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

  return queue.entries
    .filter((entry) => {
      if (skip.has(entry.slug)) return false;
      if (only && !only.includes(entry.slug) && !only.includes(entry.brand.toLowerCase())) {
        return false;
      }
      if (TERMINAL_SKIP_STATUSES.has(entry.status)) return false;
      if (!RETRYABLE_STATUSES.has(entry.status) && entry.status !== "READY") return false;
      if (!isRetryDue(entry.nextRetryAt, now)) return false;
      return true;
    })
    .sort((a, b) => a.priority - b.priority)
    .slice(0, Math.max(0, limit));
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
