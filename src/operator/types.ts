export const TASK_DOMAINS = [
  "PRODUCT_RESEARCH",
  "MARKET_RESEARCH",
  "QA",
  "PREVIEW",
] as const;

export type TaskDomain = (typeof TASK_DOMAINS)[number];

export const TASK_STATES = [
  "QUEUED",
  "DISCOVERING",
  "COLLECTING",
  "NORMALIZING",
  "CLASSIFYING",
  "GROUPING",
  "VALIDATING",
  "REVIEW",
  "BLOCKED",
  "READY",
  "FAILED",
] as const;

export type TaskState = (typeof TASK_STATES)[number];

export const QA_RESULTS = ["PASS", "REVIEW", "BLOCKED", "FAILED"] as const;

export type QAResult = (typeof QA_RESULTS)[number];

export const APPROVAL_GATES = [
  "COMMIT",
  "PUSH",
  "PR_MERGE",
  "WRITE_MAIN",
  "PRODUCTION_DEPLOY",
  "FORCE_OPERATION",
  "DESTRUCTIVE_BULK_DELETE",
  "REPLACE_VALID_DATASET_WITH_EMPTY",
] as const;

export type ApprovalGate = (typeof APPROVAL_GATES)[number];

export const TASK_TEMPLATE_IDS = [
  "PRODUCT_RESEARCH_BRAND_ONBOARDING",
  "PRODUCT_RESEARCH_MARKETPLACE_ONBOARDING",
  "PRODUCT_RESEARCH_REFRESH",
  "MARKET_RESEARCH_BRAND_ONBOARDING",
  "MARKET_RESEARCH_COUNTRY_REFRESH",
  "QA_ONLY",
  "PREVIEW_READY_CHECK",
] as const;

export type TaskTemplateId = (typeof TASK_TEMPLATE_IDS)[number];

export const PRODUCT_RESEARCH_REGISTRIES = [
  "MARKALAR",
  "PAZARYERLERI",
  "VISUAL",
  "NEW_ARRIVALS",
] as const;

export type ProductResearchRegistry = (typeof PRODUCT_RESEARCH_REGISTRIES)[number];

export const MARKET_RESEARCH_REGISTRIES = [
  "SALES_MARKET_BRANDS",
  "COUNTRY_MARKETS",
  "RETAILERS",
  "PRICE_INTEL",
] as const;

export type MarketResearchRegistry = (typeof MARKET_RESEARCH_REGISTRIES)[number];

export type UserFacingRegistry = ProductResearchRegistry | MarketResearchRegistry;

export const CAPONE_FOOTWEAR_CATEGORIES = [
  "Babet",
  "Loafer",
  "Mule",
  "Sandalet",
  "Topuklu",
  "Sneaker",
  "Bot",
  "Çizme",
] as const;

export type CaponeFootwearCategory = (typeof CAPONE_FOOTWEAR_CATEGORIES)[number];

export const CATEGORY_EVIDENCE_CHAIN = [
  "source_category",
  "breadcrumb",
  "product_type",
  "structured_data",
  "title_name",
  "url_slug",
  "product_attributes",
  "product_description",
  "detail_page",
] as const;

export type CategoryEvidenceField = (typeof CATEGORY_EVIDENCE_CHAIN)[number];

export const COLLECT_EVIDENCE_ROUTES = [
  "HTTP",
  "JSON_LD",
  "EMBEDDED_APP_STATE",
  "KNOWN_STOREFRONT_API",
  "BROWSER_COLLECTOR",
] as const;

export type CollectEvidenceRoute = (typeof COLLECT_EVIDENCE_ROUTES)[number];

export type ApprovalDecision = "ALLOW" | "DENY";

export interface Blocker {
  code: string;
  reason: string;
  severity: Exclude<QAResult, "PASS">;
  evidence?: string;
}

export interface OperatorTaskTarget {
  name: string;
  slug?: string;
  sourceUrl?: string;
  /** Brand origin / headquarters. Never treated as a sales market. */
  originCountry?: string;
  /** Sales-market country (Market Research only). */
  marketCountry?: string;
}

