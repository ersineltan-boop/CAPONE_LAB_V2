import type { PlannedStep, TaskTemplateId } from "../types";

export const PRODUCT_RESEARCH_RULES = {
  keepBrandAndMarketplaceOccurrences: true,
  neverMergeMarkalarWithPazaryerleri: true,
  visualIsCanonicalCrossSourceView: true,
  sourceProvenanceMustRemain: true,
  newArrivalRequiresSourceEvidence: true,
  collectedAtIsNotNewness: true,
  digerIsQaErrorState: true,
  uncertainFootwearMustReview: true,
} as const;

export function productResearchWriteTargets(
  templateId: TaskTemplateId,
): readonly string[] {
  if (templateId === "PRODUCT_RESEARCH_MARKETPLACE_ONBOARDING") {
    return ["PAZARYERLERI", "VISUAL", "NEW_ARRIVALS"];
  }
  if (templateId === "PRODUCT_RESEARCH_BRAND_ONBOARDING") {
    return ["MARKALAR", "VISUAL", "NEW_ARRIVALS"];
  }
  if (templateId === "PRODUCT_RESEARCH_REFRESH") {
    return ["MARKALAR", "PAZARYERLERI", "VISUAL", "NEW_ARRIVALS"];
  }
  return [];
}

export function productResearchForbiddenTargets(): readonly string[] {
  return ["SALES_MARKET_BRANDS", "COUNTRY_MARKETS", "RETAILERS", "PRICE_INTEL"];
}

export function productResearchOnboardingSteps(): PlannedStep[] {
  return [
    {
      state: "DISCOVERING",
      action: "Detect storefront language, platform and footwear entry points",
      auto: true,
      requiresOwnerApproval: false,
      approvalGates: [],
    },
    {
      state: "COLLECTING",
      action: "Try deterministic collect routes; stop on block instead of looping",
      auto: true,
      requiresOwnerApproval: false,
      approvalGates: [],
    },
    {
      state: "NORMALIZING",
      action: "Normalize products while keeping source URLs and provenance",
      auto: true,
      requiresOwnerApproval: false,
      approvalGates: [],
    },
    {
      state: "CLASSIFYING",
      action: "Resolve CAPONE footwear taxonomy in the source locale",
      auto: true,
      requiresOwnerApproval: false,
      approvalGates: [],
    },
    {
      state: "GROUPING",
      action: "Group color variants of the same model; keep distinct versions separate",
      auto: true,
      requiresOwnerApproval: false,
      approvalGates: [],
    },
    {
      state: "VALIDATING",
      action: "Footwear gate, image QA, source newness, dual-source retention",
      auto: true,
      requiresOwnerApproval: false,
      approvalGates: [],
    },
  ];
}
