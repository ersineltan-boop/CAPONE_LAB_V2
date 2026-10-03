import type { NewnessEvidenceType, NewnessProductHints, SourceNewness } from "./newness";
import { createNotVerifiedNewness, isVerifiedNew, resolveEffectiveNewAt } from "./newness";

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

export function isNewArrivalsCollectionPath(path: string | null | undefined): boolean {
  if (!path) return false;
  return NEW_ARRIVALS_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

export function detectNewBadgeInText(...parts: Array<string | null | undefined>): boolean {
  // Only standalone source labels/tags; descriptive text is not a NEW badge.
  return parts.some((part) => {
    const label = part?.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
    return Boolean(label && /^(?:new|new in|just in|new arrivals?|novedades)$/.test(label));
  });
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
  // Historical catalog-diff/date-only records must not regain a NEW badge.
  if (existing?.status === "VERIFIED_NEW" && !isVerifiedNew(existing)) existing = createNotVerifiedNewness();
  if (incoming.status === "VERIFIED_NEW" && !isVerifiedNew(incoming)) incoming = createNotVerifiedNewness();
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
    EXPLICIT_DATE: 4,
    NEW_ARRIVALS_COLLECTION: 3,
    CATALOG_DIFF: 2,
    NEW_BADGE: 1,
  };
  if (!a) return b;
  if (!b) return a;
  return rank[a] >= rank[b] ? a : b;
}
