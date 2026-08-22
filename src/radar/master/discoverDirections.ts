import { labelTagTr } from "../../analysis/buildMarketAnalysis";
import {
  attributeSpecificityRank,
  hasMinimumDistinctAttributes,
  isStrictAttributeSubset,
  pruneRedundantAttributes,
} from "../attributeSemantics";
import type { ProductProvenance } from "../clusterTypes";
import type { FootwearCategory } from "../../types/pilotProduct";
import {
  assignFamilyStage,
  averageBrandQuality,
  isDirectionalBrand,
  isPremiumIndependentBrand,
  resolveBrandEvidence,
  stageToRadarType,
} from "./brandEvidence";
import type { IndexedModelFamily } from "./familyIndex";
import {
  expandSignalCombos,
  isSingleAttributeSignal,
  productHasRequiredAttributes,
  signalKey,
  SIGNAL_COMBINATION_FAMILIES,
} from "./signalAttributes";
import type {
  ExcludedCandidate,
  MasterRadarType,
  RadarDirectionSignal,
  RadarStage,
  SignalAttribute,
  SignalConfidence,
} from "./types";

const MIN_MODEL_FAMILIES = 2;
const MIN_INDEPENDENT_BRANDS = 2;
const MAX_SIGNALS_PER_CATEGORY = 6;
const GENERIC_PENALTY_THRESHOLD = 0.35;

const GENERIC_ATTRIBUTE_VALUES = new Set([
  "CLOSED_TOE",
  "OPEN_TOE",
  "BUCKLE",
  "SLINGBACK",
  "BACKLESS",
  "POINTED",
  "ROUND",
  "STILETTO",
  "FLAT",
  "BLOCK",
]);

interface CandidateBucket {
  category: FootwearCategory;
  attributes: SignalAttribute[];
  families: IndexedModelFamily[];
}

interface ScoredCandidate {
  bucket: CandidateBucket;
  brands: string[];
  stageEvidence: Map<string, RadarStage>;
  distinctiveness: number;
  genericity: number;
}

function buildDirectionLabel(
  _category: FootwearCategory,
  attributes: SignalAttribute[],
): string {
  const meaningful = pruneRedundantAttributes(
    attributes.map((attribute) => ({
      dimension: attribute.dimension as never,
      value: attribute.value,
    })),
  );

  const parts = meaningful.map((attribute) => labelTagTr(attribute.value));
  return parts.join(" · ");
}

function computeGenericity(
  bucket: CandidateBucket,
  categoryFamilies: IndexedModelFamily[],
): number {
  if (bucket.attributes.length === 0) return 1;

  const primary = bucket.attributes[0]?.value;
  if (primary && GENERIC_ATTRIBUTE_VALUES.has(primary)) {
    return 0.8;
  }

  const matchingCount = categoryFamilies.filter((entry) =>
    productHasRequiredAttributes(
      entry.representativeProduct,
      bucket.attributes,
      new Map(),
    ),
  ).length;

  return matchingCount / Math.max(categoryFamilies.length, 1);
}

function buildDescription(
  category: FootwearCategory,
  attributes: SignalAttribute[],
  brandCount: number,
): string {
  const direction = buildDirectionLabel(category, attributes);
  return `${labelTagTr(category)} içinde ${direction.toLowerCase()} yönü ${brandCount} bağımsız markada görülmeye başladı.`;
}

function resolveSignalStage(
  stageEvidence: Map<string, RadarStage>,
  radarType: MasterRadarType,
): RadarStage | null {
  const stages = [...stageEvidence.values()];
  if (stages.length === 0) return null;

  const filtered = stages.filter((stage) => stageToRadarType(stage) === radarType);
  if (filtered.length === 0) return null;

  if (radarType === "EARLY") {
    if (filtered.includes("COK_ERKEN")) return "COK_ERKEN";
    if (filtered.filter((stage) => stage === "ERKEN_SINYAL").length >= 2) {
      return "ERKEN_SINYAL";
    }
    const directionalCount = [...stageEvidence.entries()].filter(([, stage]) =>
      stage === "COK_ERKEN" || stage === "ERKEN_SINYAL",
    ).length;
    if (directionalCount >= 1 && filtered.includes("ERKEN_SINYAL")) {
      return "ERKEN_SINYAL";
    }
    return null;
  }

  if (filtered.includes("DOYGUN_GEC")) return "DOYGUN_GEC";
  if (filtered.includes("NUMUNEYE_GIR")) return "NUMUNEYE_GIR";
  if (filtered.includes("HAZIRLAN")) return "HAZIRLAN";
  return null;
}