export interface OperatorTask {
  id: string;
  title: string;
  domain: TaskDomain;
  templateId: TaskTemplateId;
  state: TaskState;
  createdAt: string;
  updatedAt: string;
  locale: string | null;
  target: OperatorTaskTarget;
  notes: string | null;
}

export interface PlannedStep {
  state: TaskState;
  action: string;
  auto: boolean;
  requiresOwnerApproval: boolean;
  approvalGates: ApprovalGate[];
}

export interface RunMetrics {
  locale: string | null;
  products: number | null;
  models: number | null;
  groupedColorVariants: number | null;
  imageCoveragePercent: number | null;
  unresolvedCategory: number;
  nonFootwearSuspects: number;
  tests: QAResult | "NOT_RUN";
  build: QAResult | "NOT_RUN";
  discovery: QAResult | "NOT_RUN";
  collector: QAResult | "NOT_RUN";
}

export interface SafetyGateSummary {
  gate: ApprovalGate;
  defaultDecision: ApprovalDecision;
  ownerApproved: boolean;
  allowed: boolean;
}

export interface RunSummary {
  taskId: string;
  taskTitle: string;
  domain: TaskDomain;
  templateId: TaskTemplateId;
  status: QAResult;
  state: TaskState;
  steps: PlannedStep[];
  metrics: RunMetrics;
  blockers: Blocker[];
  qaRequirements: string[];
  safetyGates: SafetyGateSummary[];
  productionReady: boolean;
  ownerActionRequired: string | null;
  dryRun: boolean;
  productionDataModified: boolean;
  generatedAt: string;
  why: string;
}

export interface OperatorQueueFile {
  version: 1;
  updatedAt: string;
  tasks: OperatorTask[];
}

export interface AuditEvent {
  at: string;
  taskId: string;
  event: string;
  fromState?: TaskState;
  toState?: TaskState;
  why: string;
}

export interface DomainRecord {
  id: string;
  name: string;
  domain: TaskDomain;
  registry: UserFacingRegistry;
}

export interface SourceOccurrence {
  productKey: string;
  sourceKind: "BRAND" | "MARKETPLACE";
  sourceId: string;
  sourceUrl: string;
}

export interface CollectDatasetSnapshot {
  label: string;
  productCount: number;
  valid: boolean;
}

export interface ModelGroupingCandidate {
  styleCode?: string | null;
  parentProductId?: string | null;
  stableModelCode?: string | null;
  skuBase?: string | null;
  sourceVariantGroup?: string | null;
  normalizedModelName?: string | null;
  color?: string | null;
  sourceUrl?: string | null;
  price?: number | null;
  listPrice?: number | null;
  currency?: string | null;
}

export interface CategoryEvidence {
  locale: string | null;
  sourceCategory?: string | null;
  breadcrumb?: string | null;
  productType?: string | null;
  structuredData?: string | null;
  titleName?: string | null;
  urlSlug?: string | null;
  productAttributes?: string | null;
  productDescription?: string | null;
  detailPage?: string | null;
}

export interface CategoryDecision {
  status: "RESOLVED" | "REVIEW";
  category: CaponeFootwearCategory | null;
  qaState: "ok" | "unresolved" | "insufficient_evidence" | "non_footwear_suspect";
  matchedField: CategoryEvidenceField | null;
  reason: string;
}

export interface NewArrivalEvidence {
  sourceNewArrival: boolean;
  sourceObservedAt?: string | null;
  collectedAt: string;
  sourceCollection?: string | null;
  sourcePublishedAt?: string | null;
  sourceCreatedAt?: string | null;
  sourceNewBadge?: boolean;
}

export interface FootwearGateInput {
  title: string;
  categoryText?: string | null;
  gender?: string | null;
  audience?: "WOMENS" | "MENS" | "UNISEX" | "UNKNOWN";
}

export interface FootwearGateDecision {
  decision: "ACCEPT" | "EXCLUDE" | "REVIEW";
  reason: string;
}

export interface OwnerApproval {
  gates: readonly ApprovalGate[];
  approvedBy?: string;
  approvedAt?: string;
}
