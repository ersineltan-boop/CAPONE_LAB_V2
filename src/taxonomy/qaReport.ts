import type { ModelFamily, RawAnalyzedProduct } from "../modelFamily/types";
import { buildTaxonomyCompletenessReport } from "./completeness";
import { isKnown, isValidKnownFeature } from "./featureHelpers";
import { SAFE_CATEGORY_DERIVED_RULES } from "./categoryDerivedRules";
import type {
  CategoryAssignmentProvenance,
  FootwearTaxonomyV1,
  PrimaryFootwearCategory,
  TaxonomyEvidenceSource,
  TaxonomyFeature,
} from "./types";
import { PRIMARY_FOOTWEAR_CATEGORIES } from "./types";

const MAJOR_GLOBAL_FIELDS = [
  "toeShape",
  "toeLength",
  "toeOpening",
  "backConstruction",
  "vampHeight",
  "heelHeightClass",
  "heelHeightMm",
  "heelType",
  "soleProfile",
  "platformConstruction",
  "closureFeatures",
  "strapFeatures",
  "sideConstruction",
  "hardwareType",
  "hardwareIntensity",
  "embellishmentFeatures",
  "materialFamily",
  "colorFamily",
  "surfacePattern",
] as const;

const DISTRIBUTION_FIELDS = [
  "primaryCategory",
  "backConstruction",
  "toeShape",
  "toeLength",
  "heelHeightClass",
  "heelType",
  "soleProfile",
  "platformConstruction",
  "shaftHeight",
] as const;

const EVIDENCE_SOURCES: TaxonomyEvidenceSource[] = [
  "PRODUCT_PAGE",
  "STRUCTURED_DATA",
  "PRODUCT_TEXT",
  "COLLECTION_TAG",
  "DERIVED",
  "IMAGE",
  "UNKNOWN",
];

export interface FieldStatusCounts {
  KNOWN: number;
  UNKNOWN: number;
  NOT_APPLICABLE: number;
}

export interface FieldQaReport {
  field: string;
  status: FieldStatusCounts;
  knownSourceBreakdown: Record<TaxonomyEvidenceSource, number>;
  suspicious: string[];
}

export interface TaxonomyQaReport {
  generatedAt: string;
  totalFamilies: number;
  completeness: ReturnType<typeof buildTaxonomyCompletenessReport>;
  categoryProvenance: Record<CategoryAssignmentProvenance, number>;
  unclassifiedCount: number;
  fields: FieldQaReport[];
  valueDistributions: Record<string, Record<string, number>>;
  suspiciousPatterns: string[];
  invalidKnownFeatures: number;
  newArrivalsDates: NewArrivalsDateAudit;
  safeCategoryDerivedRules: typeof SAFE_CATEGORY_DERIVED_RULES;
}

export interface NewArrivalsDateAudit {
  earliestModelFamilyFirstSeenAt: string | null;
  latestModelFamilyFirstSeenAt: string | null;
  countByDate: Record<string, number>;
  countLast24H: number;
  countLast7D: number;
  countLast30D: number;
  countLast90D: number;
  bulkBackfillDates: Array<{ date: string; count: number; sharePercent: number }>;
  familiesWithoutFirstSeen: number;
}

export interface TaxonomyQaSample {
  modelFamilyId: string;
  brand: string;
  productName: string;
  productUrl: string | null;
  primaryCategory: PrimaryFootwearCategory | "UNCLASSIFIED";
  categoryProvenance: CategoryAssignmentProvenance | null;
  categoryAssignmentReason: string | null;
  textEvidence: {
    productName: string;
    construction: string[];
    legacyCategory: string | null;
    heelHeightGroup: string | null;
    cleanedHeelHeight: string | null;
  };
  features: Array<{
    field: string;
    value: unknown;
    status: string;
    source: string;
    confidence: number | null;
  }>;
}

function emptySourceBreakdown(): Record<TaxonomyEvidenceSource, number> {
  return {
    PRODUCT_PAGE: 0,
    STRUCTURED_DATA: 0,
    PRODUCT_TEXT: 0,
    COLLECTION_TAG: 0,
    DERIVED: 0,
    IMAGE: 0,
    UNKNOWN: 0,
  };
}

function serializeFeatureValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (Array.isArray(value)) return value.join("+") || "EMPTY";
  return String(value);
}

function collectFeatures(taxonomy: FootwearTaxonomyV1): Array<{ path: string; feature: TaxonomyFeature<unknown> }> {
  const entries: Array<{ path: string; feature: TaxonomyFeature<unknown> }> = [];
  for (const [key, feature] of Object.entries(taxonomy.global)) {
    entries.push({ path: `global.${key}`, feature: feature as TaxonomyFeature<unknown> });
  }
  for (const [key, feature] of Object.entries(taxonomy.categorySpecific)) {
    if (!feature) continue;
    entries.push({ path: `categorySpecific.${key}`, feature: feature as TaxonomyFeature<unknown> });
  }
  return entries;
}