function resolveConfidence(
  brands: string[],
  stage: RadarStage,
  radarType: MasterRadarType,
): SignalConfidence {
  const profiles = brands.map((brand) => resolveBrandEvidence(brand));
  const knownProfiles = profiles.filter((profile) => profile.segment !== "UNKNOWN");

  if (knownProfiles.length === 0) return "INSUFFICIENT";

  const directionalBrands = knownProfiles.filter(isDirectionalBrand).length;
  const premiumBrands = knownProfiles.filter(isPremiumIndependentBrand).length;

  if (radarType === "EARLY") {
    if (stage === "COK_ERKEN" && directionalBrands >= 1) return "MEDIUM";
    if (stage === "ERKEN_SINYAL" && premiumBrands >= 3) return "MEDIUM";
    if (premiumBrands >= 2) return "LOW";
    return "INSUFFICIENT";
  }

  if (stage === "NUMUNEYE_GIR" && brands.length >= 3) return "MEDIUM";
  if (stage === "HAZIRLAN" && brands.length >= 2) return "LOW";
  if (brands.length >= 2) return "LOW";
  return "INSUFFICIENT";
}

function scoreCandidate(candidate: ScoredCandidate): number {
  const brandQuality = averageBrandQuality(
    candidate.brands.map((brand) => resolveBrandEvidence(brand)),
  );
  const specificity = attributeSpecificityRank(
    candidate.bucket.attributes.map((attribute) => ({
      dimension: attribute.dimension as never,
      value: attribute.value,
    })),
  );

  return (
    candidate.brands.length * 12 +
    candidate.bucket.families.length * 8 +
    brandQuality * 0.35 +
    specificity * 10 -
    candidate.genericity * 40 +
    candidate.distinctiveness
  );
}

function dedupeCandidates(candidates: ScoredCandidate[]): ScoredCandidate[] {
  const selected: ScoredCandidate[] = [];

  for (const candidate of candidates.sort(
    (a, b) => scoreCandidate(b) - scoreCandidate(a),
  )) {
    const overlaps = selected.some((existing) => {
      const sameCategory = existing.bucket.category === candidate.bucket.category;
      const subset =
        isStrictAttributeSubset(
          candidate.bucket.attributes.map((attribute) => ({
            dimension: attribute.dimension as never,
            value: attribute.value,
          })),
          existing.bucket.attributes.map((attribute) => ({
            dimension: attribute.dimension as never,
            value: attribute.value,
          })),
        ) ||
        isStrictAttributeSubset(
          existing.bucket.attributes.map((attribute) => ({
            dimension: attribute.dimension as never,
            value: attribute.value,
          })),
          candidate.bucket.attributes.map((attribute) => ({
            dimension: attribute.dimension as never,
            value: attribute.value,
          })),
        );

      return sameCategory && subset;
    });

    if (!overlaps) selected.push(candidate);
  }

  return selected;
}

