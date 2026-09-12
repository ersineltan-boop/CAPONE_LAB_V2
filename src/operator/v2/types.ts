import type { ApprovalGate, Blocker, QAResult, TaskDomain, TaskState } from "../types";

export const TASK_SOURCES = [
  "LOCAL_CLI",
  "GITHUB_ISSUE",
  "SCHEDULED_JOB",
  "CHATGPT_AGENT",
  "CURSOR_CLOUD_AGENT",
] as const;

export type TaskSource = (typeof TASK_SOURCES)[number];

export const EXECUTION_MODES = [
  "DRY_RUN",
  "LOCAL_SAFE",
  "BACKGROUND_SAFE",
  "OWNER_APPROVED_PRODUCTION",
] as const;

export type ExecutionMode = (typeof EXECUTION_MODES)[number];

export const V2_TEMPLATE_IDS = [
  "PRODUCT_RESEARCH_BRAND_ONBOARDING",
  "PRODUCT_RESEARCH_MARKETPLACE_ONBOARDING",
  "PRODUCT_RESEARCH_REFRESH",
  "PRODUCT_RESEARCH_CATALOG_QA",
  "PRODUCT_RESEARCH_NEW_ARRIVALS_QA",
  "PRODUCT_RESEARCH_VISUAL_DEDUPE_QA",
  "MARKET_RESEARCH_BRAND_ONBOARDING",
  "MARKET_RESEARCH_BRAND_REFRESH",
  "MARKET_RESEARCH_COUNTRY_REFRESH",
  "MARKET_RESEARCH_PRICE_STATUS",
  "QA_ONLY",
  "AMBIGUOUS_REVIEW",
] as const;

export type V2TemplateId = (typeof V2_TEMPLATE_IDS)[number];

export const TARGET_TYPES = [
  "BRAND",
  "MARKETPLACE",
  "COUNTRY",
  "CATALOG",
  "VISUAL",
  "NEW_ARRIVALS",
  "UNKNOWN",
] as const;

export type TargetType = (typeof TARGET_TYPES)[number];

export const DESTINATIONS = [
  "MARKALAR",
  "PAZARYERLERI",
  "VISUAL",
  "NEW_ARRIVALS",
  "SALES_MARKET_BRANDS",
  "COUNTRY_MARKETS",
  "PRICE_INTEL",
  "QA",
] as const;

export type Destination = (typeof DESTINATIONS)[number];

export interface ParsedIntent {
  template: V2TemplateId;
  domain: TaskDomain | null;
  targetType: TargetType;
  targetName: string | null;
  destination: Destination | null;
  salesMarket: string | null;
  sourceUrls: string[];
  ownerApprovalRequired: true;
  ambiguous: boolean;
  injectionAttempt: boolean;
  reason: string;
}

export interface JobStep {
  id: string;
  state: TaskState;
  title: string;
  detail: string;
  auto: boolean;
  command?: string[] | null;
  requiresOwnerApproval: boolean;
  approvalGates: ApprovalGate[];
  status: "PENDING" | "RAN" | "SKIPPED" | "BLOCKED";
}

export interface JobArtifact {
  path: string;
  kind: "report" | "plan" | "log" | "summary";
}

export interface JobQa {
  domainIsolated: boolean;
  newArrivalUsesSourceEvidence: boolean;
  visualKeepsMarketplaceProvenance: boolean;
  emptyCollectProtected: boolean;
  notes: string[];
}

export interface JobManifest {
  id: string;
  createdAt: string;
  updatedAt: string;
  requestedBy: string;
  source: TaskSource;
  rawInstruction: string;
  parsedIntent: ParsedIntent;
  domain: TaskDomain | null;
  template: V2TemplateId;
  targetName: string | null;
  targetType: TargetType;
  destination: Destination | null;
  salesMarket: string | null;
  sourceUrls: string[];
  state: TaskState;
  ownerResult: QAResult;
  executionMode: ExecutionMode;
  approvalRequirements: ApprovalGate[];
  steps: JobStep[];
  artifacts: JobArtifact[];
  blockers: Blocker[];
  qa: JobQa;
  timestamps: {
    queuedAt: string;
    startedAt: string | null;
    finishedAt: string | null;
  };
  why: string;
  productionDataModified: boolean;
  githubIssue?: GitHubIssueRef | null;
}

export interface GitHubIssueRef {
  repository: string;
  issueNumber: number;
  issueTitle: string;
  issueBody: string;
  issueAuthor: string;
  issueUrl: string;
  createdAt: string;
  labels: string[];
}

export interface CommandEvaluation {
  decision: "ALLOW" | "REQUIRE_OWNER_APPROVAL" | "DENY";
  reason: string;
}

export interface StepExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  notes: string[];
  blockers: Blocker[];
}

export interface GitSnapshot {
  paths: string[];
  raw: string;
}

export interface MutationFinding {
  blocked: boolean;
  unexpected: string[];
  production: string[];
  reason: string | null;
}
