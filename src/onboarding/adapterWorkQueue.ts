import type { BrandOnboardingQueueFile } from "./types";

export interface AdapterWorkItem {
  brand: string;
  slug: string;
  priority: number;
  sourceUrl: string | null;
  blocker: string | null;
  attempts: number;
  lastAttemptAt: string | null;
}

export function buildAdapterWorkQueue(queue: BrandOnboardingQueueFile): AdapterWorkItem[] {
  return queue.entries
    .filter((entry) => entry.status === "CUSTOM_ADAPTER_REQUIRED")
    .sort((a, b) => a.priority - b.priority)
    .map((entry) => ({
      brand: entry.brand,
      slug: entry.slug,
      priority: entry.priority,
      sourceUrl: entry.sourceUrl,
      blocker: entry.blocker,
      attempts: entry.attempts,
      lastAttemptAt: entry.lastAttemptAt,
    }));
}
