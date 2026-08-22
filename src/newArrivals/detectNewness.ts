import type { NewnessEvidenceType, NewnessProductHints, SourceNewness } from "./newness";
import { createNotVerifiedNewness, resolveEffectiveNewAt } from "./newness";

const NEW_ARRIVALS_PATH_PATTERNS = [
  /new[-_]?arrivals?/i,
  /new[-_]?in/i,
  /whats[-_]?new/i,
  /new[-_]?season/i,
  /latest/i,
  /new[-_]?shoes?/i,
  /new[-_]?footwear/i,
  /just[-_]?in/i,
  /\/new(?:\.html)?(?:\/|$)/i,
];

const NEW_BADGE_PATTERNS = [
  /\bnew\b/i,
  /\bnew in\b/i,
  /\bjust in\b/i,
  /\bnew arrival\b/i,
];

export function isNewArrivalsCollectionPath(path: string | null | undefined): boolean {
  if (!path) return false;
  return NEW_ARRIVALS_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

export function detectNewBadgeInText(...parts: Array<string | null | undefined>): boolean {
  const combined = parts.filter(Boolean).join(" ");
  if (!combined.trim()) return false;
  return NEW_BADGE_PATTERNS.some((pattern) => pattern.test(combined));
}

export function buildNewnessFromProductHints(
  hints: NewnessProductHints,
  verifiedAt: string,
): SourceNewness {
  const base = createNotVerifiedNewness();

  const fromCollection =
    hints.isNewArrivalsCollection || isNewArrivalsCollectionPath(hints.collectionPath);
  const fromBadge = Boolean(hints.hasNewBadge);

  if (fromCollection) {
    const explicitDate = hints.publishedAt ?? hints.createdAt ?? null;
    return {
      status: "VERIFIED_NEW",
      evidenceType: "NEW_ARRIVALS_COLLECTION",
      firstVerifiedAt: verifiedAt,
      lastVerifiedAt: verifiedAt,
      explicitPublishedAt: hints.publishedAt ?? null,
      explicitReleaseAt: hints.createdAt ?? null,
      effectiveNewAt: explicitDate && !Number.isNaN(Date.parse(explicitDate)) ? explicitDate : verifiedAt,
      evidenceUrl: hints.collectionPath ?? hints.productUrl ?? null,
      evidenceText: hints.collectionLabel ?? hints.collectionPath ?? "Yeni Gelenler koleksiyonu",
      confidence: 0.9,
    };
  }

  if (fromBadge) {
    const explicitDate = hints.publishedAt ?? hints.createdAt ?? null;
    return {
      status: "VERIFIED_NEW",
      evidenceType: "NEW_BADGE",
      firstVerifiedAt: verifiedAt,
      lastVerifiedAt: verifiedAt,
      explicitPublishedAt: hints.publishedAt ?? null,
      explicitReleaseAt: hints.createdAt ?? null,
      effectiveNewAt: explicitDate && !Number.isNaN(Date.parse(explicitDate)) ? explicitDate : verifiedAt,
      evidenceUrl: hints.productUrl ?? null,
      evidenceText: "NEW rozeti",
      confidence: 0.85,
    };
  }

  return base;
}

export function mergeSourceNewness(
  existing: SourceNewness | undefined,
  incoming: SourceNewness,
  now: string,
): SourceNewness {
  if (incoming.status === "VERIFIED_NEW") {
    const firstVerifiedAt =
      existing?.firstVerifiedAt && existing.status !== "NOT_VERIFIED"
        ? existing.firstVerifiedAt
        : incoming.firstVerifiedAt ?? now;
    const merged: SourceNewness = {
      ...incoming,
      firstVerifiedAt,
      lastVerifiedAt: now,
      effectiveNewAt: resolveEffectiveNewAt({
        ...incoming,
        firstVerifiedAt,
      }),
    };
    return merged;
  }

  if (existing?.status === "VERIFIED_NEW" && incoming.status === "NOT_VERIFIED") {
    if (existing.evidenceType === "EXPLICIT_DATE") {
      return createNotVerifiedNewness();
    }
    return {
      ...existing,
      status: "FORMERLY_NEW",
      lastVerifiedAt: now,
    };
  }

  return existing ?? incoming;
}

export function getStrongestEvidenceType(
  a: NewnessEvidenceType | null,
  b: NewnessEvidenceType | null,
): NewnessEvidenceType | null {
  const rank: Record<NewnessEvidenceType, number> = {
    EXPLICIT_DATE: 3,
    NEW_ARRIVALS_COLLECTION: 2,
    NEW_BADGE: 1,
  };
  if (!a) return b;
  if (!b) return a;
  return rank[a] >= rank[b] ? a : b;
}