function getFeatureByDistributionKey(
  taxonomy: FootwearTaxonomyV1,
  key: string,
): TaxonomyFeature<unknown> | null {
  if (key === "primaryCategory") return null;
  if (key === "shaftHeight") {
    return taxonomy.categorySpecific.shaftHeight ?? null;
  }
  const globalFeature = taxonomy.global[key as keyof typeof taxonomy.global];
  return (globalFeature as TaxonomyFeature<unknown> | undefined) ?? null;
}

function detectSuspiciousForField(
  field: string,
  status: FieldStatusCounts,
  knownValues: Record<string, number>,
): string[] {
  const suspicious: string[] = [];
  const applicable = status.KNOWN + status.UNKNOWN;
  if (applicable > 0 && status.KNOWN === applicable && status.KNOWN >= 100) {
    suspicious.push(`${field}: 100% KNOWN among applicable records`);
  }

  const knownOnlyEntries = Object.entries(knownValues).filter(
    ([value]) => value !== "UNKNOWN" && value !== "NOT_APPLICABLE" && value !== "NULL",
  );
  const knownTotal = knownOnlyEntries.reduce((sum, [, count]) => sum + count, 0);
  if (knownTotal > 0) {
    const top = knownOnlyEntries.sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] / knownTotal > 0.95 && knownTotal >= 50) {
      suspicious.push(
        `${field}: >95% same KNOWN value (${top[0]} = ${top[1]}/${knownTotal})`,
      );
    }
  }

  return suspicious;
}

