export type NewnessStatus = "VERIFIED_NEW" | "FORMERLY_NEW" | "NOT_VERIFIED";

export type NewnessEvidenceType =
  | "NEW_ARRIVALS_COLLECTION"
  | "NEW_BADGE"
  | "EXPLICIT_DATE";

export interface SourceNewness {
  status: NewnessStatus;
  evidenceType: NewnessEvidenceType | null;
  firstVerifiedAt: string | null;
  lastVerifiedAt: string | null;
  explicitPublishedAt?: string | null;
  explicitReleaseAt?: string | null;
  effectiveNewAt: string | null;
  evidenceUrl?: string | null;
  evidenceText?: string | null;
  confidence?: number;
}

export interface NewnessProductHints {
  collectionPath?: string | null;
  collectionLabel?: string | null;
  isNewArrivalsCollection?: boolean;
  hasNewBadge?: boolean;
  publishedAt?: string | null;
  createdAt?: string | null;
  productUrl?: string;
}

export function createNotVerifiedNewness(): SourceNewness {
  return {
    status: "NOT_VERIFIED",
    evidenceType: null,
    firstVerifiedAt: null,
    lastVerifiedAt: null,
    effectiveNewAt: null,
  };
}

export function isVerifiedNew(newness: SourceNewness | undefined | null): boolean {
  return newness?.status === "VERIFIED_NEW" && Boolean(newness.effectiveNewAt);
}

export function resolveEffectiveNewAt(newness: SourceNewness): string | null {
  if (newness.explicitPublishedAt) return newness.explicitPublishedAt;
  if (newness.explicitReleaseAt) return newness.explicitReleaseAt;
  return newness.firstVerifiedAt;
}
