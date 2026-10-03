import type { OnboardingAdapterFile, BrandOnboardingQueueFile } from "../../onboarding/types";
import type { BrandUniverseEntry, BrandUniverseFile } from "../../registry/build/types";
import type { WaveBrandSeed } from "../wave50/types";

export type BrandAutomationCandidateOrigin = "LAST_GOOD" | "APPROVED_QUEUE";

export interface BrandAutomationCandidate extends WaveBrandSeed {
  origin: BrandAutomationCandidateOrigin;
  wasActive: boolean;
}

export interface BrandAutomationPlan {
  candidates: BrandAutomationCandidate[];
  skipped: Array<{ slug: string; reason: string }>;
}

function normalizeHttpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return null;
    parsed.hash = "";
    parsed.search = "";
    return `${parsed.origin}${parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "")}`;
  } catch {
    return null;
  }
}

function candidateFromUniverse(
  entry: BrandUniverseEntry,
  origin: BrandAutomationCandidateOrigin,
  sourceUrl?: string | null,
): BrandAutomationCandidate | null {
  const officialUrl = normalizeHttpsUrl(sourceUrl ?? entry.officialUrl);
  if (!officialUrl) return null;
  return {
    slug: entry.id,
    brand: entry.brand,
    officialUrl,
    origin,
    wasActive: entry.isActive,
  };
}

/** Never discovers arbitrary brands: an operator-approved shard/adapter is required. */
export function buildBrandAutomationPlan(input: {
  universe: BrandUniverseFile;
  queue: BrandOnboardingQueueFile | null;
  adapters: OnboardingAdapterFile;
  lastGoodSlugs: ReadonlySet<string>;
  only?: readonly string[];
  limit?: number;
  refreshOnly?: boolean;
}): BrandAutomationPlan {
  const skipped: BrandAutomationPlan["skipped"] = [];
  const bySlug = new Map(input.universe.brands.map((entry) => [entry.id, entry]));
  const candidates = new Map<string, BrandAutomationCandidate>();

  for (const entry of input.universe.brands) {
    if (!input.lastGoodSlugs.has(entry.id)) continue;
    if (!entry.isActive || entry.collectionStatus !== "READY_AUTOMATIC") {
      skipped.push({ slug: entry.id, reason: "LAST_GOOD_SOURCE_NOT_ACTIVE_AND_READY" });
      continue;
    }
    if (entry.collectorType !== "SHOPIFY_PUBLIC") {
      skipped.push({ slug: entry.id, reason: "COLLECTOR_NOT_SUPPORTED_BY_AUTOMATION" });
      continue;
    }
    const candidate = candidateFromUniverse(entry, "LAST_GOOD");
    if (!candidate) {
      skipped.push({ slug: entry.id, reason: "VALID_HTTPS_OFFICIAL_URL_REQUIRED" });
      continue;
    }
    candidates.set(candidate.slug, candidate);
  }

  for (const queued of input.queue?.entries ?? []) {
    if (queued.status !== "READY" && queued.status !== "ACTIVE") continue;
    if (candidates.has(queued.slug)) continue;
    const universeEntry = bySlug.get(queued.slug);
    if (!universeEntry) {
      skipped.push({ slug: queued.slug, reason: "UNIVERSE_ENTRY_REQUIRED" });
      continue;
    }
    if (input.refreshOnly && !universeEntry.isActive) {
      skipped.push({ slug: queued.slug, reason: "REFRESH_ONLY_SOURCE_NOT_ACTIVE" });
      continue;
    }
    const adapter = input.adapters.adapters[queued.slug];
    if (!adapter) {
      skipped.push({ slug: queued.slug, reason: "APPROVED_ADAPTER_REQUIRED" });
      continue;
    }
    if (adapter.strategy !== "shopify-public") {
      skipped.push({ slug: queued.slug, reason: "APPROVED_ADAPTER_NOT_YET_AUTOMATABLE" });
      continue;
    }
    const candidate = candidateFromUniverse(
      universeEntry,
      "APPROVED_QUEUE",
      adapter.sourceUrl || queued.sourceUrl,
    );
    if (!candidate) {
      skipped.push({ slug: queued.slug, reason: "VALID_HTTPS_OFFICIAL_URL_REQUIRED" });
      continue;
    }
    candidate.womenCollectionPath = adapter.footwearPaths?.[0];
    candidates.set(candidate.slug, candidate);
  }

  const only = new Set((input.only ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean));
  const ordered = [...candidates.values()]
    .filter((candidate) =>
      only.size === 0 || only.has(candidate.slug) || only.has(candidate.brand.toLowerCase()),
    )
    .sort((a, b) => {
      if (a.origin !== b.origin) return a.origin === "APPROVED_QUEUE" ? -1 : 1;
      return a.slug.localeCompare(b.slug, "en");
    });
  const limit = input.limit === undefined ? ordered.length : Math.max(0, input.limit);
  return { candidates: ordered.slice(0, limit), skipped };
}
