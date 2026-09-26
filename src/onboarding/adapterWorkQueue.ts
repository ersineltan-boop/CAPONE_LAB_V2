import type { BrandOnboardingQueueFile } from "./types";

/** Official-source adapter work to complete before nightly activation can proceed. */
export const PRIORITY_ADAPTER_BRAND_IDS = [
  "massimo-dutti",
  "mango",
  "maison-margiela",
  "isabel-marant",
  "ganni",
  "aquazzura",
  "gianvito-rossi",
  "nodaleto",
  "reike-nen",
  "yuul-yie",
] as const;

export const PRIORITY_OFFICIAL_PROBE_IDS = [
  "jimmy-choo",
  "manolo-blahnik",
  "christian-louboutin",
  "bottega-veneta",
  "prada",
  "saint-laurent",
  "gucci",
  "valentino-garavani",
  "roger-vivier",
  "sergio-rossi",
] as const;

export const PRIORITY_BRAND_IDS: readonly string[] = [
  ...PRIORITY_ADAPTER_BRAND_IDS,
  ...PRIORITY_OFFICIAL_PROBE_IDS,
];

export function priorityBrandRank(slug: string): number {
  const index = PRIORITY_BRAND_IDS.indexOf(slug);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

const adapterPriority = new Map<string, number>(
  PRIORITY_ADAPTER_BRAND_IDS.map((slug, index) => [slug, index]),
);

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
    .sort((a, b) =>
      (adapterPriority.get(a.slug) ?? Number.MAX_SAFE_INTEGER) -
        (adapterPriority.get(b.slug) ?? Number.MAX_SAFE_INTEGER) ||
      a.priority - b.priority,
    )
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