export function discoverCategoryDirections(input: {
  category: FootwearCategory;
  families: IndexedModelFamily[];
  provenanceMap: Map<string, ProductProvenance>;
  comparisonAvailable: boolean;
}): {
  earlySignals: RadarDirectionSignal[];
  commercialSignals: RadarDirectionSignal[];
  excluded: ExcludedCandidate[];
} {
  const { category, families, provenanceMap, comparisonAvailable } = input;
  const buckets = new Map<string, CandidateBucket>();
  const excluded: ExcludedCandidate[] = [];

  for (const entry of families) {
    for (const comboFamily of SIGNAL_COMBINATION_FAMILIES) {
      for (const combo of expandSignalCombos(
        entry.representativeProduct,
        comboFamily,
      )) {
        if (
          isSingleAttributeSignal(combo) ||
          !hasMinimumDistinctAttributes(
            combo.map((attribute) => ({
              dimension: attribute.dimension as never,
              value: attribute.value,
            })),
          )
        ) {
          continue;
        }

        const key = signalKey(category, combo);
        const bucket = buckets.get(key) ?? {
          category,
          attributes: combo,
          families: [],
        };
        if (
          !bucket.families.some(
            (item) => item.family.modelFamilyId === entry.family.modelFamilyId,
          )
        ) {
          bucket.families.push(entry);
        }
        buckets.set(key, bucket);
      }
    }
  }

  const scored: ScoredCandidate[] = [];

  for (const bucket of buckets.values()) {
    const strictFamilies = bucket.families.filter((entry) =>
      productHasRequiredAttributes(
        entry.representativeProduct,
        bucket.attributes,
        provenanceMap,
      ),
    );

    const brands = [
      ...new Set(strictFamilies.map((entry) => entry.family.brand)),
    ];

    if (
      strictFamilies.length < MIN_MODEL_FAMILIES ||
      brands.length < MIN_INDEPENDENT_BRANDS
    ) {
      excluded.push({
        category,
        signalAttributes: bucket.attributes,
        reason: "Yetersiz bağımsız marka / model ailesi kanıtı",
        candidateModelFamilyIds: strictFamilies.map(
          (entry) => entry.family.modelFamilyId,
        ),
      });
      continue;
    }

    const genericity = computeGenericity(bucket, families);
    if (genericity >= GENERIC_PENALTY_THRESHOLD && attributeSpecificityRank(
      bucket.attributes.map((attribute) => ({
        dimension: attribute.dimension as never,
        value: attribute.value,
      })),
    ) < 3) {
      excluded.push({
        category,
        signalAttributes: bucket.attributes,
        reason: "Generic attribute kombinasyonu",
        candidateModelFamilyIds: strictFamilies.map(
          (entry) => entry.family.modelFamilyId,
        ),
      });
      continue;
    }

    const stageEvidence = new Map<string, RadarStage>();
    for (const entry of strictFamilies) {
      const profile = resolveBrandEvidence(entry.family.brand);
      const stage = assignFamilyStage(profile);
      if (stage) {
        stageEvidence.set(entry.family.modelFamilyId, stage);
      }
    }

    scored.push({
      bucket: { ...bucket, families: strictFamilies },
      brands,
      stageEvidence,
      distinctiveness: attributeSpecificityRank(
        bucket.attributes.map((attribute) => ({
          dimension: attribute.dimension as never,
          value: attribute.value,
        })),
      ) * 5,
      genericity,
    });
  }

  const deduped = dedupeCandidates(scored).slice(0, MAX_SIGNALS_PER_CATEGORY * 2);
  const earlySignals: RadarDirectionSignal[] = [];
  const commercialSignals: RadarDirectionSignal[] = [];

  for (const candidate of deduped) {
    for (const radarType of ["EARLY", "COMMERCIAL"] as const) {
      const stage = resolveSignalStage(candidate.stageEvidence, radarType);
      if (!stage) {
        excluded.push({
          category,
          signalAttributes: candidate.bucket.attributes,
          reason: `${radarType} radar için yeterli stage kanıtı yok`,
          candidateModelFamilyIds: candidate.bucket.families.map(
            (entry) => entry.family.modelFamilyId,
          ),
        });
        continue;
      }

      const confidence = resolveConfidence(
        candidate.brands,
        stage,
        radarType,
      );
      if (confidence === "INSUFFICIENT") {
        excluded.push({
          category,
          signalAttributes: candidate.bucket.attributes,
          reason: `${radarType} radar için yeterli güven yok`,
          candidateModelFamilyIds: candidate.bucket.families.map(
            (entry) => entry.family.modelFamilyId,
          ),
        });
        continue;
      }

      const evidence = candidate.bucket.families.map((entry) => ({
        modelFamilyId: entry.family.modelFamilyId,
        brand: entry.family.brand,
        canonicalName: entry.family.canonicalName,
        imageUrl:
          entry.family.representativeImage ??
          entry.representativeProduct.imageUrl,
        productUrl: entry.family.representativeProductId,
        stage: candidate.stageEvidence.get(entry.family.modelFamilyId) ?? null,
        variantCount: entry.family.variantCount,
        buyerValidation: [],
      }));

      const signal: RadarDirectionSignal = {
        id: `${signalKey(category, candidate.bucket.attributes)}::${radarType}`,
        directionName: `${buildDirectionLabel(category, candidate.bucket.attributes)} · ${labelTagTr(category)}`,
        category,
        radarType,
        stage,
        confidence,
        independentBrandCount: candidate.brands.length,
        modelFamilyCount: candidate.bucket.families.length,
        description: buildDescription(
          category,
          candidate.bucket.attributes,
          candidate.brands.length,
        ),
        requiredAttributes: candidate.bucket.attributes,
        heroEvidence: evidence.slice(0, 6),
        allEvidence: evidence,
        momentumScore: comparisonAvailable ? null : null,
        rankingScore: scoreCandidate(candidate),
        isChanging: comparisonAvailable ? false : true,
        brands: candidate.brands,
      };

      if (radarType === "EARLY") earlySignals.push(signal);
      else commercialSignals.push(signal);
    }
  }

  return {
    earlySignals: earlySignals
      .sort((a, b) => b.rankingScore - a.rankingScore)
      .slice(0, MAX_SIGNALS_PER_CATEGORY),
    commercialSignals: commercialSignals
      .sort((a, b) => b.rankingScore - a.rankingScore)
      .slice(0, MAX_SIGNALS_PER_CATEGORY),
    excluded,
  };
}