function auditNewArrivalsDates(families: ModelFamily[]): NewArrivalsDateAudit {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const countByDate: Record<string, number> = {};
  let earliest: string | null = null;
  let latest: string | null = null;
  let familiesWithoutFirstSeen = 0;
  let countLast24H = 0;
  let countLast7D = 0;
  let countLast30D = 0;
  let countLast90D = 0;

  for (const family of families) {
    const firstSeen = family.modelFamilyFirstSeenAt;
    if (!firstSeen) {
      familiesWithoutFirstSeen += 1;
      continue;
    }

    const parsed = Date.parse(firstSeen);
    if (Number.isNaN(parsed)) continue;

    if (!earliest || parsed < Date.parse(earliest)) earliest = firstSeen;
    if (!latest || parsed > Date.parse(latest)) latest = firstSeen;

    const dateKey = firstSeen.slice(0, 10);
    countByDate[dateKey] = (countByDate[dateKey] ?? 0) + 1;

    const age = now - parsed;
    if (age <= dayMs) countLast24H += 1;
    if (age <= 7 * dayMs) countLast7D += 1;
    if (age <= 30 * dayMs) countLast30D += 1;
    if (age <= 90 * dayMs) countLast90D += 1;
  }

  const bulkBackfillDates = Object.entries(countByDate)
    .map(([date, count]) => ({
      date,
      count,
      sharePercent: Math.round((count / Math.max(families.length, 1)) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    earliestModelFamilyFirstSeenAt: earliest,
    latestModelFamilyFirstSeenAt: latest,
    countByDate,
    countLast24H,
    countLast7D,
    countLast30D,
    countLast90D,
    bulkBackfillDates,
    familiesWithoutFirstSeen,
  };
}

export function buildTaxonomyQaReport(families: ModelFamily[]): TaxonomyQaReport {
  const fieldReports = new Map<string, FieldQaReport>();
  const valueDistributions: Record<string, Record<string, number>> = {};
  const categoryProvenance: Record<CategoryAssignmentProvenance, number> = {
    PRODUCT_EVIDENCE: 0,
    LEGACY_CATEGORY: 0,
    INSUFFICIENT: 0,
  };
  let invalidKnownFeatures = 0;
  let unclassifiedCount = 0;

  for (const field of MAJOR_GLOBAL_FIELDS) {
    fieldReports.set(`global.${field}`, {
      field: `global.${field}`,
      status: { KNOWN: 0, UNKNOWN: 0, NOT_APPLICABLE: 0 },
      knownSourceBreakdown: emptySourceBreakdown(),
      suspicious: [],
    });
  }

  for (const key of DISTRIBUTION_FIELDS) {
    valueDistributions[key] = {};
  }

  for (const family of families) {
    const taxonomy = family.taxonomy;
    const category = family.primaryCategory ?? taxonomy?.primaryCategory ?? "UNCLASSIFIED";

    valueDistributions.primaryCategory[category] =
      (valueDistributions.primaryCategory[category] ?? 0) + 1;

    if (category === "UNCLASSIFIED") unclassifiedCount += 1;

    if (taxonomy?.categoryProvenance) {
      categoryProvenance[taxonomy.categoryProvenance] += 1;
    }

    if (!taxonomy) continue;

    for (const { path, feature } of collectFeatures(taxonomy)) {
      if (!fieldReports.has(path) && path.startsWith("global.")) {
        fieldReports.set(path, {
          field: path,
          status: { KNOWN: 0, UNKNOWN: 0, NOT_APPLICABLE: 0 },
          knownSourceBreakdown: emptySourceBreakdown(),
          suspicious: [],
        });
      }

      const report = fieldReports.get(path);
      if (report) {
        report.status[feature.status] += 1;
        if (isKnown(feature)) {
          report.knownSourceBreakdown[feature.source] += 1;
        }
      }

      if (!isValidKnownFeature(feature)) invalidKnownFeatures += 1;
    }

    for (const key of DISTRIBUTION_FIELDS) {
      if (key === "primaryCategory") continue;
      const feature = getFeatureByDistributionKey(taxonomy, key);
      if (!feature) continue;
      const bucket = isKnown(feature) ? serializeFeatureValue(feature.value) : feature.status;
      valueDistributions[key][bucket] = (valueDistributions[key][bucket] ?? 0) + 1;
    }
  }

  const suspiciousPatterns: string[] = [];
  for (const report of fieldReports.values()) {
    const knownValues: Record<string, number> = {};
    const fieldKey = report.field.replace(/^global\./, "");
    const dist = valueDistributions[fieldKey];
    if (dist) Object.assign(knownValues, dist);

    report.suspicious = detectSuspiciousForField(report.field, report.status, knownValues);
    suspiciousPatterns.push(...report.suspicious);
  }

  if (invalidKnownFeatures > 0) {
    suspiciousPatterns.push(
      `${invalidKnownFeatures} KNOWN feature(s) with source UNKNOWN`,
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    totalFamilies: families.length,
    completeness: buildTaxonomyCompletenessReport(families),
    categoryProvenance,
    unclassifiedCount,
    fields: [...fieldReports.values()].sort((a, b) => a.field.localeCompare(b.field)),
    valueDistributions,
    suspiciousPatterns,
    invalidKnownFeatures,
    newArrivalsDates: auditNewArrivalsDates(families),
    safeCategoryDerivedRules: SAFE_CATEGORY_DERIVED_RULES,
  };
}

export function buildTaxonomyQaSamples(
  families: ModelFamily[],
  productsByUrl: Map<string, RawAnalyzedProduct>,
  perCategory = 3,
): TaxonomyQaSample[] {
  const samples: TaxonomyQaSample[] = [];

  for (const category of PRIMARY_FOOTWEAR_CATEGORIES) {
    const matches = families.filter(
      (family) => (family.primaryCategory ?? family.taxonomy?.primaryCategory) === category,
    );
    for (const family of matches.slice(0, perCategory)) {
      const product = productsByUrl.get(family.representativeProductId);
      const taxonomy = family.taxonomy;
      const features: TaxonomyQaSample["features"] = [];

      if (taxonomy) {
        for (const { path, feature } of collectFeatures(taxonomy)) {
          features.push({
            field: path,
            value: feature.value,
            status: feature.status,
            source: feature.source,
            confidence: feature.confidence,
          });
        }
      }

      samples.push({
        modelFamilyId: family.modelFamilyId,
        brand: family.brand,
        productName: product?.productName ?? family.canonicalName,
        productUrl: product?.productUrl ?? family.representativeProductId,
        primaryCategory: category,
        categoryProvenance: taxonomy?.categoryProvenance ?? null,
        categoryAssignmentReason: taxonomy?.categoryAssignmentReason ?? null,
        textEvidence: {
          productName: product?.productName ?? family.canonicalName,
          construction: product?.normalized.construction ?? [],
          legacyCategory: product?.normalized.category ?? product?.category ?? null,
          heelHeightGroup: product?.normalized.heelHeightGroup ?? null,
          cleanedHeelHeight: product?.cleaned.heelHeight ?? null,
        },
        features,
      });
    }
  }

  return samples;
}

export function summarizeField(report: FieldQaReport): string {
  const { status } = report;
  return `KNOWN ${status.KNOWN} · UNKNOWN ${status.UNKNOWN} · N/A ${status.NOT_APPLICABLE}`;
}

export { EVIDENCE_SOURCES, MAJOR_GLOBAL_FIELDS, DISTRIBUTION_FIELDS };
