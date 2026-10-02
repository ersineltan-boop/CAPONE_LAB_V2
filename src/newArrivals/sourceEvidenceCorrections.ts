import audit from "../../data/registry/source-newness-correction-audit.json";
import type { ModelFamily } from "../modelFamily/types";
import { createNotVerifiedNewness } from "./newness";
import { detectNewBadgeInText } from "./detectNewness";

const revokedUrls = new Set(audit.sourceChecks.filter((check) => !check.confirmedTag).map((check) => check.url));
const revokedSightings = new Set(audit.changedFamilies.map((family) => `${family.modelFamilyId}\0${family.sourceId}`));
const cutoff = Date.parse(audit.verifiedAt);

/** Historical title-derived badges cannot be restored by rebuilding old raw data. */
export function hasSourceBadgeEvidence(product: {
  productUrl: string;
  hasNewBadge?: boolean;
  sourceProductTags?: string[];
}): boolean {
  return product.hasNewBadge === true && (!revokedUrls.has(product.productUrl) ||
    detectNewBadgeInText(...(product.sourceProductTags ?? [])));
}

/** Apply the audited correction at delivery, retaining source records and identities. */
export function applySourceEvidenceCorrections(family: ModelFamily): ModelFamily {
  let changed = false;
  const sourceSightings = family.sourceSightings?.map((sighting) => {
    const newness = sighting.newness;
    if (!revokedSightings.has(`${family.modelFamilyId}\0${sighting.sourceId}`) ||
      newness?.status !== "VERIFIED_NEW" || newness.evidenceType !== "NEW_BADGE" ||
      Date.parse(newness.lastVerifiedAt ?? "") > cutoff) return sighting;
    changed = true;
    return { ...sighting, newness: createNotVerifiedNewness() };
  });
  return changed ? { ...family, sourceSightings } : family;
}
