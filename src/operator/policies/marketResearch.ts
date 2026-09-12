import type { PlannedStep, TaskTemplateId } from "../types";

export const MARKET_RESEARCH_RULES = {
  salesMarketNotBrandOrigin: true,
  originCountrySeparateFromMarkets: true,
  pricesBelongProminently: true,
  neverCombineWithProductResearchBrandLists: true,
  neverShowInMarkalarOrPazaryerleri: true,
  sameBrandAllowedAsSeparateDomainRecord: true,
  countryIntelMayUseBrandsRetailersMarketplaces: true,
  notVisualProductPipeline: true,
} as const;

export function marketResearchWriteTargets(
  templateId: TaskTemplateId,
): readonly string[] {
  if (templateId === "MARKET_RESEARCH_BRAND_ONBOARDING") {
    return ["SALES_MARKET_BRANDS", "PRICE_INTEL"];
  }
  if (templateId === "MARKET_RESEARCH_COUNTRY_REFRESH") {
    return ["COUNTRY_MARKETS", "SALES_MARKET_BRANDS", "RETAILERS", "PRICE_INTEL"];
  }
  return [];
}

export function marketResearchForbiddenTargets(): readonly string[] {
  return ["MARKALAR", "PAZARYERLERI", "VISUAL", "NEW_ARRIVALS"];
}

export function marketResearchOnboardingSteps(): PlannedStep[] {
  return [
    {
      state: "DISCOVERING",
      action: "Identify sales-market country, retailers and price evidence sources",
      auto: true,
      requiresOwnerApproval: false,
      approvalGates: [],
    },
    {
      state: "COLLECTING",
      action: "Collect country sales evidence without writing Product Research registries",
      auto: true,
      requiresOwnerApproval: false,
      approvalGates: [],
    },
    {
      state: "NORMALIZING",
      action: "Keep originCountry and markets as separate fields; keep prices prominent",
      auto: true,
      requiresOwnerApproval: false,
      approvalGates: [],
    },
    {
      state: "VALIDATING",
      action: "Prove no leak into Markalar / Pazaryerleri / Visual",
      auto: true,
      requiresOwnerApproval: false,
      approvalGates: [],
    },
  ];
}
