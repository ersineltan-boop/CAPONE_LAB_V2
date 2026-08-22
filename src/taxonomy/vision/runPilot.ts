import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { ModelFamily } from "../../modelFamily/types";
import { selectAnalysisImages } from "../../modelFamily/familyImages";
import { buildTaxonomyFromProduct } from "../buildTaxonomy";
import type { RawAnalyzedProduct } from "../../modelFamily/types";
import { analyzeFamilyVisionLive, hasVisionApiKey } from "./analyzeFamilyLive";
import { buildVisionCacheKey, isCacheHit } from "./cache";
import { mergeVisionEnrichmentIntoTaxonomy, shouldAcceptVisionProposal } from "./mergeVisionEnrichment";
import { selectVisionCandidates, countUnknownCriticalFields } from "./selectCandidates";
import {
  TAXONOMY_VISION_DEFAULT_LIMIT,
  TAXONOMY_VISION_PROMPT_VERSION,
} from "./constants";
import type {
  TaxonomyVisionCacheFile,
  TaxonomyVisionEnrichmentRecord,
  TaxonomyVisionPilotReport,
} from "./types";
import { getTaxonomyFeatureFromTaxonomy } from "../../categories/taxonomyFieldAccess";
import { isKnown } from "../featureHelpers";

export const DEFAULT_CACHE_PATH = join(
  "data",
  "multibrand",
  "taxonomy-vision-cache.json",
);
export const DEFAULT_REPORT_PATH = join(
  "data",
  "multibrand",
  "taxonomy-vision-pilot-report.json",
);

export async function loadVisionCacheFile(
  path: string = DEFAULT_CACHE_PATH,
): Promise<TaxonomyVisionCacheFile> {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as TaxonomyVisionCacheFile;
  } catch {
    return {
      version: 1,
      promptVersion: TAXONOMY_VISION_PROMPT_VERSION,
      records: {},
    };
  }
}

export async function saveVisionCacheFile(
  cache: TaxonomyVisionCacheFile,
  path: string = DEFAULT_CACHE_PATH,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(cache, null, 2), "utf-8");
}

export function buildEnrichmentRecord(
  family: ModelFamily,
  analysis: Awaited<ReturnType<typeof analyzeFamilyVisionLive>>,
  cached: boolean,
): TaxonomyVisionEnrichmentRecord {
  const acceptedFields: string[] = [];
  const rejectedFields: string[] = [];
  const taxonomy = family.taxonomy;

  for (const proposal of analysis.proposals) {
    const existing = taxonomy
      ? getTaxonomyFeatureFromTaxonomy(taxonomy, proposal.field)
      : null;
    const decision = shouldAcceptVisionProposal(proposal, existing);
    if (decision.accept) acceptedFields.push(proposal.field);
    else rejectedFields.push(proposal.field);
  }

  return {
    modelFamilyId: family.modelFamilyId,
    brand: family.brand,
    productName: family.canonicalName,
    primaryCategory:
      family.primaryCategory ?? family.taxonomy?.primaryCategory ?? "UNCLASSIFIED",
    imageUrls: analysis.imageUrls,
    imageFingerprint: analysis.imageFingerprint,
    promptVersion: analysis.promptVersion,
    analyzedAt: new Date().toISOString(),
    provider: analysis.provider,
    model: analysis.model,
    cached,
    proposals: analysis.proposals,
    acceptedFields,
    rejectedFields,
    conflicts: [],
  };
}

export interface RunTaxonomyVisionPilotOptions {
  families: ModelFamily[];
  productLookup?: Map<string, RawAnalyzedProduct>;
  limit?: number;
  cachePath?: string;
  reportPath?: string;
  analyzeLive?: typeof analyzeFamilyVisionLive;
}

