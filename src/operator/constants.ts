import { PRIMARY_NAV_ITEMS } from "../navigation/primaryNav";
import type {
  ApprovalGate,
  CaponeFootwearCategory,
  CollectEvidenceRoute,
  ProductResearchRegistry,
  TaskDomain,
} from "./types";
import {
  APPROVAL_GATES,
  CAPONE_FOOTWEAR_CATEGORIES,
  COLLECT_EVIDENCE_ROUTES,
  MARKET_RESEARCH_REGISTRIES,
  PRODUCT_RESEARCH_REGISTRIES,
} from "./types";

export const OPERATOR_QUEUE_PATH = "data/operator/queue.json";
export const OPERATOR_AUDIT_PATH = "data/operator/audit.jsonl";
export const OPERATOR_RUNS_DIR = "data/operator/runs";

export const PRODUCT_RESEARCH_NAV_VIEWS = [
  "brands",
  "marketplaces",
  "visual-wall",
] as const;

export const PRODUCT_RESEARCH_PAGES: readonly ProductResearchRegistry[] =
  PRODUCT_RESEARCH_REGISTRIES;

/** New Arrivals is Product Research, even when nested under a brand/marketplace. */
export const PRODUCT_RESEARCH_SURFACE = [
  "Markalar",
  "Pazaryerleri",
  "Visual",
  "New Arrivals",
] as const;

export const MARKET_RESEARCH_SURFACE = [
  "Satış Pazarı Markaları",
  "Ülke Pazarları",
  "Perakendeciler",
  "Fiyat İstihbaratı",
] as const;

export const AUTO_ACTIONS = [
  "research",
  "read_repository",
  "collector_execution",
  "deterministic_transformations",
  "tests",
  "qa",
  "reports",
  "preview_preparation",
] as const;

export const OWNER_APPROVAL_ACTIONS: readonly ApprovalGate[] = APPROVAL_GATES;

export const DEFAULT_APPROVAL_DECISIONS: Record<ApprovalGate, "DENY"> = {
  COMMIT: "DENY",
  PUSH: "DENY",
  PR_MERGE: "DENY",
  WRITE_MAIN: "DENY",
  PRODUCTION_DEPLOY: "DENY",
  FORCE_OPERATION: "DENY",
  DESTRUCTIVE_BULK_DELETE: "DENY",
  REPLACE_VALID_DATASET_WITH_EMPTY: "DENY",
};

export const FOOTWEAR_TAXONOMY: readonly CaponeFootwearCategory[] =
  CAPONE_FOOTWEAR_CATEGORIES;

export const COLLECT_ROUTE_ORDER: readonly CollectEvidenceRoute[] = COLLECT_EVIDENCE_ROUTES;

export const BLOCK_SIGNALS = [
  "cloudflare",
  "datadome",
  "rate_limit",
  "javascript_rendering",
  "api_failure",
  "changed_markup",
] as const;

export function productResearchPrimaryNavIds(): readonly string[] {
  return PRIMARY_NAV_ITEMS.filter((item) =>
    (PRODUCT_RESEARCH_NAV_VIEWS as readonly string[]).includes(item.id),
  ).map((item) => item.id);
}

export function domainForRegistry(
  registry: (typeof PRODUCT_RESEARCH_REGISTRIES)[number] | (typeof MARKET_RESEARCH_REGISTRIES)[number],
): TaskDomain {
  if ((PRODUCT_RESEARCH_REGISTRIES as readonly string[]).includes(registry)) {
    return "PRODUCT_RESEARCH";
  }
  return "MARKET_RESEARCH";
}
