import type { QAResult } from "../../types";
import type { JobManifest } from "../types";
import { OPERATOR_REPORT_MARKER } from "./constants";

function domainLabel(job: JobManifest): string {
  if (job.domain === "PRODUCT_RESEARCH") return "Product Research";
  if (job.domain === "MARKET_RESEARCH") return "Pazar Araştırması";
  if (job.domain === "QA") return "QA";
  if (job.domain === "PREVIEW") return "Preview";
  return "Belirsiz";
}

function destinationLabel(job: JobManifest): string {
  if (job.destination === "MARKALAR") return "Markalar";
  if (job.destination === "PAZARYERLERI") return "Pazaryerleri";
  if (job.destination === "SALES_MARKET_BRANDS") return "Satış pazarı markaları";
  if (job.destination === "COUNTRY_MARKETS") return "Ülke pazarı";
  if (job.destination === "NEW_ARRIVALS") return "New Arrivals";
  if (job.destination === "VISUAL") return "Visual";
  if (job.destination === "PRICE_INTEL") return "Fiyat istihbaratı";
  return job.destination ?? "belirsiz";
}

const STATE_PLAN: Record<string, string> = {
  DISCOVERING: "Discover",
  COLLECTING: "Collect",
  NORMALIZING: "Normalize",
  CLASSIFYING: "Classify",
  GROUPING: "Group",
  VALIDATING: "Validate",
  REVIEW: "Review",
  BLOCKED: "Blocked",
};

export function formatGitHubIssueComment(job: JobManifest): string {
  const plan = [...new Set(job.steps.map((step) => STATE_PLAN[step.state] ?? step.state))];
  const task = job.rawInstruction.split(/\r?\n/)[0]?.trim() || job.targetName || job.id;

  return [
    OPERATOR_REPORT_MARKER,
    "",
    "## CAPONE Operator",
    "",
    `Durum: ${job.ownerResult}`,
    "",
    "Alan:",
    domainLabel(job),
    "",
    "Hedef:",
    destinationLabel(job),
    "",
    "Görev:",
    task,
    "",
    "Plan:",
    ...plan.map((item, index) => `${index + 1}. ${item}`),
    "",
    "Güvenlik:",
    "- Production data değiştirilmedi",
    "- Collector çalıştırılmadı",
    "- Commit yapılmadı",
    "- Push yapılmadı",
    "- Deploy yapılmadı",
    "",
    "Sonuç:",
    "Phase 2A yalnızca plan oluşturdu.",
    "Gerçek çalışma için Phase 2B executor gerekir.",
    "",
    `task-id: \`${job.id}\``,
  ].join("\n");
}

export function findExistingOperatorComment<T extends { id: number; body?: string | null }>(
  comments: readonly T[],
): T | null {
  return comments.find((comment) => (comment.body ?? "").includes(OPERATOR_REPORT_MARKER)) ?? null;
}

export function suggestedResultLabel(result: QAResult): "operator-review" | "operator-blocked" | "operator-ready" | null {
  if (result === "BLOCKED" || result === "FAILED") return "operator-blocked";
  if (result === "PASS") return "operator-ready";
  if (result === "REVIEW") return "operator-review";
  return null;
}

export function commentUsesReportMarker(body: string): boolean {
  return body.includes(OPERATOR_REPORT_MARKER);
}