export async function runTaxonomyVisionPilot(
  options: RunTaxonomyVisionPilotOptions,
): Promise<TaxonomyVisionPilotReport> {
  const limit = options.limit ?? TAXONOMY_VISION_DEFAULT_LIMIT;
  const cachePath = options.cachePath ?? DEFAULT_CACHE_PATH;
  const reportPath = options.reportPath ?? DEFAULT_REPORT_PATH;
  const analyzeLive = options.analyzeLive ?? analyzeFamilyVisionLive;

  const cache = await loadVisionCacheFile(cachePath);
  const candidates = selectVisionCandidates(options.families, limit);

  let unknownBefore = 0;
  for (const family of candidates) {
    unknownBefore += countUnknownCriticalFields(family.taxonomy);
  }

  if (!hasVisionApiKey()) {
    const report: TaxonomyVisionPilotReport = {
      generatedAt: new Date().toISOString(),
      executed: false,
      reason: "OPENAI_API_KEY missing — visual pilot infrastructure ready",
      promptVersion: TAXONOMY_VISION_PROMPT_VERSION,
      limit,
      familiesAnalyzed: 0,
      imagesAnalyzed: 0,
      cachedHits: 0,
      liveCalls: 0,
      unknownFieldsBefore: unknownBefore,
      acceptedProposals: 0,
      rejectedProposals: 0,
      unknownFieldsAfter: unknownBefore,
      acceptanceRateByField: {},
      averageConfidenceByField: {},
      coverageDelta: {},
      families: [],
    };
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, JSON.stringify(report, null, 2), "utf-8");
    return report;
  }

  const records: TaxonomyVisionEnrichmentRecord[] = [];
  let imagesAnalyzed = 0;
  let cachedHits = 0;
  let liveCalls = 0;
  let acceptedProposals = 0;
  let rejectedProposals = 0;
  let unknownAfter = 0;
  const acceptanceRateByField: Record<string, { accepted: number; total: number }> = {};
  const confidenceByField: Record<string, number[]> = {};

  for (const family of candidates) {
    const imageUrls = selectAnalysisImages(family, 3);
    if (imageUrls.length === 0) continue;
    const fingerprint = imageUrls.join("|");
    const cacheKey = buildVisionCacheKey(
      family.modelFamilyId,
      fingerprint,
      TAXONOMY_VISION_PROMPT_VERSION,
    );
    const existing = cache.records[cacheKey];

    let record: TaxonomyVisionEnrichmentRecord;
    if (isCacheHit(existing, fingerprint, TAXONOMY_VISION_PROMPT_VERSION)) {
      record = { ...existing!, cached: true };
      cachedHits += 1;
    } else {
      try {
        const analysis = await analyzeLive({ family, imageUrls });
        record = buildEnrichmentRecord(family, analysis, false);
        cache.records[cacheKey] = record;
        liveCalls += 1;
        await saveVisionCacheFile(cache, cachePath);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const report: TaxonomyVisionPilotReport = {
          generatedAt: new Date().toISOString(),
          executed: false,
          reason: `Vision provider error: ${message}`,
          promptVersion: TAXONOMY_VISION_PROMPT_VERSION,
          provider: "openai",
          limit,
          familiesAnalyzed: records.length,
          imagesAnalyzed,
          cachedHits,
          liveCalls,
          unknownFieldsBefore: unknownBefore,
          acceptedProposals,
          rejectedProposals,
          unknownFieldsAfter: unknownBefore,
          acceptanceRateByField: {},
          averageConfidenceByField: {},
          coverageDelta: {},
          families: records,
        };
        await mkdir(dirname(reportPath), { recursive: true });
        await writeFile(reportPath, JSON.stringify(report, null, 2), "utf-8");
        return report;
      }
    }

    imagesAnalyzed += record.imageUrls.length;
    acceptedProposals += record.acceptedFields.length;
    rejectedProposals += record.rejectedFields.length;

    for (const proposal of record.proposals) {
      if (!acceptanceRateByField[proposal.field]) {
        acceptanceRateByField[proposal.field] = { accepted: 0, total: 0 };
      }
      acceptanceRateByField[proposal.field].total += 1;
      if (record.acceptedFields.includes(proposal.field)) {
        acceptanceRateByField[proposal.field].accepted += 1;
      }
      if (proposal.confidence != null) {
        confidenceByField[proposal.field] ??= [];
        confidenceByField[proposal.field].push(proposal.confidence);
      }
    }

    let taxonomy = family.taxonomy;
    if (!taxonomy && options.productLookup) {
      const product = options.productLookup.get(family.representativeProductId);
      if (product) taxonomy = buildTaxonomyFromProduct(product);
    }
    if (taxonomy) {
      const merged = mergeVisionEnrichmentIntoTaxonomy(taxonomy, record);
      unknownAfter += countUnknownCriticalFields(merged);
    } else {
      unknownAfter += countUnknownCriticalFields(family.taxonomy);
    }

    records.push(record);
  }

  const report: TaxonomyVisionPilotReport = {
    generatedAt: new Date().toISOString(),
    executed: true,
    promptVersion: TAXONOMY_VISION_PROMPT_VERSION,
    provider: "openai",
    model: records[0]?.model,
    limit,
    familiesAnalyzed: records.length,
    imagesAnalyzed,
    cachedHits,
    liveCalls,
    unknownFieldsBefore: unknownBefore,
    acceptedProposals,
    rejectedProposals,
    unknownFieldsAfter: unknownAfter,
    acceptanceRateByField: Object.fromEntries(
      Object.entries(acceptanceRateByField).map(([field, stats]) => [
        field,
        stats.total > 0 ? Math.round((stats.accepted / stats.total) * 1000) / 10 : 0,
      ]),
    ),
    averageConfidenceByField: Object.fromEntries(
      Object.entries(confidenceByField).map(([field, values]) => [
        field,
        Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 1000) / 1000,
      ]),
    ),
    coverageDelta: {},
    families: records,
  };

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf-8");
  return report;
}

export function countKnownFieldAcrossFamilies(
  families: ModelFamily[],
  field: string,
): number {
  return families.filter((family) => {
    const feature = family.taxonomy
      ? getTaxonomyFeatureFromTaxonomy(family.taxonomy, field)
      : null;
    return feature ? isKnown(feature) : false;
  }).length;
}
