import type { TaxonomyVisionProposal } from "./schema";
import type {
  TaxonomyVisionCacheFile,
  TaxonomyVisionEnrichmentRecord,
} from "./types";

export function getVisionEnrichmentMap(
  cache: TaxonomyVisionCacheFile,
): Map<string, TaxonomyVisionEnrichmentRecord> {
  const map = new Map<string, TaxonomyVisionEnrichmentRecord>();
  for (const record of Object.values(cache.records)) {
    map.set(record.modelFamilyId, record);
  }
  return map;
}

export function buildVisionCacheKey(
  modelFamilyId: string,
  imageFingerprint: string,
  promptVersion: string,
): string {
  return `${modelFamilyId}::${imageFingerprint}::${promptVersion}`;
}

export function isCacheHit(
  record: TaxonomyVisionEnrichmentRecord | undefined,
  imageFingerprint: string,
  promptVersion: string,
): boolean {
  if (!record) return false;
  return (
    record.imageFingerprint === imageFingerprint &&
    record.promptVersion === promptVersion &&
    Boolean(record.proposals)
  );
}

export function summarizeProposals(proposals: TaxonomyVisionProposal[]): {
  accepted: TaxonomyVisionProposal[];
  rejected: TaxonomyVisionProposal[];
} {
  return {
    accepted: proposals.filter((proposal) => proposal.value && proposal.confidence >= 0.85),
    rejected: proposals.filter((proposal) => !proposal.value || proposal.confidence < 0.85),
  };
}
