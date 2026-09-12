import { marketResearchOnboardingSteps, productResearchOnboardingSteps } from "../policies";
import type { OperatorTask, OperatorTaskTarget, PlannedStep, TaskDomain, TaskTemplateId } from "../types";

export interface TaskTemplate {
  id: TaskTemplateId;
  domain: TaskDomain;
  titleExample: string;
  description: string;
  writeTargets: readonly string[];
  forbiddenTargets: readonly string[];
  qaRequirements: readonly string[];
  steps: PlannedStep[];
}

const SHARED_QA = [
  "Do not modify production catalog data in dry-run",
  "Record WHY for every REVIEW / BLOCKED / FAILED outcome",
  "Production actions remain DENY without owner approval",
];

const PRODUCT_QA = [
  ...SHARED_QA,
  "Locale must be known before classification",
  "Unresolved category becomes REVIEW, never Diğer as a final class",
  "Keep brand and marketplace occurrences",
  "Visual may canonicalize but source provenance stays",
  "collectedAt is not New Arrival evidence",
  "Failed/empty collect cannot replace a valid dataset",
];

const MARKET_QA = [
  ...SHARED_QA,
  "Never write Market Research records into Markalar or Pazaryerleri",
  "originCountry and markets stay separate",
  "Prices belong prominently in the report",
  "Do not use the Visual / Product Research pipeline",
];

export const TASK_TEMPLATES: readonly TaskTemplate[] = [
  {
    id: "PRODUCT_RESEARCH_BRAND_ONBOARDING",
    domain: "PRODUCT_RESEARCH",
    titleExample: "Add Massimo Dutti to Markalar",
    description: "Onboard an official brand site into Product Research Markalar.",
    writeTargets: ["MARKALAR", "VISUAL", "NEW_ARRIVALS"],
    forbiddenTargets: ["SALES_MARKET_BRANDS", "COUNTRY_MARKETS", "RETAILERS", "PRICE_INTEL"],
    qaRequirements: PRODUCT_QA,
    steps: productResearchOnboardingSteps(),
  },
  {
    id: "PRODUCT_RESEARCH_MARKETPLACE_ONBOARDING",
    domain: "PRODUCT_RESEARCH",
    titleExample: "Add a marketplace to Pazaryerleri",
    description: "Onboard a marketplace/retailer source into Product Research Pazaryerleri.",
    writeTargets: ["PAZARYERLERI", "VISUAL", "NEW_ARRIVALS"],
    forbiddenTargets: ["SALES_MARKET_BRANDS", "COUNTRY_MARKETS", "RETAILERS", "PRICE_INTEL", "MARKALAR"],
    qaRequirements: [
      ...PRODUCT_QA,
      "Do not merge marketplace listings away because a brand occurrence exists",
    ],
    steps: productResearchOnboardingSteps(),
  },
  {
    id: "PRODUCT_RESEARCH_REFRESH",
    domain: "PRODUCT_RESEARCH",
    titleExample: "Refresh existing Product Research sources",
    description: "Re-collect existing Markalar / Pazaryerleri sources without replacing valid data on failure.",
    writeTargets: ["MARKALAR", "PAZARYERLERI", "VISUAL", "NEW_ARRIVALS"],
    forbiddenTargets: ["SALES_MARKET_BRANDS", "COUNTRY_MARKETS", "RETAILERS", "PRICE_INTEL"],
    qaRequirements: PRODUCT_QA,
    steps: productResearchOnboardingSteps(),
  },
  {
    id: "MARKET_RESEARCH_BRAND_ONBOARDING",
    domain: "MARKET_RESEARCH",
    titleExample: "Add a Romanian sales-market brand",
    description: "Add a sales-market brand record for country intelligence. Separate from Markalar.",
    writeTargets: ["SALES_MARKET_BRANDS", "PRICE_INTEL"],
    forbiddenTargets: ["MARKALAR", "PAZARYERLERI", "VISUAL", "NEW_ARRIVALS"],
    qaRequirements: MARKET_QA,
    steps: marketResearchOnboardingSteps(),
  },
  {
    id: "MARKET_RESEARCH_COUNTRY_REFRESH",
    domain: "MARKET_RESEARCH",
    titleExample: "Refresh Romania sales-market intelligence",
    description: "Refresh country sales evidence from brands, retailers and marketplaces.",
    writeTargets: ["COUNTRY_MARKETS", "SALES_MARKET_BRANDS", "RETAILERS", "PRICE_INTEL"],
    forbiddenTargets: ["MARKALAR", "PAZARYERLERI", "VISUAL", "NEW_ARRIVALS"],
    qaRequirements: MARKET_QA,
    steps: marketResearchOnboardingSteps(),
  },
  {
    id: "QA_ONLY",
    domain: "QA",
    titleExample: "QA current Operator policies and reports",
    description: "Run quality checks without collecting or writing catalogs.",
    writeTargets: [],
    forbiddenTargets: ["MARKALAR", "PAZARYERLERI", "VISUAL", "NEW_ARRIVALS", "SALES_MARKET_BRANDS"],
    qaRequirements: SHARED_QA,
    steps: [
      {
        state: "VALIDATING",
        action: "Evaluate encoded Operator policies and quality gates",
        auto: true,
        requiresOwnerApproval: false,
        approvalGates: [],
      },
    ],
  },
  {
    id: "PREVIEW_READY_CHECK",
    domain: "PREVIEW",
    titleExample: "Check whether a preview is ready",
    description: "Inspect preview readiness. Deploy and merge stay owner-gated.",
    writeTargets: [],
    forbiddenTargets: ["MARKALAR", "PAZARYERLERI", "VISUAL", "NEW_ARRIVALS"],
    qaRequirements: [
      ...SHARED_QA,
      "Preview preparation is AUTO; production deploy is DENY",
    ],
    steps: [
      {
        state: "VALIDATING",
        action: "Check tests, build and report completeness for preview",
        auto: true,
        requiresOwnerApproval: false,
        approvalGates: [],
      },
    ],
  },
];

export function getTaskTemplate(id: TaskTemplateId): TaskTemplate {
  const template = TASK_TEMPLATES.find((item) => item.id === id);
  if (!template) {
    throw new Error(`Unknown Operator template: ${id}`);
  }
  return template;
}

export function createTaskFromTemplate(
  templateId: TaskTemplateId,
  input: {
    title?: string;
    target?: OperatorTaskTarget;
    locale?: string | null;
    now?: Date;
    id?: string;
  } = {},
): OperatorTask {
  const template = getTaskTemplate(templateId);
  const now = input.now ?? new Date();
  const iso = now.toISOString();
  const target = input.target ?? { name: template.titleExample };
  return {
    id: input.id ?? `task-${templateId.toLowerCase()}-${now.getTime()}`,
    title: input.title ?? template.titleExample,
    domain: template.domain,
    templateId: template.id,
    state: "QUEUED",
    createdAt: iso,
    updatedAt: iso,
    locale: input.locale ?? null,
    target,
    notes: null,
  };
}
