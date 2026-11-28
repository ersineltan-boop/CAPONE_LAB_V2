import { salesforceScope } from "../collector/salesforceCommerce/integration";
import { officialWaveScope, sameOfficialWaveScope } from "../collector/officialBrandWave";
import { isValidHttpUrl } from "../registry/build/normalize";
import { priorityBrandRank } from "./adapterWorkQueue";
import type { BrandOnboardingQueueEntry, BrandOnboardingQueueFile, OnboardingStatus } from "./types";

export const SCHEDULED_ONBOARDING_MAX_ATTEMPTS = 5;
export const SCHEDULED_ONBOARDING_MAX_ACTIVATIONS = 1;

export const RETRYABLE_STATUSES = new Set<OnboardingStatus>([
  "PENDING", "BLOCKED", "PRIORITY_BLOCKED", "FAILED", "PARTIAL",
]);

export const TERMINAL_SKIP_STATUSES = new Set<OnboardingStatus>([
  "ACTIVE", "STORAGE_LIMIT", "CUSTOM_ADAPTER_REQUIRED",
]);

export function isRetryDue(nextRetryAt: string | null, now: Date): boolean {
  if (!nextRetryAt) return true;
  return Date.parse(nextRetryAt) <= now.getTime();
}

export function selectQueueCandidates(
  queue: BrandOnboardingQueueFile,
  options: { now?: Date; limit?: number; only?: string[]; skipSlugs?: Set<string>; scheduled?: boolean } = {},
): BrandOnboardingQueueEntry[] {
  const now = options.now ?? new Date();
  const limit = options.limit ?? queue.policy.maxAttemptsPerRun;
  const only = options.only?.map((value) => value.trim().toLowerCase()) ?? null;
  const skip = options.skipSlugs ?? new Set<string>();
  const eligible = queue.entries
    .filter((entry) => {
      if (skip.has(entry.slug)) return false;
      const explicitlyTargeted = only !== null &&
        (only.includes(entry.slug) || only.includes(entry.brand.toLowerCase()));
      if (only && !explicitlyTargeted) return false;
      if (options.scheduled && (!entry.sourceUrl || !isValidHttpUrl(entry.sourceUrl))) return false;
      const scope = salesforceScope(entry.slug);
      const wave = officialWaveScope(entry.slug);
      const deliveredCustomAdapter = entry.status === "CUSTOM_ADAPTER_REQUIRED" &&
        Boolean(entry.sourceUrl && isValidHttpUrl(entry.sourceUrl) &&
          ((scope !== null && new URL(entry.sourceUrl).origin === scope.officialUrl) ||
            (wave !== null && sameOfficialWaveScope(wave.origin, new URL(entry.sourceUrl).origin))));
      if (TERMINAL_SKIP_STATUSES.has(entry.status) && !deliveredCustomAdapter) return false;
      if (entry.status === "BLOCKED" && (!entry.sourceUrl || !isValidHttpUrl(entry.sourceUrl))) return false;
      if (!RETRYABLE_STATUSES.has(entry.status) && entry.status !== "READY" && !deliveredCustomAdapter) return false;
      if (!explicitlyTargeted && !isRetryDue(entry.nextRetryAt, now)) return false;
      return true;
    })
    .sort((a, b) => priorityBrandRank(a.slug) - priorityBrandRank(b.slug) || a.priority - b.priority);
  const selected = eligible.slice(0, Math.max(0, limit));
  if (options.scheduled && !only && limit >= 2 && eligible.length > limit) {
    // Keep priority slots and rotate the final one across all due official sources.
    const lastAttempt = (entry: BrandOnboardingQueueEntry) => entry.lastAttemptAt ?? "";
    const oldest = eligible.slice(limit - 1).reduce((a, b) => lastAttempt(a) <= lastAttempt(b) ? a : b);
    selected[selected.length - 1] = oldest;
    return selected;
  }

  // Retain priority attempts while reserving one slot for a new official-source probe.
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
