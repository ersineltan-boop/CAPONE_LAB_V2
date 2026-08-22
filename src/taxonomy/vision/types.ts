import type { TaxonomyVisionProposal } from "./schema";

export interface TaxonomyVisionEnrichmentRecord {
  modelFamilyId: string;
  brand: string;
  productName: string;
  primaryCategory: string;
  imageUrls: string[];
  imageFingerprint: string;
  promptVersion: string;
  analyzedAt: string;
  provider: string;
  model: string;
  cached: boolean;
  proposals: TaxonomyVisionProposal[];
  acceptedFields: string[];
  rejectedFields: string[];
  conflicts: Array<{ field: string; existingValue: string; proposedValue: string }>;
}

export interface TaxonomyVisionCacheFile {
  version: 1;
  promptVersion: string;
  records: Record<string, TaxonomyVisionEnrichmentRecord>;
}

export interface TaxonomyVisionPilotReport {
  generatedAt: string;
  executed: boolean;
  reason?: string;
  promptVersion: string;
  provider?: string;
  model?: string;
  limit: number;
  familiesAnalyzed: number;
  imagesAnalyzed: number;
  cachedHits: number;
  liveCalls: number;
  unknownFieldsBefore: number;
  acceptedProposals: number;
  rejectedProposals: number;
  unknownFieldsAfter: number;
  acceptanceRateByField: Record<string, number>;
  averageConfidenceByField: Record<string, number>;
  coverageDelta: Record<string, { before: number; after: number }>;
  families: TaxonomyVisionEnrichmentRecord[];
}
