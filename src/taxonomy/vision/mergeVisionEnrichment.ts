import { featureKnown } from "../featureHelpers";
import { isApplicable, isKnown } from "../featureHelpers";
import type { FootwearTaxonomyV1, TaxonomyFeature } from "../types";
import { getTaxonomyFeatureFromTaxonomy } from "../../categories/taxonomyFieldAccess";
import {
  BLOCKED_VISION_FIELDS,
  PROTECTED_EVIDENCE_SOURCES,
  TAXONOMY_VISION_ACCEPT_THRESHOLD,
} from "./constants";
import type { TaxonomyVisionEnrichmentRecord } from "./types";
import type { TaxonomyVisionProposal } from "./schema";

const APPROVED_ENUMS: Record<string, Set<string>> = {
  toeShape: new Set(["POINTED", "ALMOND", "ROUND", "SQUARE", "CHISEL"]),
  toeLength: new Set(["SHORT", "STANDARD", "ELONGATED"]),
  toeOpening: new Set(["CLOSED", "PEEP", "OPEN"]),
  backConstruction: new Set(["CLOSED", "SLINGBACK", "BACKLESS"]),
  vampHeight: new Set(["LOW", "STANDARD", "HIGH"]),
  heelHeightClass: new Set(["FLAT", "LOW", "MID", "HIGH"]),
  heelType: new Set([
    "NONE",
    "KITTEN",
    "STILETTO",
    "BLOCK",
    "CONE",
    "FLARED",
    "SCULPTURAL",
    "WEDGE",
    "CUBAN",
    "OTHER",
  ]),
  soleProfile: new Set(["THIN", "STANDARD", "CHUNKY", "LUGGED"]),
  platformConstruction: new Set([
    "NONE",
    "FRONT_PLATFORM",
    "FULL_PLATFORM",
    "FLATFORM",
  ]),
  sideConstruction: new Set(["FULL_SIDE", "DORSAY", "CUTOUT"]),
  shaftHeight: new Set(["ANKLE", "MID_CALF", "KNEE_HIGH", "OVER_THE_KNEE"]),
  shaftFit: new Set(["TIGHT", "REGULAR", "WIDE", "SLOUCHY"]),
  sneakerHeight: new Set(["LOW_TOP", "MID_TOP", "HIGH_TOP"]),
  panelComplexity: new Set(["MINIMAL", "MODERATE", "COMPLEX"]),
  outsoleVisualWeight: new Set(["LIGHT", "STANDARD", "HEAVY"]),
  lacingConstruction: new Set(["OXFORD", "DERBY", "MONK", "OTHER"]),
  broguingLevel: new Set(["NONE", "SEMI", "FULL"]),
  baseConstruction: new Set(["WOOD", "EVA", "RUBBER", "MOLDED", "OTHER"]),
  espadrilleSoleHeight: new Set(["FLAT", "WEDGE", "PLATFORM"]),
  hardwareIntensity: new Set(["MINIMAL", "MODERATE", "STATEMENT"]),
};

export function isApprovedEnumValue(field: string, value: string): boolean {
  const allowed = APPROVED_ENUMS[field];
  if (!allowed) return /^[A-Z0-9_+]+$/.test(value);
  return allowed.has(value);
}

function setFeatureOnTaxonomy(
  taxonomy: FootwearTaxonomyV1,
  field: string,
  feature: TaxonomyFeature<unknown>,
): void {
  if (field in taxonomy.global) {
    (taxonomy.global as unknown as Record<string, TaxonomyFeature<unknown>>)[field] = feature;
    return;
  }
  (taxonomy.categorySpecific as unknown as Record<string, TaxonomyFeature<unknown>>)[field] =
    feature;
}

export function shouldAcceptVisionProposal(
  proposal: TaxonomyVisionProposal,
  existing: TaxonomyFeature<unknown> | null,
): { accept: boolean; reason?: string } {
  if (BLOCKED_VISION_FIELDS.has(proposal.field)) {
    return { accept: false, reason: "blocked-field" };
  }
  if (!proposal.value || proposal.confidence < TAXONOMY_VISION_ACCEPT_THRESHOLD) {
    return { accept: false, reason: "low-confidence" };
  }
  if (!isApprovedEnumValue(proposal.field, proposal.value)) {
    return { accept: false, reason: "invalid-enum" };
  }
  if (existing && isKnown(existing) && PROTECTED_EVIDENCE_SOURCES.has(existing.source)) {
    return { accept: false, reason: "protected-source" };
  }
  if (existing && isKnown(existing) && existing.source === "DERIVED") {
    return { accept: false, reason: "deterministic-derived" };
  }
  if (existing && isKnown(existing)) {
    return { accept: false, reason: "already-known" };
  }
  if (existing && !isApplicable(existing)) {
    return { accept: false, reason: "not-applicable" };
  }
  return { accept: true };
}

export function mergeVisionEnrichmentIntoTaxonomy(
  taxonomy: FootwearTaxonomyV1,
  enrichment: TaxonomyVisionEnrichmentRecord,
): FootwearTaxonomyV1 {
  const merged: FootwearTaxonomyV1 = structuredClone(taxonomy);
  const conflicts: Array<{ field: string; existingValue: string; proposedValue: string }> =
    [];
  enrichment.acceptedFields = [];
  enrichment.rejectedFields = [];

  for (const proposal of enrichment.proposals) {
    const existing = getTaxonomyFeatureFromTaxonomy(merged, proposal.field);
    const decision = shouldAcceptVisionProposal(proposal, existing);
    if (!decision.accept) {
      if (
        existing &&
        isKnown(existing) &&
        proposal.value &&
        String(existing.value) !== proposal.value
      ) {
        conflicts.push({
          field: proposal.field,
          existingValue: String(existing.value),
          proposedValue: proposal.value,
        });
      }
      enrichment.rejectedFields.push(proposal.field);
      continue;
    }

    enrichment.acceptedFields.push(proposal.field);
    setFeatureOnTaxonomy(
      merged,
      proposal.field,
      featureKnown(proposal.value, "IMAGE", proposal.confidence),
    );
  }

  enrichment.conflicts = conflicts;
  return merged;
}

export function applyAcceptedProposalsOnly(
  proposals: TaxonomyVisionProposal[],
  taxonomy: FootwearTaxonomyV1,
  familyId: string,
): { taxonomy: FootwearTaxonomyV1; accepted: string[]; rejected: string[] } {
  const enrichment: TaxonomyVisionEnrichmentRecord = {
    modelFamilyId: familyId,
    brand: "",
    productName: "",
    primaryCategory: taxonomy.primaryCategory,
    imageUrls: [],
    imageFingerprint: "",
    promptVersion: "",
    analyzedAt: new Date().toISOString(),
    provider: "openai",
    model: "",
    cached: false,
    proposals,
    acceptedFields: [],
    rejectedFields: [],
    conflicts: [],
  };
  const merged = mergeVisionEnrichmentIntoTaxonomy(taxonomy, enrichment);
  return {
    taxonomy: merged,
    accepted: enrichment.acceptedFields,
    rejected: enrichment.rejectedFields,
  };
}
